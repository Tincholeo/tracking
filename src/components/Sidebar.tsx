"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

const ICONOS = {
  dashboard: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
  enviar: "M2 21l21-9L2 3v7l15 2-15 2v7z",
  historial: "M13 3a9 9 0 0 0-9 9H1l3.9 3.9L9 12H6a7 7 0 1 1 2.05 4.95l-1.42 1.42A9 9 0 1 0 13 3zm-1 5v5l4.25 2.52.77-1.28-3.52-2.09V8H12z",
  plantillas: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z",
};

const ITEMS = [
  { href: "/", label: "Dashboard", icono: ICONOS.dashboard },
  { href: "/enviar", label: "Enviar", icono: ICONOS.enviar },
  { href: "/historial", label: "Historial", icono: ICONOS.historial },
  { href: "/plantillas", label: "Plantillas", icono: ICONOS.plantillas },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex shrink-0 flex-col border-b border-line bg-surface md:sticky md:top-0 md:h-screen md:w-56 md:border-b-0 md:border-r">
      <div className="flex items-center justify-between px-5 pt-5 pb-3 md:pb-6">
        <span className="text-base font-semibold text-ink">Email Tracker</span>
        <div className="md:hidden">
          <ThemeToggle />
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
        {ITEMS.map((item) => {
          const activo =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={activo ? "page" : undefined}
              className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                activo
                  ? "bg-surface-2 font-medium text-ink"
                  : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">
                <path d={item.icono} />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto hidden px-4 pb-5 md:block">
        <ThemeToggle />
      </div>
    </aside>
  );
}
