import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function GET() {
  const pool = getPool();

  const [emails] = await pool.query(
    "SELECT id, destinatario, asunto, enviado_at, campana_id FROM emails ORDER BY enviado_at DESC LIMIT 200"
  );
  const [aperturas] = await pool.query(
    "SELECT email_id, COUNT(*) AS total, MIN(abierto_at) AS primera_apertura FROM aperturas WHERE sospechosa = 0 GROUP BY email_id"
  );
  const [clics] = await pool.query(
    "SELECT email_id, COUNT(*) AS total FROM clics GROUP BY email_id"
  );

  return NextResponse.json({ emails, aperturas, clics });
}
