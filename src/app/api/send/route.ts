import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { randomUUID } from "crypto";
import { getPool } from "@/lib/db";
import { injectTracking } from "@/lib/tracking";

const MAX_DESTINATARIOS = 50;

export async function POST(request: NextRequest) {
  const { destinatarios, asunto, cuerpo, userId } = await request.json();

  const lista: string[] = Array.isArray(destinatarios)
    ? destinatarios.map((d) => String(d).trim()).filter(Boolean)
    : [];

  if (lista.length === 0 || !asunto || !cuerpo) {
    return NextResponse.json(
      { error: "Faltan campos: destinatarios, asunto, cuerpo" },
      { status: 400 }
    );
  }

  if (lista.length > MAX_DESTINATARIOS) {
    return NextResponse.json(
      { error: `Máximo ${MAX_DESTINATARIOS} destinatarios por envío` },
      { status: 400 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const pool = getPool();

  const esCampana = lista.length > 1;
  const campanaId = esCampana ? randomUUID() : null;

  if (campanaId) {
    await pool.query(
      "INSERT INTO campanas (id, nombre, asunto, creado_at) VALUES (?, ?, ?, UTC_TIMESTAMP())",
      [campanaId, asunto, asunto]
    );
  }

  const resultados: { destinatario: string; id?: string; error?: string }[] = [];

  for (const destinatario of lista) {
    const emailId = randomUUID();
    // Cada destinatario recibe un correo individual (no CC/BCC), así que
    // nadie ve al resto de la lista, y cada uno tiene su propio pixel/links.
    const trackedHtml = injectTracking(cuerpo, emailId, baseUrl);

    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: destinatario,
      subject: asunto,
      html: trackedHtml,
    });

    if (error) {
      resultados.push({ destinatario, error: error.message });
      continue;
    }

    await pool.query(
      "INSERT INTO emails (id, destinatario, asunto, cuerpo, user_id, campana_id, enviado_at) VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())",
      [emailId, destinatario, asunto, cuerpo, userId ?? "default", campanaId]
    );
    resultados.push({ destinatario, id: emailId });
  }

  const fallidos = resultados.filter((r) => r.error);

  return NextResponse.json({
    campanaId,
    enviados: resultados.length - fallidos.length,
    fallidos,
  });
}
