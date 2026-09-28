"use client";

import { useSyncExternalStore } from "react";

type Tema = "light" | "dark" | "system";

const CLAVE = "tema";
const EVENTO = "tema-cambiado";

function leerTema(): Tema {
  try {
    const t = localStorage.getItem(CLAVE);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function suscribir(callback: () => void) {
  window.addEventListener(EVENTO, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENTO, callback);
    window.removeEventListener("storage", callback);
  };
}

function aplicarTema(tema: Tema) {
  try {
    if (tema === "system") localStorage.removeItem(CLAVE);
    else localStorage.setItem(CLAVE, tema);
  } catch {
    // sin almacenamiento: el cambio vale solo para esta visita
  }
  if (tema === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", tema);
  window.dispatchEvent(new Event(EVENTO));
}

const OPCIONES: { valor: Tema; etiqueta: string; icono: string }[] = [
  {
    valor: "light",
    etiqueta: "Claro",
    icono: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM11 1h2v3h-2zm0 19h2v3h-2zM1 11h3v2H1zm19 0h3v2h-3zM4.22 5.64l1.42-1.42 2.12 2.12-1.42 1.42zm12.02 12.02 1.42-1.42 2.12 2.12-1.42 1.42zM4.22 18.36l2.12-2.12 1.42 1.42-2.12 2.12zM16.24 6.34l2.12-2.12 1.42 1.42-2.12 2.12z",
  },
  {
    valor: "dark",
    etiqueta: "Oscuro",
    icono: "M12.3 22A10.3 10.3 0 0 1 9.5 1.8a1 1 0 0 1 1.2 1.3 8.3 8.3 0 0 0 10.2 10.2 1 1 0 0 1 1.3 1.2A10.3 10.3 0 0 1 12.3 22z",
  },
  {
    valor: "system",
    etiqueta: "Sistema",
    icono: "M20 3H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h6v2H8v2h8v-2h-2v-2h6a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 13H4V5h16v11z",
  },
];

export default function ThemeToggle() {
  const tema = useSyncExternalStore(suscribir, leerTema, () => "system" as Tema);

  return (
    <div role="radiogroup" aria-label="Tema" className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
      {OPCIONES.map((o) => {
        const activo = tema === o.valor;
        return (
          <button
            key={o.valor}
            role="radio"
            aria-checked={activo}
            title={o.etiqueta}
            onClick={() => aplicarTema(o.valor)}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
              activo ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d={o.icono} />
            </svg>
            <span className="hidden md:inline">{o.etiqueta}</span>
          </button>
        );
      })}
    </div>
  );
}
