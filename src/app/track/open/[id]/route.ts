import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { TRANSPARENT_PIXEL } from "@/lib/tracking";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/track/open/[id]">
) {
  const { id } = await ctx.params;
  const ip = request.headers.get("x-forwarded-for") ?? "";
  const userAgent = request.headers.get("user-agent") ?? "";

  try {
    const pool = getPool();
    await pool.query(
      "INSERT INTO aperturas (email_id, ip, user_agent) VALUES (?, ?, ?)",
      [id, ip, userAgent]
    );
  } catch {
    // no bloquear la entrega del pixel aunque falle el registro
  }

  return new NextResponse(TRANSPARENT_PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}
