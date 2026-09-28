import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function GET() {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT id, nombre, asunto, cuerpo FROM plantillas ORDER BY nombre ASC"
  );
  return NextResponse.json({ plantillas: rows });
}

export async function POST(request: NextRequest) {
  const { nombre, asunto, cuerpo } = await request.json();

  if (!nombre || !asunto || !cuerpo) {
    return NextResponse.json(
      { error: "Faltan campos: nombre, asunto, cuerpo" },
      { status: 400 }
    );
  }

  const pool = getPool();
  const [result] = await pool.query(
    "INSERT INTO plantillas (nombre, asunto, cuerpo, creado_at) VALUES (?, ?, ?, UTC_TIMESTAMP())",
    [nombre, asunto, cuerpo]
  );

  return NextResponse.json({ id: (result as { insertId: number }).insertId });
}
