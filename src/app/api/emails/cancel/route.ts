import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";

// Cancela correos que todavía no salieron (en cola o programados).
export async function POST(request: NextRequest) {
  const { ids, campanaId } = (await request.json()) as { ids?: string[]; campanaId?: string };
  const pool = getPool();

  let resultado;
  if (campanaId) {
    [resultado] = await pool.query(
      "UPDATE emails SET estado = 'cancelado', error_envio = 'Cancelado a mano' WHERE estado = 'pendiente' AND campana_id = ?",
      [campanaId]
    );
  } else if (ids?.length) {
    [resultado] = await pool.query(
      "UPDATE emails SET estado = 'cancelado', error_envio = 'Cancelado a mano' WHERE estado = 'pendiente' AND id IN (?)",
      [ids]
    );
  } else {
    return NextResponse.json({ error: "No se indicó qué cancelar" }, { status: 400 });
  }

  return NextResponse.json({ cancelados: (resultado as { affectedRows: number }).affectedRows });
}
