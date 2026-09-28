import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import { marcarContacto } from "@/lib/contacts";

export async function POST(request: NextRequest) {
  const { ids, estado } = (await request.json()) as { ids?: number[]; estado?: string };
  if (estado !== "activo" && estado !== "baja") {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }
  const validos = (ids ?? []).filter((n) => Number.isInteger(n) && n > 0);
  if (validos.length === 0) return NextResponse.json({ error: "No se indicaron contactos" }, { status: 400 });

  const [filas] = await getPool().query<RowDataPacket[]>("SELECT email FROM contactos WHERE id IN (?)", [validos]);
  for (const f of filas) {
    await marcarContacto(f.email, estado, estado === "baja" ? "Marcado a mano" : null);
  }
  return NextResponse.json({ actualizados: filas.length });
}
