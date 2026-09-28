import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

// Borra la etiqueta y la quita de todos los contactos (los contactos quedan).
export async function DELETE(_request: Request, ctx: RouteContext<"/api/tags/[id]">) {
  const { id } = await ctx.params;
  await getPool().query("DELETE FROM etiquetas WHERE id = ?", [Number(id)]);
  return NextResponse.json({ ok: true });
}
