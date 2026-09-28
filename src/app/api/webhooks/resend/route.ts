import { Resend } from "resend";
import { getPool } from "@/lib/db";
import { marcarContacto } from "@/lib/contacts";

// Público: lo llama Resend. La firma (Svix) se verifica con RESEND_WEBHOOK_SECRET.
export async function POST(request: Request) {
  const secreto = process.env.RESEND_WEBHOOK_SECRET;
  if (!secreto) return new Response("Webhook no configurado", { status: 500 });

  const payload = await request.text();
  let evento;
  try {
    evento = new Resend(process.env.RESEND_API_KEY).webhooks.verify({
      payload,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret: secreto,
    });
  } catch {
    return new Response("Firma inválida", { status: 400 });
  }

  if (!("data" in evento) || !evento.type.startsWith("email.")) return Response.json({ ok: true });
  const data = evento.data as { email_id?: string; to?: string[] };
  const destinatario = data.to?.[0];
  const pool = getPool();

  if (evento.type === "email.bounced") {
    const { bounce } = evento.data;
    const permanente = bounce.type?.toLowerCase() === "permanent";
    const detalle = `Rebote ${permanente ? "permanente" : "temporal"}: ${bounce.message}`.slice(0, 500);
    await pool.query(
      `UPDATE emails SET error_envio = ?${permanente ? ", estado = 'rebotado'" : ""} WHERE resend_id = ?`,
      [detalle, data.email_id]
    );
    if (permanente && destinatario) await marcarContacto(destinatario, "rebotado", detalle);
  } else if (evento.type === "email.complained" && destinatario) {
    await marcarContacto(destinatario, "queja", "Marcó el correo como spam");
  } else if (evento.type === "email.suppressed" && destinatario) {
    await pool.query(
      "UPDATE emails SET estado = 'rebotado', error_envio = ? WHERE resend_id = ?",
      ["Resend no lo envió: la dirección está suprimida por rebotes o quejas previas", data.email_id]
    );
    await marcarContacto(destinatario, "rebotado", "Dirección suprimida por Resend");
  } else if (evento.type === "email.failed") {
    await pool.query("UPDATE emails SET estado = 'error', error_envio = ? WHERE resend_id = ?", [
      "Resend no pudo enviarlo",
      data.email_id,
    ]);
  }

  return Response.json({ ok: true });
}
