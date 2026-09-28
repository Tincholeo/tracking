"use client";

import { Fragment, useEffect, useState } from "react";
import { formatFecha } from "@/lib/formato";

type EmailRow = {
  id: string;
  destinatario: string;
  asunto: string;
  enviado_at: string | null;
  creado_at: string | null;
  campana_id: string | null;
  estado: "pendiente" | "enviando" | "enviado" | "error";
  error_envio: string | null;
};

type Aggregate = { email_id: string; total: number };

type Fila =
  | { tipo: "individual"; email: EmailRow }
  | { tipo: "campana"; campanaId: string; emails: EmailRow[] };

function Contador({ valor }: { valor: number }) {
  return <span className={valor > 0 ? "font-medium text-ink" : "text-muted"}>{valor}</span>;
}

function Insignia({ children, titulo, peligro }: { children: React.ReactNode; titulo?: string; peligro?: boolean }) {
  return (
    <span
      title={titulo}
      className={`rounded-full px-2 py-0.5 text-xs ${peligro ? "bg-surface-2 text-danger" : "bg-surface-2 text-ink-2"}`}
    >
      {children}
    </span>
  );
}

function CeldaEnvio({ email }: { email: EmailRow }) {
  if (email.estado === "enviado" && email.enviado_at) return <>{formatFecha(email.enviado_at)}</>;
  if (email.estado === "error") return <Insignia peligro titulo={email.error_envio ?? undefined}>Error al enviar</Insignia>;
  return <Insignia titulo="Sale automáticamente cuando haya cupo diario">En cola</Insignia>;
}

export default function Historial() {
  const [emails, setEmails] = useState<EmailRow[] | null>(null);
  const [aperturas, setAperturas] = useState<Aggregate[]>([]);
  const [clics, setClics] = useState<Aggregate[]>([]);
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    fetch("/api/emails")
      .then((r) => r.json())
      .then((data) => {
        setEmails(data.emails);
        setAperturas(data.aperturas);
        setClics(data.clics);
      });
  }, []);

  const aperturasDe = (id: string) => Number(aperturas.find((a) => a.email_id === id)?.total ?? 0);
  const clicsDe = (id: string) => Number(clics.find((c) => c.email_id === id)?.total ?? 0);

  function toggle(campanaId: string) {
    setAbiertas((prev) => {
      const next = new Set(prev);
      if (next.has(campanaId)) next.delete(campanaId);
      else next.add(campanaId);
      return next;
    });
  }

  if (!emails) return <p className="text-muted">Cargando…</p>;

  const termino = busqueda.trim().toLowerCase();
  const visibles = termino
    ? emails.filter((e) => e.destinatario.toLowerCase().includes(termino) || e.asunto.toLowerCase().includes(termino))
    : emails;

  const filas: Fila[] = [];
  const vistos = new Set<string>();
  for (const email of visibles) {
    if (!email.campana_id) {
      filas.push({ tipo: "individual", email });
      continue;
    }
    if (vistos.has(email.campana_id)) continue;
    vistos.add(email.campana_id);
    filas.push({
      tipo: "campana",
      campanaId: email.campana_id,
      emails: visibles.filter((e) => e.campana_id === email.campana_id),
    });
  }

  const celda = "px-4 py-3";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Historial</h1>
        <input
          className="field max-w-xs"
          placeholder="Buscar por destinatario o asunto"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[640px] text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr className="border-b border-line text-left text-ink-2">
              <th className={`${celda} font-medium`}>Destinatario</th>
              <th className={`${celda} font-medium`}>Asunto</th>
              <th className={`${celda} font-medium`}>Enviado</th>
              <th className={`${celda} font-medium text-right`}>Aperturas</th>
              <th className={`${celda} font-medium text-right`}>Clics</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <td colSpan={5} className={`${celda} text-muted`}>
                  No hay correos{termino ? " que coincidan con la búsqueda" : " enviados todavía"}.
                </td>
              </tr>
            )}
            {filas.map((fila) => {
              if (fila.tipo === "individual") {
                const e = fila.email;
                return (
                  <tr key={e.id} className="border-b border-line last:border-0">
                    <td className={celda}>{e.destinatario}</td>
                    <td className={`${celda} text-ink-2`}>{e.asunto}</td>
                    <td className={`${celda} text-ink-2`}><CeldaEnvio email={e} /></td>
                    <td className={`${celda} text-right`}><Contador valor={aperturasDe(e.id)} /></td>
                    <td className={`${celda} text-right`}><Contador valor={clicsDe(e.id)} /></td>
                  </tr>
                );
              }

              const { campanaId, emails: miembros } = fila;
              const abiertos = miembros.filter((e) => aperturasDe(e.id) > 0).length;
              const conClic = miembros.filter((e) => clicsDe(e.id) > 0).length;
              const enviados = miembros.filter((e) => e.estado === "enviado");
              const enCola = miembros.filter((e) => e.estado === "pendiente" || e.estado === "enviando").length;
              const conError = miembros.filter((e) => e.estado === "error").length;
              const fechaCampana = enviados[enviados.length - 1]?.enviado_at ?? miembros[0].creado_at;
              const expandida = abiertas.has(campanaId);

              return (
                <Fragment key={campanaId}>
                  <tr className="cursor-pointer border-b border-line bg-surface-2/50 hover:bg-surface-2" onClick={() => toggle(campanaId)}>
                    <td className={celda}>
                      <span className="mr-2 inline-block w-3 text-muted">{expandida ? "▾" : "▸"}</span>
                      Campaña · {miembros.length} destinatarios
                    </td>
                    <td className={`${celda} text-ink-2`}>{miembros[0].asunto}</td>
                    <td className={`${celda} text-ink-2`}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {fechaCampana && formatFecha(fechaCampana)}
                        {enCola > 0 && <Insignia titulo="Salen automáticamente cuando haya cupo diario">{enCola} en cola</Insignia>}
                        {conError > 0 && <Insignia peligro>{conError} con error</Insignia>}
                      </div>
                    </td>
                    <td className={`${celda} text-right`}>
                      <Contador valor={abiertos} /> <span className="text-muted">/ {enviados.length}</span>
                    </td>
                    <td className={`${celda} text-right`}>
                      <Contador valor={conClic} /> <span className="text-muted">/ {enviados.length}</span>
                    </td>
                  </tr>
                  {expandida &&
                    miembros.map((e) => (
                      <tr key={e.id} className="border-b border-line">
                        <td className={`${celda} pl-11 text-ink-2`}>{e.destinatario}</td>
                        <td className={`${celda} text-muted`}>{e.asunto}</td>
                        <td className={`${celda} text-muted`}><CeldaEnvio email={e} /></td>
                        <td className={`${celda} text-right`}><Contador valor={aperturasDe(e.id)} /></td>
                        <td className={`${celda} text-right`}><Contador valor={clicsDe(e.id)} /></td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        En las campañas, la fila resumen muestra cuántos destinatarios abrieron o hicieron clic. Hacé clic en ella para ver el detalle.
      </p>
    </div>
  );
}
