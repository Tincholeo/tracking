import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";

export type ContactoEntrada = { email: string; nombre?: string; empresa?: string };

// Contactos con su actividad; completar con WHERE opcional + GROUP BY c.id.
export const CONSULTA_CONTACTOS = `
  SELECT c.id, c.email, c.nombre, c.empresa, c.creado_at,
    COUNT(e.id) AS enviados,
    COALESCE(SUM(EXISTS(SELECT 1 FROM aperturas a WHERE a.email_id = e.id AND a.sospechosa = 0)), 0) AS abiertos,
    COALESCE(SUM(EXISTS(SELECT 1 FROM clics k WHERE k.email_id = e.id)), 0) AS clicados,
    MAX(e.enviado_at) AS ultimo_envio
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
  const mapa = new Map<string, { nombre: string; empresa: string }>();
  if (emails.length === 0) return mapa;
  const [filas] = await getPool().query<RowDataPacket[]>(
    "SELECT email, nombre, empresa FROM contactos WHERE email IN (?)",
    [emails]
  );
  for (const f of filas) mapa.set(f.email, { nombre: f.nombre, empresa: f.empresa });
  return mapa;
}
