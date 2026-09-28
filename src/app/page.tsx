"use client";

import { Fragment, useEffect, useState } from "react";

type EmailRow = {
  id: string;
  destinatario: string;
  asunto: string;
  enviado_at: string;
  campana_id: string | null;
};

type Aggregate = { email_id: string; total: number; primera_apertura?: string };

type Plantilla = { id: number; nombre: string; asunto: string; cuerpo: string };

export default function Home() {
  const [destinatarios, setDestinatarios] = useState("");
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [aperturas, setAperturas] = useState<Aggregate[]>([]);
  const [clics, setClics] = useState<Aggregate[]>([]);

  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState("");
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);

  const [campanasAbiertas, setCampanasAbiertas] = useState<Set<string>>(new Set());

  async function cargarHistorial() {
    const res = await fetch("/api/emails");
    if (!res.ok) return;
    const data = await res.json();
    setEmails(data.emails);
    setAperturas(data.aperturas);
    setClics(data.clics);
  }

  async function cargarPlantillas() {
    const res = await fetch("/api/templates");
    if (!res.ok) return;
    const data = await res.json();
    setPlantillas(data.plantillas);
  }

  useEffect(() => {
    cargarHistorial();
    cargarPlantillas();
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
      setMensaje("Completá asunto y cuerpo antes de guardar la plantilla.");
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
      setMensaje("Plantilla guardada.");
      cargarPlantillas();
    } else {
      const data = await res.json().catch(() => ({}));
      setMensaje(`Error al guardar plantilla: ${data.error ?? res.statusText}`);
    }
    setGuardandoPlantilla(false);
  }

  async function borrarPlantilla() {
    if (!plantillaSeleccionada) return;
    const plantilla = plantillas.find((p) => String(p.id) === plantillaSeleccionada);
    if (!plantilla) return;
    if (!window.confirm(`¿Borrar la plantilla "${plantilla.nombre}"?`)) return;

    const res = await fetch(`/api/templates/${plantillaSeleccionada}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setMensaje("Plantilla borrada.");
      setPlantillaSeleccionada("");
      cargarPlantillas();
    } else {
      setMensaje("Error al borrar la plantilla.");
    }
  }

  async function enviarCorreo(e: React.FormEvent) {
    e.preventDefault();

    const lista = destinatarios
      .split(/[\n,]+/)
      .map((d) => d.trim())
      .filter(Boolean);

    if (lista.length === 0) {
      setMensaje("Ingresá al menos un destinatario.");
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
      const fallidos = data.fallidos ?? [];
      setMensaje(
        fallidos.length > 0
          ? `Enviados: ${data.enviados}. Fallaron: ${fallidos
              .map((f: { destinatario: string }) => f.destinatario)
              .join(", ")}`
          : `Enviado a ${data.enviados} destinatario(s).`
      );
      setDestinatarios("");
      setAsunto("");
      setCuerpo("");
      cargarHistorial();
    } else {
      setMensaje(`Error: ${data.error ?? res.statusText}`);
    }
    setEnviando(false);
  }

  function aperturasDe(id: string) {
    return aperturas.find((a) => a.email_id === id)?.total ?? 0;
  }

  function clicsDe(id: string) {
    return clics.find((c) => c.email_id === id)?.total ?? 0;
  }

  function toggleCampana(campanaId: string) {
    setCampanasAbiertas((prev) => {
      const next = new Set(prev);
      if (next.has(campanaId)) next.delete(campanaId);
      else next.add(campanaId);
      return next;
    });
  }

  type Fila =
    | { tipo: "individual"; email: EmailRow }
    | { tipo: "campana"; campanaId: string; emails: EmailRow[] };

  const filas: Fila[] = [];
  const vistos = new Set<string>();
  for (const email of emails) {
    if (!email.campana_id) {
      filas.push({ tipo: "individual", email });
      continue;
    }
    if (vistos.has(email.campana_id)) continue;
    vistos.add(email.campana_id);
    filas.push({
      tipo: "campana",
      campanaId: email.campana_id,
      emails: emails.filter((e) => e.campana_id === email.campana_id),
    });
  }

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-10 py-16 px-6">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Email Tracker
        </h1>

        <form onSubmit={enviarCorreo} className="flex flex-col gap-3">
          {plantillas.length > 0 && (
            <div className="flex gap-2">
              <select
                className="flex-1 border rounded px-3 py-2 dark:bg-zinc-900"
                value={plantillaSeleccionada}
                onChange={(e) => usarPlantilla(e.target.value)}
              >
                <option value="">Usar una plantilla...</option>
                {plantillas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={borrarPlantilla}
                disabled={!plantillaSeleccionada}
                className="rounded border px-3 py-2 text-red-600 disabled:opacity-50 dark:text-red-400"
              >
                Borrar
              </button>
            </div>
          )}
          <textarea
            className="border rounded px-3 py-2 min-h-20 dark:bg-zinc-900"
            placeholder="Destinatario(s): uno por línea o separados por coma. Cada uno recibe su propio correo, sin ver a los demás."
            value={destinatarios}
            onChange={(e) => setDestinatarios(e.target.value)}
            required
          />
          <input
            className="border rounded px-3 py-2 dark:bg-zinc-900"
            placeholder="Asunto"
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            required
          />
          <textarea
            className="border rounded px-3 py-2 min-h-32 dark:bg-zinc-900"
            placeholder="Cuerpo del correo (HTML permitido)"
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            required
          />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={enviando}
              className="flex-1 rounded bg-black text-white px-4 py-2 disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {enviando ? "Enviando..." : "Enviar correo"}
            </button>
            <button
              type="button"
              onClick={guardarComoPlantilla}
              disabled={guardandoPlantilla}
              className="rounded border px-4 py-2 disabled:opacity-50"
            >
              Guardar como plantilla
            </button>
          </div>
          {mensaje && <p className="text-sm">{mensaje}</p>}
        </form>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-black dark:text-zinc-50">
            Historial
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Destinatario</th>
                <th>Asunto</th>
                <th>Enviado</th>
                <th>Aperturas</th>
                <th>Clics</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => {
                if (fila.tipo === "individual") {
                  const email = fila.email;
                  return (
                    <tr key={email.id} className="border-b">
                      <td className="py-2">{email.destinatario}</td>
                      <td>{email.asunto}</td>
                      <td>{new Date(email.enviado_at).toLocaleString()}</td>
                      <td>{aperturasDe(email.id)}</td>
                      <td>{clicsDe(email.id)}</td>
                    </tr>
                  );
                }

                const { campanaId, emails: miembros } = fila;
                const totalAperturas = miembros.reduce(
                  (acc, e) => acc + aperturasDe(e.id),
                  0
                );
                const totalClics = miembros.reduce(
                  (acc, e) => acc + clicsDe(e.id),
                  0
                );
                const abierta = campanasAbiertas.has(campanaId);

                return (
                  <Fragment key={campanaId}>
                    <tr
                      className="border-b cursor-pointer bg-zinc-100 dark:bg-zinc-900"
                      onClick={() => toggleCampana(campanaId)}
                    >
                      <td className="py-2">
                        {abierta ? "▾" : "▸"} Campaña ({miembros.length} destinatarios)
                      </td>
                      <td>{miembros[0].asunto}</td>
                      <td>{new Date(miembros[0].enviado_at).toLocaleString()}</td>
                      <td>{totalAperturas}</td>
                      <td>{totalClics}</td>
                    </tr>
                    {abierta &&
                      miembros.map((email) => (
                        <tr key={email.id} className="border-b text-zinc-500">
                          <td className="py-2 pl-6">{email.destinatario}</td>
                          <td>{email.asunto}</td>
                          <td>{new Date(email.enviado_at).toLocaleString()}</td>
                          <td>{aperturasDe(email.id)}</td>
                          <td>{clicsDe(email.id)}</td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
