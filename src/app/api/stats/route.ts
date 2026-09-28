import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";

export async function GET() {
  const pool = getPool();

  const [[totales]] = await pool.query<RowDataPacket[]>(`
    SELECT
      (SELECT COUNT(*) FROM emails WHERE estado = 'enviado') AS enviados,
      (SELECT COUNT(DISTINCT email_id) FROM aperturas WHERE sospechosa = 0) AS abiertos,
      (SELECT COUNT(DISTINCT email_id) FROM clics) AS clicados,
      (SELECT COUNT(*) FROM campanas) AS campanas
  `);

  // Fechas crudas: el navegador las agrupa por día en su zona horaria.
  const [serie] = await pool.query<RowDataPacket[]>(`
    SELECT e.enviado_at,
      EXISTS(SELECT 1 FROM aperturas a WHERE a.email_id = e.id AND a.sospechosa = 0) AS abierto
    FROM emails e
    WHERE e.estado = 'enviado' AND e.enviado_at >= UTC_TIMESTAMP() - INTERVAL 15 DAY
  `);

  const [recientes] = await pool.query<RowDataPacket[]>(`
    SELECT * FROM (
      SELECT 'apertura' AS tipo, e.destinatario, e.asunto, a.abierto_at AS fecha
      FROM aperturas a JOIN emails e ON e.id = a.email_id
      WHERE a.sospechosa = 0
      UNION ALL
      SELECT 'clic' AS tipo, e.destinatario, e.asunto, c.click_at AS fecha
      FROM clics c JOIN emails e ON e.id = c.email_id
    ) x
    ORDER BY fecha DESC
    LIMIT 8
  `);

  return NextResponse.json({
    totales: {
      enviados: Number(totales.enviados),
      abiertos: Number(totales.abiertos),
      clicados: Number(totales.clicados),
      campanas: Number(totales.campanas),
    },
    serie: serie.map((r) => ({ enviado_at: r.enviado_at, abierto: Boolean(r.abierto) })),
    recientes,
  });
}
