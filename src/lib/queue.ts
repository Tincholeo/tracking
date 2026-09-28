import type { RowDataPacket } from "mysql2";
import { randomUUID } from "crypto";
import { Resend } from "resend";
import { getPool } from "@/lib/db";
import { injectTracking } from "@/lib/tracking";

// Resend cuenta el cupo por día calendario UTC (se reinicia a las 00:00 UTC).
// La reserva deja lugar para los avisos de apertura y el reporte semanal,
// que salen de la misma cuenta.
const LIMITE_DIARIO = Number(process.env.ENVIO_LIMITE_DIARIO ?? 100);
const RESERVA = Number(process.env.ENVIO_RESERVA_DIARIA ?? 10);
const MAX_POR_LOTE = 100; // máximo del endpoint batch de Resend

export async function estadoCola() {
  const [[fila]] = await getPool().query<RowDataPacket[]>(`
    SELECT
      (SELECT COUNT(*) FROM emails WHERE estado = 'pendiente') AS pendientes,
      (SELECT COUNT(*) FROM emails
         WHERE estado IN ('enviado', 'enviando') AND enviado_at >= UTC_DATE()) AS usados_hoy
  `);
  const usadosHoy = Number(fila.usados_hoy);
  return {
    pendientes: Number(fila.pendientes),
    usadosHoy,
    limite: LIMITE_DIARIO,
    reserva: RESERVA,
    disponibles: Math.max(0, LIMITE_DIARIO - RESERVA - usadosHoy),
  };
}

export async function procesarCola() {
  const pool = getPool();

  // Un envío que quedó a medias (la función se cortó) no se reintenta solo:
  // Resend pudo haberlo aceptado y se duplicaría.
  await pool.query(
    `UPDATE emails SET estado = 'error', lote = NULL,
       error_envio = 'Envío interrumpido: revisá en Resend si llegó antes de reenviar'
     WHERE estado = 'enviando' AND enviado_at < UTC_TIMESTAMP() - INTERVAL 15 MINUTE`
  );

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!;
  const resend = new Resend(process.env.RESEND_API_KEY);
  let enviados = 0;
  let fallidos = 0;
  let error: string | null = null;

  for (;;) {
    const { disponibles } = await estadoCola();
    const cantidad = Math.min(disponibles, MAX_POR_LOTE);
    if (cantidad <= 0) break;

    // Reclamar el lote de forma atómica evita que el cron y un envío manual
    // simultáneo manden el mismo correo dos veces.
    const lote = randomUUID();
    const [reclamo] = await pool.query(
      `UPDATE emails SET estado = 'enviando', lote = ?, enviado_at = UTC_TIMESTAMP()
       WHERE estado = 'pendiente' ORDER BY creado_at, id LIMIT ?`,
      [lote, cantidad]
    );
    if ((reclamo as { affectedRows: number }).affectedRows === 0) break;

    const [filas] = await pool.query<RowDataPacket[]>(
      "SELECT id, destinatario, asunto, cuerpo FROM emails WHERE lote = ? ORDER BY creado_at, id",
      [lote]
    );

    const respuesta = await resend.batch.send(
      filas.map((f) => ({
        from: process.env.RESEND_FROM_EMAIL!,
        to: f.destinatario,
        subject: f.asunto,
        html: injectTracking(f.cuerpo, f.id, baseUrl),
      })),
      { batchValidation: "permissive" }
    );

    if (respuesta.error) {
      await pool.query(
        "UPDATE emails SET estado = 'pendiente', lote = NULL, enviado_at = NULL WHERE lote = ?",
        [lote]
      );
      error = respuesta.error.message;
      break;
    }

    const errores = respuesta.data?.errors ?? [];
    for (const e of errores) {
      const fila = filas[e.index];
      if (!fila) continue;
      await pool.query(
        "UPDATE emails SET estado = 'error', lote = NULL, enviado_at = NULL, error_envio = ? WHERE id = ?",
        [e.message.slice(0, 500), fila.id]
      );
    }
    const [marcados] = await pool.query(
      "UPDATE emails SET estado = 'enviado', lote = NULL WHERE lote = ? AND estado = 'enviando'",
      [lote]
    );
    enviados += (marcados as { affectedRows: number }).affectedRows;
    fallidos += errores.length;
  }

  return { enviados, fallidos, error, ...(await estadoCola()) };
}
