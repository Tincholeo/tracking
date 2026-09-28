"use client";

import { useEffect, useState } from "react";
import { formatFecha } from "@/lib/formato";

type Detalle = {
  email: {
    id: string;
    destinatario: string;
    asunto: string;
    cuerpo: string;
    estado: string;
    error_envio: string | null;
    enviado_at: string | null;
    con_baja: number;
    seguimiento_hecho: number;
    seg_condicion: "sin_apertura" | "sin_clic" | null;
    seg_dias: number | null;
    nombre: string | null;
    estado_contacto: string | null;
  };
  aperturas: { fecha: string; dispositivo: string; descartada: boolean }[];
  clics: { fecha: string; url: string; dispositivo: string }[];
  recordatorios: { id: string; asunto: string; estado: string; enviado_at: string | null }[];
  original: { id: string; asunto: string; enviado_at: string } | null;
};

type Evento = { fecha: string; titulo: string; detalle?: string; tipo: "envio" | "apertura" | "clic" | "recordatorio" | "descartada" };

const COLOR: Record<Evento["tipo"], string> = {
  envio: "bg-ink-2",
  apertura: "bg-series-2",
  clic: "bg-series-1",
  recordatorio: "bg-ink-2",
  descartada: "bg-line",
};

const ESTADOS: Record<string, string> = {
  pendiente: "En cola, sale cuando haya cupo diario",
  enviando: "Enviándose",
  error: "No se pudo enviar",
  omitido: "No se envió",
  rebotado: "Rebotó: la dirección no recibe correos",
};

function acortarUrl(url: string) {
  try {
    const u = new URL(url);
    return (u.host + u.pathname).replace(/\/$/, "");
  } catch {
    return url;
  }
}

export default function EmailDetail({ id, onCerrar, onAbrir }: { id: string; onCerrar: () => void; onAbrir: (id: string) => void }) {
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [verDescartadas, setVerDescartadas] = useState(false);

  useEffect(() => {
    fetch(`/api/emails/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setDetalle(d));
  }, [id]);

  useEffect(() => {
    const cerrarConEscape = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", cerrarConEscape);
    return () => window.removeEventListener("keydown", cerrarConEscape);
  }, [onCerrar]);

  const e = detalle?.email;
  const reales = detalle?.aperturas.filter((a) => !a.descartada) ?? [];
  const descartadas = detalle?.aperturas.filter((a) => a.descartada) ?? [];

  const eventos: Evento[] = [];
  if (detalle && e) {
    if (e.enviado_at && e.estado !== "pendiente") eventos.push({ fecha: e.enviado_at, titulo: "Enviado", tipo: "envio" });
    for (const a of reales) eventos.push({ fecha: a.fecha, titulo: "Abrió el correo", detalle: a.dispositivo, tipo: "apertura" });
    if (verDescartadas) {
      for (const a of descartadas)
        eventos.push({ fecha: a.fecha, titulo: "Apertura descartada (escáner automático)", detalle: a.dispositivo, tipo: "descartada" });
    }
    for (const k of detalle.clics)
      eventos.push({ fecha: k.fecha, titulo: `Hizo clic en ${acortarUrl(k.url)}`, detalle: k.dispositivo, tipo: "clic" });
    for (const r of detalle.recordatorios)
      if (r.enviado_at) eventos.push({ fecha: r.enviado_at, titulo: "Se envió el recordatorio automático", detalle: r.asunto, tipo: "recordatorio" });
    eventos.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  }

  let seguimiento: string | null = null;
  if (e?.seg_condicion && e.seg_dias) {
    const condicion = e.seg_condicion === "sin_apertura" ? "no lo abre" : "no hace clic";
    const base = `Recordatorio automático si ${condicion} en ${e.seg_dias} día${e.seg_dias === 1 ? "" : "s"}`;
    const rec = detalle?.recordatorios[0];
    if (rec) seguimiento = `${base}: ${rec.estado === "enviado" ? "enviado" : rec.estado === "pendiente" ? "en cola" : rec.estado}.`;
    else if (e.seguimiento_hecho) seguimiento = `${base}: no hizo falta, cumplió la condición.`;
    else if (e.enviado_at) {
      const vence = new Date(new Date(e.enviado_at).getTime() + e.seg_dias * 86400000);
      seguimiento = `${base}: se revisa a partir del ${formatFecha(vence.toISOString())}.`;
    } else seguimiento = `${base}.`;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onCerrar} role="dialog" aria-modal="true" aria-label="Detalle del correo">
      <aside className="flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-line bg-surface shadow-xl" onClick={(ev) => ev.stopPropagation()}>
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-line bg-surface px-5 py-4">
          <div className="min-w-0">
            <div className="truncate font-medium text-ink">{e?.nombre || e?.destinatario || "Cargando…"}</div>
            {e?.nombre && <div className="truncate text-sm text-muted">{e.destinatario}</div>}
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="rounded-md px-2 py-1 text-ink-2 hover:bg-surface-2">
            ✕
          </button>
        </div>

        {detalle && e && (
          <div className="flex flex-col gap-5 px-5 py-5 text-sm">
            <div>
              <div className="text-xs text-muted">Asunto</div>
              <div className="text-ink">{e.asunto}</div>
            </div>

            {e.estado !== "enviado" && (
              <p className={`rounded-lg bg-surface-2 px-3 py-2 ${e.estado === "pendiente" ? "text-ink-2" : "text-danger"}`}>
                {ESTADOS[e.estado] ?? e.estado}
                {e.error_envio && <span className="block text-xs text-ink-2">{e.error_envio}</span>}
              </p>
            )}
            {e.estado_contacto && e.estado_contacto !== "activo" && (
              <p className="rounded-lg bg-surface-2 px-3 py-2 text-danger">
                Este contacto está como <b>{e.estado_contacto}</b>: no se le envía nada más.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-line p-3">
                <div className="text-xs text-muted">Aperturas</div>
                <div className="text-xl font-semibold text-ink">{reales.length}</div>
              </div>
              <div className="rounded-lg border border-line p-3">
                <div className="text-xs text-muted">Clics</div>
                <div className="text-xl font-semibold text-ink">{detalle.clics.length}</div>
              </div>
            </div>

            {detalle.original && (
              <button onClick={() => onAbrir(detalle.original!.id)} className="rounded-lg bg-surface-2 px-3 py-2 text-left text-ink-2 hover:text-ink">
                Es un recordatorio de «{detalle.original.asunto}» ({formatFecha(detalle.original.enviado_at)}) →
              </button>
            )}
            {seguimiento && <p className="rounded-lg bg-surface-2 px-3 py-2 text-ink-2">{seguimiento}</p>}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-medium text-ink">Actividad</h3>
                {descartadas.length > 0 && (
                  <label className="flex items-center gap-1.5 text-xs text-muted">
                    <input type="checkbox" checked={verDescartadas} onChange={(ev) => setVerDescartadas(ev.target.checked)} />
                    Ver {descartadas.length} descartada(s)
                  </label>
                )}
              </div>
              {eventos.length === 0 ? (
                <p className="text-muted">Sin actividad todavía.</p>
              ) : (
                <ol className="relative ml-1.5 border-l border-line">
                  {eventos.map((ev, i) => (
                    <li key={i} className="mb-3 ml-4 last:mb-0">
                      <span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ${COLOR[ev.tipo]}`} />
                      <div className={ev.tipo === "descartada" ? "text-muted" : "text-ink"}>{ev.titulo}</div>
                      <div className="text-xs text-muted">
                        {formatFecha(ev.fecha)}
                        {ev.detalle && ` · ${ev.detalle}`}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div>
              <h3 className="mb-2 font-medium text-ink">Contenido enviado</h3>
              <iframe
                title="Contenido del correo"
                sandbox=""
                className="h-72 w-full rounded-lg border border-line bg-white"
                srcDoc={`<!doctype html><meta charset="utf-8"><body style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#111;line-height:1.5;margin:14px">${e.cuerpo}</body>`}
              />
              {e.con_baja ? <p className="mt-1 text-xs text-muted">Incluía el enlace para darse de baja.</p> : null}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
