import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import type { RowDataPacket } from "mysql2";
import { Resend } from "resend";
import { getPool } from "@/lib/db";
import { TRANSPARENT_PIXEL } from "@/lib/tracking";

async function notificarPrimeraApertura(emailId: string) {
  const notifyTo = process.env.NOTIFY_EMAIL;
  if (!notifyTo) return;

  const pool = getPool();

  const [aperturaRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM aperturas WHERE email_id = ?",
    [emailId]
  );
  const totalAperturas = aperturaRows[0]?.total ?? 0;
  if (totalAperturas !== 1) return; // solo avisar la primera vez

  const [emailRows] = await pool.query<(RowDataPacket & {
    destinatario: string;
    asunto: string;
  })[]>("SELECT destinatario, asunto FROM emails WHERE id = ? LIMIT 1", [emailId]);
  const email = emailRows[0];
  if (!email) return;

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: notifyTo,
    subject: `Tu correo "${email.asunto}" fue abierto`,
    html: `<p>${email.destinatario} abrió el correo "${email.asunto}" recién.</p>`,
  });
}

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

  after(async () => {
    try {
      await notificarPrimeraApertura(id);
    } catch {
      // no romper nada si falla la notificación
    }
  });

  return new NextResponse(TRANSPARENT_PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}
