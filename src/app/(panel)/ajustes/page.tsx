"use client";

import { useEffect, useState } from "react";

type Datos = {
  ajustes: { nombreRemitente: string; responderA: string };
  direccion: string;
  nombrePorDefecto: string;
};

export default function Ajustes() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [nombre, setNombre] = useState("");
  const [responderA, setResponderA] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; ok: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Datos | null) => {
        if (!d) return;
        setDatos(d);
        setNombre(d.ajustes.nombreRemitente);
        setResponderA(d.ajustes.responderA);
      });
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombreRemitente: nombre, responderA }),
    });
    const data = await res.json().catch(() => ({}));
    setGuardando(false);
    setAviso(res.ok ? { texto: "Ajustes guardados. Se aplican a los próximos envíos.", ok: true } : { texto: data.error ?? "No se pudo guardar.", ok: false });
  }

  if (!datos) return <p className="text-muted">Cargando…</p>;

  const nombreVisible = nombre.trim() || datos.nombrePorDefecto;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Ajustes</h1>

      <form onSubmit={guardar} className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5">
        <h2 className="font-medium">Remitente</h2>

        <label className="flex flex-col gap-1.5 text-sm text-ink-2">
          Nombre que ve el destinatario
          <input
            className="field"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={datos.nombrePorDefecto || "Tu nombre o el de tu empresa"}
            maxLength={100}
          />
          <span className="text-xs text-muted">Vacío = el nombre configurado en el servidor{datos.nombrePorDefecto ? ` («${datos.nombrePorDefecto}»)` : ""}.</span>
        </label>

        <div className="flex flex-col gap-1.5 text-sm text-ink-2">
          Dirección de envío
          <div className="field bg-surface-2 text-ink-2">{datos.direccion}</div>
          <span className="text-xs text-muted">
            Tiene que ser del dominio verificado en Resend, por eso no se cambia desde acá.
          </span>
        </div>

        <label className="flex flex-col gap-1.5 text-sm text-ink-2">
          Las respuestas llegan a
          <input
            className="field"
            type="email"
            value={responderA}
            onChange={(e) => setResponderA(e.target.value)}
            placeholder={datos.direccion}
          />
          <span className="text-xs text-muted">
            Cuando alguien toca «Responder», el correo va a esta dirección (por ejemplo tu Gmail). Vacío = a la dirección de envío.
          </span>
        </label>

        <div className="rounded-lg bg-surface-2 px-4 py-3 text-sm">
          <div className="text-xs text-muted">Así lo ve el destinatario</div>
          <div className="text-ink">
            De: {nombreVisible ? `${nombreVisible} <${datos.direccion}>` : datos.direccion}
          </div>
          <div className="text-ink-2">Responder a: {responderA.trim() || datos.direccion}</div>
        </div>

        <button type="submit" disabled={guardando} className="self-start rounded-lg bg-ink px-4 py-2.5 font-medium text-page disabled:opacity-50">
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        {aviso && <p className={`text-sm ${aviso.ok ? "text-success" : "text-danger"}`}>{aviso.texto}</p>}
      </form>
    </div>
  );
}
