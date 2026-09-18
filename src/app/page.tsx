"use client";

import { useEffect, useState } from "react";

type EmailRow = {
  id: string;
  destinatario: string;
  asunto: string;
  enviado_at: string;
};

type Aggregate = { email_id: string; total: number; primera_apertura?: string };

export default function Home() {
  const [destinatario, setDestinatario] = useState("");
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [aperturas, setAperturas] = useState<Aggregate[]>([]);
  const [clics, setClics] = useState<Aggregate[]>([]);

  async function cargarHistorial() {
    const res = await fetch("/api/emails");
    if (!res.ok) return;
    const data = await res.json();
    setEmails(data.emails);
    setAperturas(data.aperturas);
    setClics(data.clics);
  }

  useEffect(() => {
    cargarHistorial();
  }, []);

  async function enviarCorreo(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setMensaje(null);

    const res = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destinatario, asunto, cuerpo }),
    });

    if (res.ok) {
      setMensaje("Correo enviado.");
      setDestinatario("");
      setAsunto("");
      setCuerpo("");
      cargarHistorial();
    } else {
      const data = await res.json().catch(() => ({}));
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

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-10 py-16 px-6">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Email Tracker
        </h1>

        <form onSubmit={enviarCorreo} className="flex flex-col gap-3">
          <input
            className="border rounded px-3 py-2 dark:bg-zinc-900"
            placeholder="Destinatario"
            type="email"
            value={destinatario}
            onChange={(e) => setDestinatario(e.target.value)}
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
          <button
            type="submit"
            disabled={enviando}
            className="rounded bg-black text-white px-4 py-2 disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {enviando ? "Enviando..." : "Enviar correo"}
          </button>
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
              {emails.map((email) => (
                <tr key={email.id} className="border-b">
                  <td className="py-2">{email.destinatario}</td>
                  <td>{email.asunto}</td>
                  <td>{new Date(email.enviado_at).toLocaleString()}</td>
                  <td>{aperturasDe(email.id)}</td>
                  <td>{clicsDe(email.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
