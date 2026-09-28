"use client";

import { useState } from "react";

export type ContactoResumen = { id: number; email: string; nombre: string; empresa: string };

type Props = {
  contactos: ContactoResumen[];
  yaIncluidos: Set<string>;
  onAgregar: (seleccion: ContactoResumen[]) => void;
  onCerrar: () => void;
};

export default function ContactPicker({ contactos, yaIncluidos, onAgregar, onCerrar }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());

  const termino = busqueda.trim().toLowerCase();
  const visibles = contactos.filter(
    (c) =>
      !yaIncluidos.has(c.email) &&
      (!termino || `${c.email} ${c.nombre} ${c.empresa}`.toLowerCase().includes(termino))
  );
  const todosMarcados = visibles.length > 0 && visibles.every((c) => seleccion.has(c.id));

  function alternar(id: number) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function alternarTodos() {
    setSeleccion((prev) => {
      const next = new Set(prev);
      for (const c of visibles) {
        if (todosMarcados) next.delete(c.id);
        else next.add(c.id);
      }
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label="Elegir contactos"
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border border-line bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-3 border-b border-line p-4">
          <h2 className="font-medium">Agregar desde contactos</h2>
          <input
            className="field"
            placeholder="Buscar por correo, nombre o empresa"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            autoFocus
          />
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={todosMarcados} onChange={alternarTodos} />
            Seleccionar {termino ? "resultados" : "todos"} ({visibles.length})
          </label>
        </div>

        <ul className="flex-1 overflow-y-auto">
          {visibles.length === 0 && <li className="p-4 text-sm text-muted">No hay contactos para agregar.</li>}
          {visibles.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-3 border-b border-line px-4 py-2.5 text-sm hover:bg-surface-2">
                <input type="checkbox" checked={seleccion.has(c.id)} onChange={() => alternar(c.id)} />
                <span className="min-w-0">
                  <span className="block truncate text-ink">{c.nombre || c.email}</span>
                  {c.nombre && <span className="block truncate text-muted">{c.email}</span>}
                </span>
                {c.empresa && <span className="ml-auto shrink-0 text-xs text-muted">{c.empresa}</span>}
              </label>
            </li>
          ))}
        </ul>

        <div className="flex justify-end gap-2 border-t border-line p-4">
          <button type="button" onClick={onCerrar} className="rounded-lg px-4 py-2 text-sm text-ink-2 hover:bg-surface-2">
            Cancelar
          </button>
          <button
            type="button"
            disabled={seleccion.size === 0}
            onClick={() => onAgregar(contactos.filter((c) => seleccion.has(c.id)))}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-page disabled:opacity-50"
          >
            Agregar {seleccion.size || ""}
          </button>
        </div>
      </div>
    </div>
  );
}
