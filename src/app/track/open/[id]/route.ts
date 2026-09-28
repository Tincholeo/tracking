import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import type { RowDataPacket } from "mysql2";
import { Resend } from "resend";
import { getPool } from "@/lib/db";
import { TRANSPARENT_PIXEL } from "@/lib/tracking";
import { esAperturaSospechosa } from "@/lib/botDetection";

async function notificarPrimeraAperturaReal(emailId: string) {
  const notifyTo = process.env.NOTIFY_EMAIL;
  if (!notifyTo) return;

  const pool = getPool();

  const [aperturaRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM aperturas WHERE email_id = ? AND sospechosa = 0",
    [emailId]
  );
  const totalAperturasReales = aperturaRows[0]?.total ?? 0;
  if (totalAperturasReales !== 1) return; // solo avisar la primera vez confiable

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

    // Se calcula en MySQL para no mezclar la zona horaria de la base con la de Vercel.
    const [emailRows] = await pool.query<(RowDataPacket & { seg: number })[]>(
      "SELECT TIMESTAMPDIFF(SECOND, enviado_at, NOW()) AS seg FROM emails WHERE id = ? LIMIT 1",
      [id]
    );
    const segundos = emailRows[0] ? Number(emailRows[0].seg) : null;
    const sospechosa = esAperturaSospechosa(userAgent, ip, segundos);

    await pool.query(
      "INSERT INTO aperturas (email_id, ip, user_agent, sospechosa) VALUES (?, ?, ?, ?)",
      [id, ip, userAgent, sospechosa]
    );

    if (!sospechosa) {
      after(async () => {
        try {
          await notificarPrimeraAperturaReal(id);
        } catch {
          // no romper nada si falla la notificación
        }
      });
    }
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
