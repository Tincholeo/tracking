import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/templates/[id]">
) {
  const { id } = await ctx.params;
  const pool = getPool();
  await pool.query("DELETE FROM plantillas WHERE id = ?", [id]);
  return NextResponse.json({ ok: true });
}
