import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/contacts/[id]">) {
  const { id } = await ctx.params;
  const { nombre, empresa } = await request.json();
  await getPool().query("UPDATE contactos SET nombre = ?, empresa = ? WHERE id = ?", [
    String(nombre ?? "").trim().slice(0, 255),
    String(empresa ?? "").trim().slice(0, 255),
    Number(id),
  ]);
  return NextResponse.json({ ok: true });
}
