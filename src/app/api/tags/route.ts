import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";

export async function GET() {
  const [filas] = await getPool().query<RowDataPacket[]>(
    `SELECT t.id, t.nombre, COUNT(ce.contacto_id) AS total
     FROM etiquetas t LEFT JOIN contacto_etiquetas ce ON ce.etiqueta_id = t.id
     GROUP BY t.id, t.nombre ORDER BY t.nombre`
  );
  return NextResponse.json({ etiquetas: filas.map((f) => ({ ...f, total: Number(f.total) })) });
}
