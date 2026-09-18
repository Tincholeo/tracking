import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { randomUUID } from "crypto";
import { getPool } from "@/lib/db";
import { injectTracking } from "@/lib/tracking";

export async function POST(request: NextRequest) {
  const { destinatario, asunto, cuerpo, userId } = await request.json();

  if (!destinatario || !asunto || !cuerpo) {
    return NextResponse.json(
      { error: "Faltan campos: destinatario, asunto, cuerpo" },
      { status: 400 }
    );
  }

  const emailId = randomUUID();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const trackedHtml = injectTracking(cuerpo, emailId, baseUrl!);

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: destinatario,
    subject: asunto,
    html: trackedHtml,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  const pool = getPool();
  await pool.query(
    "INSERT INTO emails (id, destinatario, asunto, cuerpo, user_id) VALUES (?, ?, ?, ?, ?)",
    [emailId, destinatario, asunto, cuerpo, userId ?? "default"]
  );

  return NextResponse.json({ id: emailId });
}
