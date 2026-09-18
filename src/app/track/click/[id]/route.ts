import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/track/click/[id]">
) {
  const { id } = await ctx.params;
  const destino = request.nextUrl.searchParams.get("url");

  if (!destino) {
    return NextResponse.json({ error: "Falta el parámetro url" }, { status: 400 });
  }

  try {
    const pool = getPool();
    await pool.query(
      "INSERT INTO clics (email_id, url_destino) VALUES (?, ?)",
      [id, destino]
    );
  } catch {
    // no bloquear la redirección aunque falle el registro
  }

  return NextResponse.redirect(destino, 302);
}
