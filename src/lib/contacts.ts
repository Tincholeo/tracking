import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";

export type ContactoEntrada = { email: string; nombre?: string; empresa?: string };

// Contactos con su actividad; completar con WHERE opcional + GROUP BY c.id.
export const CONSULTA_CONTACTOS = `
  SELECT c.id, c.email, c.nombre, c.empresa, c.creado_at, c.estado, c.estado_motivo, c.estado_at,
    COUNT(e.id) AS enviados,
    COALESCE(SUM(EXISTS(SELECT 1 FROM aperturas a WHERE a.email_id = e.id AND a.sospechosa = 0)), 0) AS abiertos,
    COALESCE(SUM(EXISTS(SELECT 1 FROM clics k WHERE k.email_id = e.id)), 0) AS clicados,
    MAX(e.enviado_at) AS ultimo_envio,
    (SELECT GROUP_CONCAT(t.nombre ORDER BY t.nombre SEPARATOR ',')
       FROM contacto_etiquetas ce JOIN etiquetas t ON t.id = ce.etiqueta_id
      WHERE ce.contacto_id = c.id) AS etiquetas
  FROM contactos c
  LEFT JOIN emails e ON LOWER(e.destinatario) = c.email AND e.estado = 'enviado'
`;

// Alta masiva sin pisar datos existentes con valores vacíos.
export async function guardarContactos(contactos: ContactoEntrada[]) {
  let total = 0;
  for (let i = 0; i < contactos.length; i += 500) {
    total += await guardarLote(contactos.slice(i, i + 500));
  }
  return total;
}

async function guardarLote(contactos: ContactoEntrada[]) {
  if (contactos.length === 0) return 0;
  const filas = contactos.map((c) => [
    c.email.trim().toLowerCase(),
    (c.nombre ?? "").trim().slice(0, 255),
    (c.empresa ?? "").trim().slice(0, 255),
  ]);
  const [resultado] = await getPool().query(
    `INSERT INTO contactos (email, nombre, empresa, creado_at)
     SELECT n.email, n.nombre, n.empresa, UTC_TIMESTAMP() FROM (
       ${filas.map(() => "SELECT ? AS email, ? AS nombre, ? AS empresa").join(" UNION ALL ")}
     ) AS n
     ON DUPLICATE KEY UPDATE
       nombre = IF(n.nombre <> '', n.nombre, contactos.nombre),
       empresa = IF(n.empresa <> '', n.empresa, contactos.empresa)`,
    filas.flat()
  );
  return (resultado as { affectedRows: number }).affectedRows;
}

export async function buscarContactos(emails: string[]) {
  const mapa = new Map<string, { nombre: string; empresa: string; estado: EstadoContacto }>();
  if (emails.length === 0) return mapa;
  const [filas] = await getPool().query<RowDataPacket[]>(
    "SELECT email, nombre, empresa, estado FROM contactos WHERE email IN (?)",
    [emails]
  );
  for (const f of filas) mapa.set(f.email, { nombre: f.nombre, empresa: f.empresa, estado: f.estado });
  return mapa;
}

export type EstadoContacto = "activo" | "baja" | "rebotado" | "queja";

export const ETIQUETA_ESTADO: Record<Exclude<EstadoContacto, "activo">, string> = {
  baja: "se dio de baja",
  rebotado: "su correo rebota",
  queja: "lo marcó como spam",
};

// Cambia el estado de un contacto. Si deja de estar activo, lo que tuviera
// en cola se cancela para no escribirle más.
export async function marcarContacto(email: string, estado: EstadoContacto, motivo: string | null) {
  const pool = getPool();
  const normalizado = email.trim().toLowerCase();
  await guardarContactos([{ email: normalizado }]);
  await pool.query(
    "UPDATE contactos SET estado = ?, estado_at = UTC_TIMESTAMP(), estado_motivo = ? WHERE email = ?",
    [estado, motivo?.slice(0, 255) ?? null, normalizado]
  );
  if (estado !== "activo") {
    await pool.query(
      `UPDATE emails SET estado = 'omitido', error_envio = ?
       WHERE estado = 'pendiente' AND LOWER(destinatario) = ?`,
      [`No se envió: el contacto ${ETIQUETA_ESTADO[estado]}`, normalizado]
    );
  }
}

export function normalizarEtiqueta(nombre: string) {
  return nombre.replace(/[,]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

// Agrega o quita una etiqueta a varios contactos. Al agregar, la crea si no existe.
export async function etiquetar(contactoIds: number[], nombre: string, accion: "agregar" | "quitar") {
  const pool = getPool();
  const etiqueta = normalizarEtiqueta(nombre);
  if (!etiqueta || contactoIds.length === 0) return 0;

  if (accion === "agregar") {
    await pool.query("INSERT IGNORE INTO etiquetas (nombre, creado_at) VALUES (?, UTC_TIMESTAMP())", [etiqueta]);
  }
  const [[fila]] = await pool.query<RowDataPacket[]>("SELECT id FROM etiquetas WHERE nombre = ?", [etiqueta]);
  if (!fila) return 0;

  const [r] =
    accion === "agregar"
      ? await pool.query(
          `INSERT IGNORE INTO contacto_etiquetas (contacto_id, etiqueta_id)
           SELECT id, ? FROM contactos WHERE id IN (?)`,
          [fila.id, contactoIds]
        )
      : await pool.query("DELETE FROM contacto_etiquetas WHERE etiqueta_id = ? AND contacto_id IN (?)", [
          fila.id,
          contactoIds,
        ]);
  return (r as { affectedRows: number }).affectedRows;
}
