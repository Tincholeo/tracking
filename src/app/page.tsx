"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ActivityChart, { type DiaActividad } from "@/components/ActivityChart";
import { formatFecha, porcentaje } from "@/lib/formato";

type Stats = {
  totales: { enviados: number; abiertos: number; clicados: number; campanas: number };
  serie: { enviado_at: string; abierto: boolean }[];
  recientes: { tipo: "apertura" | "clic"; destinatario: string; asunto: string; fecha: string }[];
};

const DIAS = 14;

function claveDia(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function agruparPorDia(serie: Stats["serie"]): DiaActividad[] {
  const hoy = new Date();
  const dias: (DiaActividad & { clave: string })[] = [];
  for (let i = DIAS - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i);
    dias.push({
      clave: claveDia(d),
      etiqueta: d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }),
      fechaLarga: d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" }),
      enviados: 0,
      abiertos: 0,
    });
  }
  const porClave = new Map(dias.map((d) => [d.clave, d]));
  for (const fila of serie) {
    const dia = porClave.get(claveDia(new Date(fila.enviado_at)));
    if (!dia) continue;
    dia.enviados++;
    if (fila.abierto) dia.abiertos++;
  }
  return dias;
}

function Tarjeta({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="text-sm text-ink-2">{titulo}</div>
      <div className="mt-1 text-3xl font-semibold text-ink">{valor}</div>
      {detalle && <div className="mt-1 text-xs text-muted">{detalle}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setStats)
      .catch(() => setError(true));
  }, []);

  if (error) return <p className="text-danger">No se pudieron cargar las estadísticas.</p>;
  if (!stats) return <p className="text-muted">Cargando…</p>;

  const { totales } = stats;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Link href="/enviar" className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-page">
          Nuevo correo
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tarjeta titulo="Correos enviados" valor={String(totales.enviados)} />
        <Tarjeta
          titulo="Tasa de apertura"
          valor={porcentaje(totales.abiertos, totales.enviados)}
          detalle={`${totales.abiertos} de ${totales.enviados} abiertos`}
        />
        <Tarjeta
          titulo="Tasa de clics"
          valor={porcentaje(totales.clicados, totales.enviados)}
          detalle={`${totales.clicados} con al menos un clic`}
        />
        <Tarjeta titulo="Campañas" valor={String(totales.campanas)} />
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="mb-4 font-medium">Actividad de los últimos {DIAS} días</h2>
        <ActivityChart dias={agruparPorDia(stats.serie)} />
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Actividad reciente</h2>
          <Link href="/historial" className="text-sm text-ink-2 hover:text-ink">
            Ver historial →
          </Link>
        </div>
        {stats.recientes.length === 0 ? (
          <p className="text-sm text-muted">Todavía no hay aperturas ni clics.</p>
        ) : (
          <ul className="divide-y divide-line">
            {stats.recientes.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-2">
                    {r.tipo === "apertura" ? "Abrió" : "Hizo clic"}
                  </span>
                  <span className="truncate text-ink">{r.destinatario}</span>
                  <span className="truncate text-muted">· {r.asunto}</span>
                </span>
                <span className="shrink-0 text-muted">{formatFecha(r.fecha)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
