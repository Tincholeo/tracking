import type { RowDataPacket } from "mysql2";
import { Resend } from "resend";
import { getPool } from "@/lib/db";
import { escapeHtml } from "@/lib/html";

const ZONA = "America/Argentina/Buenos_Aires";

const ABIERTO = "EXISTS(SELECT 1 FROM aperturas a WHERE a.email_id = e.id AND a.sospechosa = 0)";
const CLICADO = "EXISTS(SELECT 1 FROM clics c WHERE c.email_id = e.id)";
const SEMANA = "e.enviado_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY";

type Totales = { enviados: number; abiertos: number; clicados: number };

async function totales(desdeDias: number, hastaDias: number): Promise<Totales> {
  const [[fila]] = await getPool().query<RowDataPacket[]>(
    `SELECT COUNT(*) AS enviados,
       COALESCE(SUM(${ABIERTO}), 0) AS abiertos,
       COALESCE(SUM(${CLICADO}), 0) AS clicados
     FROM emails e
     WHERE e.enviado_at >= UTC_TIMESTAMP() - INTERVAL ? DAY
       AND e.enviado_at < UTC_TIMESTAMP() - INTERVAL ? DAY`,
    [desdeDias, hastaDias]
  );
  return {
    enviados: Number(fila.enviados),
    abiertos: Number(fila.abiertos),
    clicados: Number(fila.clicados),
  };
}

function tasa(parte: number, total: number) {
  return total ? Math.round((parte / total) * 100) : 0;
}

function variacion(actual: number, anterior: number, sufijo = "") {
  const diff = actual - anterior;
  if (diff === 0) return "igual que la semana anterior";
  return `${diff > 0 ? "▲" : "▼"} ${Math.abs(diff)}${sufijo} vs semana anterior`;
}

function fecha(d: Date) {
  return d.toLocaleDateString("es-AR", { timeZone: ZONA, day: "numeric", month: "short" });
}

function bloque(titulo: string, valor: string, detalle: string) {
  return `<td style="padding:12px;border:1px solid #e1e0d9;border-radius:8px;width:33%;vertical-align:top">
    <div style="font-size:13px;color:#52514e">${titulo}</div>
    <div style="font-size:26px;font-weight:600;color:#0b0b0b;margin:4px 0">${valor}</div>
    <div style="font-size:12px;color:#7a7873">${detalle}</div>
  </td>`;
}

function seccion(titulo: string, contenido: string) {
  return `<h2 style="font-size:16px;font-weight:600;color:#0b0b0b;margin:28px 0 8px">${titulo}</h2>${contenido}`;
}

function tabla(encabezados: string[], filas: string[][]) {
  const th = encabezados
    .map((h) => `<th style="text-align:left;padding:6px 8px;font-size:12px;color:#52514e;border-bottom:1px solid #e1e0d9">${h}</th>`)
    .join("");
  const tr = filas
    .map(
      (f) =>
        `<tr>${f.map((c) => `<td style="padding:6px 8px;font-size:13px;color:#0b0b0b;border-bottom:1px solid #f0efec">${c}</td>`).join("")}</tr>`
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse">${th ? `<tr>${th}</tr>` : ""}${tr}</table>`;
}

export async function construirReporteSemanal() {
  const pool = getPool();
  const actual = await totales(7, 0);
  const anterior = await totales(14, 7);

  const [campanas] = await pool.query<RowDataPacket[]>(
    `SELECT c.asunto, COUNT(e.id) AS total,
       COALESCE(SUM(${ABIERTO}), 0) AS abiertos,
       COALESCE(SUM(${CLICADO}), 0) AS clicados
     FROM campanas c JOIN emails e ON e.campana_id = c.id
     WHERE c.creado_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY
     GROUP BY c.id, c.asunto, c.creado_at
     ORDER BY c.creado_at DESC`
  );

  const [activos] = await pool.query<RowDataPacket[]>(
    `SELECT e.destinatario, e.asunto,
       (SELECT COUNT(*) FROM aperturas a WHERE a.email_id = e.id AND a.sospechosa = 0) AS aperturas,
       (SELECT COUNT(*) FROM clics c WHERE c.email_id = e.id) AS clics
     FROM emails e
     WHERE ${SEMANA}
     HAVING aperturas + clics > 0
     ORDER BY clics DESC, aperturas DESC
     LIMIT 5`
  );

  const [sinAbrir] = await pool.query<RowDataPacket[]>(
    `SELECT e.destinatario, e.asunto, e.enviado_at
     FROM emails e
     WHERE ${SEMANA} AND NOT ${ABIERTO}
     ORDER BY e.enviado_at DESC`
  );

  const hoy = new Date();
  const inicio = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);
  const rango = `${fecha(inicio)} – ${fecha(hoy)}`;
  const tasaApertura = tasa(actual.abiertos, actual.enviados);
  const tasaClic = tasa(actual.clicados, actual.enviados);

  let cuerpo = `<p style="font-size:14px;color:#52514e;margin:0 0 16px">Semana del ${rango}</p>`;

  if (actual.enviados === 0) {
    cuerpo += `<p style="font-size:14px;color:#0b0b0b">No enviaste correos esta semana.</p>`;
  } else {
    cuerpo += `<table style="width:100%;border-collapse:separate;border-spacing:8px 0;margin:0 -8px"><tr>
      ${bloque("Enviados", String(actual.enviados), variacion(actual.enviados, anterior.enviados))}
      ${bloque("Tasa de apertura", `${tasaApertura}%`, `${actual.abiertos} abiertos · ${variacion(tasaApertura, tasa(anterior.abiertos, anterior.enviados), " pts")}`)}
      ${bloque("Tasa de clics", `${tasaClic}%`, `${actual.clicados} con clic · ${variacion(tasaClic, tasa(anterior.clicados, anterior.enviados), " pts")}`)}
    </tr></table>`;

    if (campanas.length > 0) {
      cuerpo += seccion(
        "Campañas",
        tabla(
          ["Asunto", "Destinatarios", "Abrieron", "Clic"],
          campanas.map((c) => [
            escapeHtml(String(c.asunto).trim()),
            String(c.total),
            `${c.abiertos} (${tasa(Number(c.abiertos), Number(c.total))}%)`,
            `${c.clicados} (${tasa(Number(c.clicados), Number(c.total))}%)`,
          ])
        )
      );
    }

    if (activos.length > 0) {
      cuerpo += seccion(
        "Más activos",
        tabla(
          ["Destinatario", "Asunto", "Aperturas", "Clics"],
          activos.map((a) => [
            escapeHtml(a.destinatario),
            escapeHtml(String(a.asunto).trim()),
            String(a.aperturas),
            String(a.clics),
          ])
        )
      );
    }

    if (sinAbrir.length > 0) {
      const mostrados = sinAbrir.slice(0, 15);
      const resto = sinAbrir.length - mostrados.length;
      cuerpo += seccion(
        `Sin abrir (${sinAbrir.length}) — candidatos a seguimiento`,
        tabla(
          ["Destinatario", "Asunto", "Enviado"],
          mostrados.map((s) => [escapeHtml(s.destinatario), escapeHtml(String(s.asunto).trim()), fecha(new Date(s.enviado_at))])
        ) + (resto > 0 ? `<p style="font-size:12px;color:#7a7873">…y ${resto} más.</p>` : "")
      );
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (baseUrl) {
    cuerpo += `<p style="margin:28px 0 0"><a href="${baseUrl}" style="display:inline-block;background:#0b0b0b;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px">Abrir el dashboard</a></p>`;
  }

  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px">
    <h1 style="font-size:20px;font-weight:600;color:#0b0b0b;margin:0 0 4px">Reporte semanal</h1>
    ${cuerpo}
  </div>`;

  return { asunto: `Reporte semanal · ${rango}`, html };
}

export async function enviarReporteSemanal() {
  const destino = process.env.NOTIFY_EMAIL;
  if (!destino) throw new Error("Falta la variable NOTIFY_EMAIL");

  const { asunto, html } = await construirReporteSemanal();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: destino,
    subject: asunto,
    html,
  });
  if (error) throw new Error(error.message);
  return destino;
}
