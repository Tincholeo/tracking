import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import { extractLinks } from "@/lib/tracking";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/track/click/[id]">
) {
  const { id } = await ctx.params;
  const destino = request.nextUrl.searchParams.get("url");

  if (!destino) {
    return NextResponse.json({ error: "Falta el parámetro url" }, { status: 400 });
  }

  const pool = getPool();

  const [rows] = await pool.query<(RowDataPacket & { cuerpo: string })[]>(
    "SELECT cuerpo FROM emails WHERE id = ? LIMIT 1",
    [id]
  );
  const email = rows[0];

  if (!email || !extractLinks(email.cuerpo).includes(destino)) {
    return NextResponse.json({ error: "Link no reconocido" }, { status: 400 });
  }

  try {
    await pool.query(
      "INSERT INTO clics (email_id, url_destino, click_at, ip, user_agent) VALUES (?, ?, UTC_TIMESTAMP(), ?, ?)",
      [
        id,
        destino,
        (request.headers.get("x-forwarded-for") ?? "").slice(0, 64),
        (request.headers.get("user-agent") ?? "").slice(0, 500),
      ]
    );
  } catch {
    // no bloquear la redirección aunque falle el registro
  }

  return NextResponse.redirect(destino, 302);
}
