"use client";

import { useEffect, useRef, useState } from "react";

export type DiaActividad = {
  etiqueta: string;
  fechaLarga: string;
  enviados: number;
  abiertos: number;
};

const ALTO = 220;
const M = { top: 12, right: 8, bottom: 26, left: 32 };

function barraRedondeada(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function maximoRedondo(n: number) {
  if (n <= 4) return 4;
  const paso = Math.ceil(n / 4);
  return paso * 4;
}

export default function ActivityChart({ dias }: { dias: DiaActividad[] }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setAncho(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const maximo = maximoRedondo(Math.max(0, ...dias.map((d) => d.enviados)));
  const plotW = Math.max(0, ancho - M.left - M.right);
  const plotH = ALTO - M.top - M.bottom;
  const colW = dias.length ? plotW / dias.length : 0;
  const barW = Math.max(3, Math.min(14, (colW - 10) / 2));
  const y = (v: number) => M.top + plotH - (v / maximo) * plotH;
  const ticks = [0, maximo / 2, maximo];
  const cadaCuanto = ancho < 480 ? 3 : 2;
  const activo = hover !== null ? dias[hover] : null;

  return (
    <div>
      <div className="mb-3 flex gap-4 text-sm text-ink-2">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-series-1" /> Enviados
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-series-2" /> Abiertos
        </span>
      </div>

      <div ref={contenedor} className="relative w-full" onMouseLeave={() => setHover(null)}>
        <svg width={ancho} height={ALTO} role="img" aria-label="Correos enviados y abiertos por día, últimos 14 días">
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={M.left}
                x2={M.left + plotW}
                y1={y(t)}
                y2={y(t)}
                stroke={t === 0 ? "var(--axis)" : "var(--grid)"}
                strokeWidth={1}
              />
              <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)" style={{ fontVariantNumeric: "tabular-nums" }}>
                {t}
              </text>
            </g>
          ))}

          {dias.map((d, i) => {
            const cx = M.left + colW * i + colW / 2;
            return (
              <g key={d.fechaLarga}>
                {hover === i && (
                  <rect x={M.left + colW * i} y={M.top} width={colW} height={plotH} fill="var(--surface-2)" />
                )}
                {d.enviados > 0 && (
                  <path d={barraRedondeada(cx - barW - 1, y(d.enviados), barW, y(0) - y(d.enviados))} fill="var(--series-1)" />
                )}
                {d.abiertos > 0 && (
                  <path d={barraRedondeada(cx + 1, y(d.abiertos), barW, y(0) - y(d.abiertos))} fill="var(--series-2)" />
                )}
                {i % cadaCuanto === dias.length % cadaCuanto && (
                  <text x={cx} y={ALTO - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">
                    {d.etiqueta}
                  </text>
                )}
                <rect
                  x={M.left + colW * i}
                  y={M.top}
                  width={colW}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onClick={() => setHover(i)}
                />
              </g>
            );
          })}
        </svg>

        {activo && hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-sm"
            style={{
              left: Math.min(Math.max(M.left + colW * hover + colW / 2 - 70, 0), ancho - 140),
              width: 140,
            }}
          >
            <div className="mb-1 font-medium text-ink">{activo.fechaLarga}</div>
            <div className="flex items-center justify-between text-ink-2">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-series-1" /> Enviados
              </span>
              <span className="text-ink">{activo.enviados}</span>
            </div>
            <div className="flex items-center justify-between text-ink-2">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-series-2" /> Abiertos
              </span>
              <span className="text-ink">{activo.abiertos}</span>
            </div>
          </div>
        )}
      </div>

      <details className="mt-2 text-sm text-ink-2">
        <summary className="cursor-pointer text-muted">Ver como tabla</summary>
        <table className="mt-2 w-full" style={{ fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr className="border-b border-line text-left">
              <th className="py-1 font-medium">Día</th>
              <th className="font-medium">Enviados</th>
              <th className="font-medium">Abiertos</th>
            </tr>
          </thead>
          <tbody>
            {dias.map((d) => (
              <tr key={d.fechaLarga} className="border-b border-line">
                <td className="py-1">{d.fechaLarga}</td>
                <td>{d.enviados}</td>
                <td>{d.abiertos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
