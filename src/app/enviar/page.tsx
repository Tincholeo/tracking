"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Plantilla = { id: number; nombre: string; asunto: string; cuerpo: string };

export default function Enviar() {
  const [destinatarios, setDestinatarios] = useState("");
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; ok: boolean } | null>(null);

  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState("");
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);

  const lista = destinatarios
    .split(/[\n,]+/)
    .map((d) => d.trim())
    .filter(Boolean);

  function cargarPlantillas() {
    return fetch("/api/templates")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setPlantillas(data.plantillas));
  }

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setPlantillas(data.plantillas));
  }, []);

  function usarPlantilla(id: string) {
    setPlantillaSeleccionada(id);
    const plantilla = plantillas.find((p) => String(p.id) === id);
    if (plantilla) {
      setAsunto(plantilla.asunto);
      setCuerpo(plantilla.cuerpo);
    }
  }

  async function guardarComoPlantilla() {
    if (!asunto || !cuerpo) {
      setMensaje({ texto: "Completá asunto y cuerpo antes de guardar la plantilla.", ok: false });
      return;
    }
    const nombre = window.prompt("Nombre para esta plantilla:", asunto);
    if (!nombre) return;

    setGuardandoPlantilla(true);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, asunto, cuerpo }),
    });
    if (res.ok) {
      setMensaje({ texto: "Plantilla guardada.", ok: true });
      cargarPlantillas();
    } else {
      const data = await res.json().catch(() => ({}));
      setMensaje({ texto: `Error al guardar plantilla: ${data.error ?? res.statusText}`, ok: false });
    }
    setGuardandoPlantilla(false);
  }

  async function enviarCorreo(e: React.FormEvent) {
    e.preventDefault();
    if (lista.length === 0) {
      setMensaje({ texto: "Ingresá al menos un destinatario.", ok: false });
      return;
    }

    setEnviando(true);
    setMensaje(null);

    const res = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destinatarios: lista, asunto, cuerpo }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      const fallidos: { destinatario: string }[] = data.fallidos ?? [];
      setMensaje(
        fallidos.length > 0
          ? {
              texto: `Enviados: ${data.enviados}. Fallaron: ${fallidos.map((f) => f.destinatario).join(", ")}`,
              ok: false,
            }
          : { texto: `Enviado a ${data.enviados} destinatario(s).`, ok: true }
      );
      setDestinatarios("");
      setAsunto("");
      setCuerpo("");
      setPlantillaSeleccionada("");
    } else {
      setMensaje({ texto: `Error: ${data.error ?? res.statusText}`, ok: false });
    }
    setEnviando(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Enviar correo</h1>

      <form onSubmit={enviarCorreo} className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
        {plantillas.length > 0 && (
          <label className="flex flex-col gap-1.5 text-sm text-ink-2">
            Plantilla
            <select className="field" value={plantillaSeleccionada} onChange={(e) => usarPlantilla(e.target.value)}>
              <option value="">Sin plantilla</option>
              {plantillas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1.5 text-sm text-ink-2">
          <span className="flex justify-between">
            Destinatarios
            {lista.length > 1 && <span className="text-muted">{lista.length} destinatarios · se enviará como campaña</span>}
          </span>
          <textarea
            className="field min-h-20"
            placeholder="Uno por línea o separados por coma"
            value={destinatarios}
            onChange={(e) => setDestinatarios(e.target.value)}
            required
          />
          <span className="text-xs text-muted">Cada destinatario recibe su propio correo y no ve a los demás.</span>
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-ink-2">
          Asunto
          <input className="field" value={asunto} onChange={(e) => setAsunto(e.target.value)} required />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-ink-2">
          Cuerpo (se permite HTML)
          <textarea className="field min-h-48 font-mono text-sm" value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} required />
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={enviando}
            className="flex-1 rounded-lg bg-ink px-4 py-2.5 font-medium text-page disabled:opacity-50"
          >
            {enviando ? "Enviando…" : lista.length > 1 ? `Enviar a ${lista.length} destinatarios` : "Enviar correo"}
          </button>
          <button
            type="button"
            onClick={guardarComoPlantilla}
            disabled={guardandoPlantilla}
            className="rounded-lg border border-line px-4 py-2.5 text-ink hover:bg-surface-2 disabled:opacity-50"
          >
            Guardar como plantilla
          </button>
        </div>

        {mensaje && (
          <p className={`text-sm ${mensaje.ok ? "text-success" : "text-danger"}`}>
            {mensaje.texto}{" "}
            {mensaje.ok && mensaje.texto.startsWith("Enviado") && (
              <Link href="/historial" className="underline">
                Ver en historial
              </Link>
            )}
          </p>
        )}
      </form>
    </div>
  );
}
