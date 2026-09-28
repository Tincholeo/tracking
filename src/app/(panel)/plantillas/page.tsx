"use client";

import { useEffect, useState } from "react";
import EmailEditor from "@/components/EmailEditor";

type Plantilla = { id: number; nombre: string; asunto: string; cuerpo: string };

function textoPlano(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export default function Plantillas() {
  const [plantillas, setPlantillas] = useState<Plantilla[] | null>(null);
  const [nombre, setNombre] = useState("");
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  function cargar() {
    return fetch("/api/templates")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setPlantillas(data.plantillas));
  }

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setPlantillas(data.plantillas));
  }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!cuerpo.trim()) {
      setMensaje("El mensaje está vacío.");
      return;
    }
    setGuardando(true);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, asunto, cuerpo }),
    });
    if (res.ok) {
      setNombre("");
      setAsunto("");
      setCuerpo("");
      setEditorKey((k) => k + 1);
      setMensaje(null);
      cargar();
    } else {
      const data = await res.json().catch(() => ({}));
      setMensaje(`Error: ${data.error ?? res.statusText}`);
    }
    setGuardando(false);
  }

  async function borrar(p: Plantilla) {
    if (!window.confirm(`¿Borrar la plantilla "${p.nombre}"?`)) return;
    const res = await fetch(`/api/templates/${p.id}`, { method: "DELETE" });
    if (res.ok) cargar();
    else setMensaje("Error al borrar la plantilla.");
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Plantillas</h1>

      {plantillas === null ? (
        <p className="text-muted">Cargando…</p>
      ) : plantillas.length === 0 ? (
        <p className="text-sm text-muted">No tenés plantillas guardadas todavía.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {plantillas.map((p) => (
            <li key={p.id} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-ink">{p.nombre}</div>
                  <div className="truncate text-sm text-ink-2">{p.asunto}</div>
                </div>
                <button
                  onClick={() => borrar(p)}
                  className="shrink-0 rounded-lg px-2 py-1 text-sm text-danger hover:bg-surface-2"
                >
                  Borrar
                </button>
              </div>
              <p className="line-clamp-2 text-sm text-muted">{textoPlano(p.cuerpo)}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={crear} className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
        <h2 className="font-medium">Nueva plantilla</h2>
        <label className="flex flex-col gap-1.5 text-sm text-ink-2">
          Nombre
          <input className="field" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-ink-2">
          Asunto
          <input className="field" value={asunto} onChange={(e) => setAsunto(e.target.value)} required />
        </label>
        <div className="flex flex-col gap-1.5 text-sm text-ink-2">
          Mensaje
          <EmailEditor key={editorKey} value={cuerpo} onChange={setCuerpo} minHeight={160} />
        </div>
        <button
          type="submit"
          disabled={guardando}
          className="self-start rounded-lg bg-ink px-4 py-2.5 font-medium text-page disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar plantilla"}
        </button>
        {mensaje && <p className="text-sm text-danger">{mensaje}</p>}
      </form>
    </div>
  );
}
