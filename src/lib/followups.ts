import type { RowDataPacket } from "mysql2";
import { randomUUID } from "crypto";
import { getPool } from "@/lib/db";
import { personalizar } from "@/lib/personalize";

export type Condicion = "sin_apertura" | "sin_clic";

export const CONDICIONES: Record<Condicion, string> = {
  sin_apertura: "no lo abre",
  sin_clic: "no hace clic en ningún enlace",
};

export type SeguimientoEntrada = { condicion: Condicion; dias: number; asunto: string; cuerpo: string };

export function validarSeguimiento(s: unknown): SeguimientoEntrada | string {
  if (!s || typeof s !== "object") return "Seguimiento inválido";
  const { condicion, dias, asunto, cuerpo } = s as Record<string, unknown>;
  if (condicion !== "sin_apertura" && condicion !== "sin_clic") return "Condición de seguimiento inválida";
  const d = Number(dias);
  if (!Number.isInteger(d) || d < 1 || d > 60) return "Los días del seguimiento deben ser entre 1 y 60";
  if (!String(cuerpo ?? "").trim()) return "El mensaje del recordatorio está vacío";
  return { condicion, dias: d, asunto: String(asunto ?? "").trim().slice(0, 500), cuerpo: String(cuerpo) };
}

function asuntoRespuesta(original: string) {
  return `Re: ${original.replace(/^\s*(re:\s*)+/i, "").trim()}`;
}

// Revisa los correos cuyo plazo de seguimiento venció y, si no se cumplió la
// condición (abrir / hacer clic), deja el recordatorio en la cola.
export async function generarSeguimientos() {
  const pool = getPool();
  const token = randomUUID();

  // Se reclaman con un token (columna lote, libre en correos ya enviados) para
  // que dos ejecuciones simultáneas no generen el mismo recordatorio.
  const [reclamo] = await pool.query(
    `UPDATE emails e JOIN seguimientos s ON s.id = e.seguimiento_id
     SET e.seguimiento_hecho = 1, e.lote = ?
     WHERE e.estado = 'enviado' AND e.seguimiento_hecho = 0
       AND e.enviado_at <= UTC_TIMESTAMP() - INTERVAL s.dias DAY`,
    [token]
  );
  if ((reclamo as { affectedRows: number }).affectedRows === 0) return { revisados: 0, generados: 0 };

  const [filas] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, e.destinatario, e.asunto, e.con_baja, e.user_id,
       s.id AS sid, s.condicion, s.asunto AS s_asunto, s.cuerpo AS s_cuerpo,
       COALESCE(c.nombre, '') AS nombre, COALESCE(c.empresa, '') AS empresa,
       COALESCE(c.estado, 'activo') AS estado_contacto,
       EXISTS(SELECT 1 FROM aperturas a WHERE a.email_id = e.id AND a.sospechosa = 0) AS abierto,
       EXISTS(SELECT 1 FROM clics k WHERE k.email_id = e.id) AS clicado
     FROM emails e
     JOIN seguimientos s ON s.id = e.seguimiento_id
     LEFT JOIN contactos c ON c.email = LOWER(e.destinatario)
     WHERE e.lote = ?`,
    [token]
  );
  await pool.query("UPDATE emails SET lote = NULL WHERE lote = ?", [token]);

  const aEnviar = filas.filter(
    (f) =>
      f.estado_contacto === "activo" &&
      (f.condicion === "sin_apertura" ? !f.abierto : !f.clicado)
  );

  const porSeguimiento = new Map<number, RowDataPacket[]>();
  for (const f of aEnviar) porSeguimiento.set(f.sid, [...(porSeguimiento.get(f.sid) ?? []), f]);

  for (const grupo of porSeguimiento.values()) {
    let campanaId: string | null = null;
    if (grupo.length > 1) {
      campanaId = randomUUID();
      const nombre = `Recordatorio: ${asuntoRespuesta(grupo[0].asunto).slice(4)}`.slice(0, 255);
      await pool.query(
        "INSERT INTO campanas (id, nombre, asunto, creado_at) VALUES (?, ?, ?, UTC_TIMESTAMP())",
        [campanaId, nombre, nombre]
      );
    }

    const valores = grupo.map((f) => {
      const datos = { email: f.destinatario.toLowerCase(), nombre: f.nombre, empresa: f.empresa };
      const asunto = f.s_asunto ? personalizar(f.s_asunto, datos, false) : asuntoRespuesta(f.asunto);
      return [
        randomUUID(),
        f.destinatario,
        asunto.slice(0, 500),
        personalizar(f.s_cuerpo, datos, true),
        f.user_id,
        campanaId,
        f.con_baja,
        f.id,
      ];
    });
    await pool.query(
      `INSERT INTO emails (id, destinatario, asunto, cuerpo, user_id, campana_id, con_baja, seguimiento_de, estado, creado_at)
       VALUES ${valores.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', UTC_TIMESTAMP())").join(", ")}`,
      valores.flat()
    );
  }

  return { revisados: filas.length, generados: aEnviar.length };
}
