"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatFecha } from "@/lib/formato";
import { leerContactosCsv } from "@/lib/csv";

type Contacto = {
  id: number;
  email: string;
  nombre: string;
  empresa: string;
  enviados: number;
  abiertos: number;
  clicados: number;
  ultimo_envio: string | null;
};

type Aviso = { texto: string; ok: boolean };

function descargar(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  a.click();
}

function Cifra({ valor }: { valor: number }) {
  return <span className={valor > 0 ? "text-ink" : "text-muted"}>{valor}</span>;
}

export default function Contactos() {
  const router = useRouter();
  const [contactos, setContactos] = useState<Contacto[] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [aviso, setAviso] = useState<Aviso | null>(null);

  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [nuevo, setNuevo] = useState({ email: "", nombre: "", empresa: "" });
  const [editando, setEditando] = useState<{ id: number; nombre: string; empresa: string } | null>(null);
  const archivo = useRef<HTMLInputElement>(null);

  function cargar() {
    return fetch("/api/contacts")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setContactos(data.contactos));
  }

  useEffect(() => {
    fetch("/api/contacts")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setContactos(data.contactos));
  }, []);

  if (!contactos) return <p className="text-muted">Cargando…</p>;

  const termino = busqueda.trim().toLowerCase();
  const visibles = termino
    ? contactos.filter((c) => `${c.email} ${c.nombre} ${c.empresa}`.toLowerCase().includes(termino))
    : contactos;
  const todosMarcados = visibles.length > 0 && visibles.every((c) => seleccion.has(c.id));
  const idsSeleccion = [...seleccion];

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

  async function guardarContactos(lista: { email: string; nombre: string; empresa: string }[]) {
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactos: lista }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setAviso({ texto: `Error: ${data.error ?? res.statusText}`, ok: false });
      return false;
    }
    const invalidos: string[] = data.invalidos ?? [];
    setAviso({
      texto: `${data.guardados} contacto(s) guardado(s).${
        invalidos.length ? ` Se omitieron ${invalidos.length} con correo inválido: ${invalidos.slice(0, 5).join(", ")}${invalidos.length > 5 ? "…" : ""}` : ""
      }`,
      ok: invalidos.length === 0,
    });
    await cargar();
    return true;
  }

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (await guardarContactos([nuevo])) {
      setNuevo({ email: "", nombre: "", empresa: "" });
      setNuevoAbierto(false);
    }
  }

  async function importar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const filas = leerContactosCsv(await file.text());
    if (filas.length === 0) {
      setAviso({ texto: "No encontré correos en el archivo. Debe tener una columna email (o correo).", ok: false });
      return;
    }
    if (!window.confirm(`Importar ${filas.length} contacto(s) de "${file.name}"? Los que ya existen se actualizan.`)) return;
    await guardarContactos(filas);
  }

  async function eliminar() {
    const n = idsSeleccion.length;
    if (
      !window.confirm(
        `¿Eliminar ${n} contacto(s)? Se quitan de la lista; el historial de correos enviados se conserva.`
      )
    )
      return;
    const res = await fetch("/api/contacts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: idsSeleccion }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setAviso({ texto: `${data.borrados} contacto(s) eliminado(s).`, ok: true });
      setSeleccion(new Set());
      await cargar();
    } else {
      setAviso({ texto: `Error: ${data.error ?? res.statusText}`, ok: false });
    }
  }

  async function guardarEdicion() {
    if (!editando) return;
    const res = await fetch(`/api/contacts/${editando.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: editando.nombre, empresa: editando.empresa }),
    });
    if (res.ok) {
      setEditando(null);
      await cargar();
    } else {
      setAviso({ texto: "No se pudo guardar el cambio.", ok: false });
    }
  }

  const celda = "px-4 py-3";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          Contactos <span className="text-base font-normal text-muted">({contactos.length})</span>
        </h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setNuevoAbierto((v) => !v)}
            className="rounded-lg border border-line px-3 py-2 text-sm text-ink hover:bg-surface-2"
          >
            + Nuevo contacto
          </button>
          <button
            onClick={() => archivo.current?.click()}
            className="rounded-lg border border-line px-3 py-2 text-sm text-ink hover:bg-surface-2"
          >
            Importar CSV
          </button>
          <button
            onClick={() => descargar("/api/contacts/export")}
            className="rounded-lg border border-line px-3 py-2 text-sm text-ink hover:bg-surface-2"
          >
            Exportar CSV
          </button>
          <input ref={archivo} type="file" accept=".csv,text/csv" className="hidden" onChange={importar} />
        </div>
      </div>

      {nuevoAbierto && (
        <form onSubmit={agregar} className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[2fr_2fr_2fr_auto]">
          <input
            className="field"
            type="email"
            placeholder="correo@empresa.com"
            value={nuevo.email}
            onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })}
            required
            autoFocus
          />
          <input className="field" placeholder="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
          <input className="field" placeholder="Empresa" value={nuevo.empresa} onChange={(e) => setNuevo({ ...nuevo, empresa: e.target.value })} />
          <button type="submit" className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-page">
            Guardar
          </button>
        </form>
      )}

      {aviso && <p className={`text-sm ${aviso.ok ? "text-success" : "text-danger"}`}>{aviso.texto}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="field max-w-xs"
          placeholder="Buscar por correo, nombre o empresa"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {seleccion.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 px-3 py-1.5 text-sm">
            <span className="text-ink">{seleccion.size} seleccionado(s)</span>
            <button
              onClick={() => router.push(`/enviar?contactos=${idsSeleccion.join(",")}`)}
              className="rounded-md px-2 py-1 text-ink hover:bg-surface"
            >
              Enviar correo
            </button>
            <button
              onClick={() => descargar(`/api/contacts/export?ids=${idsSeleccion.join(",")}`)}
              className="rounded-md px-2 py-1 text-ink hover:bg-surface"
            >
              Exportar
            </button>
            <button onClick={eliminar} className="rounded-md px-2 py-1 text-danger hover:bg-surface">
              Eliminar
            </button>
            <button onClick={() => setSeleccion(new Set())} className="rounded-md px-2 py-1 text-muted hover:bg-surface">
              Quitar selección
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[720px] text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr className="border-b border-line text-left text-ink-2">
              <th className={`${celda} w-10`}>
                <input type="checkbox" checked={todosMarcados} onChange={alternarTodos} aria-label="Seleccionar todos" />
              </th>
              <th className={`${celda} font-medium`}>Contacto</th>
              <th className={`${celda} font-medium`}>Empresa</th>
              <th className={`${celda} text-right font-medium`}>Enviados</th>
              <th className={`${celda} text-right font-medium`}>Abiertos</th>
              <th className={`${celda} text-right font-medium`}>Clics</th>
              <th className={`${celda} font-medium`}>Último envío</th>
              <th className={celda} />
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && (
              <tr>
                <td colSpan={8} className={`${celda} text-muted`}>
                  {termino ? "Ningún contacto coincide con la búsqueda." : "Todavía no hay contactos. Se agregan solos al enviar, o podés importarlos."}
                </td>
              </tr>
            )}
            {visibles.map((c) => {
              const enEdicion = editando?.id === c.id;
              return (
                <tr key={c.id} className={`border-b border-line last:border-0 ${seleccion.has(c.id) ? "bg-surface-2/60" : ""}`}>
                  <td className={celda}>
                    <input type="checkbox" checked={seleccion.has(c.id)} onChange={() => alternar(c.id)} aria-label={`Seleccionar ${c.email}`} />
                  </td>
                  <td className={celda}>
                    {enEdicion ? (
                      <input
                        className="field py-1"
                        placeholder="Nombre"
                        value={editando.nombre}
                        onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                        autoFocus
                      />
                    ) : (
                      c.nombre && <div className="text-ink">{c.nombre}</div>
                    )}
                    <div className={c.nombre || enEdicion ? "text-muted" : "text-ink"}>{c.email}</div>
                  </td>
                  <td className={`${celda} text-ink-2`}>
                    {enEdicion ? (
                      <input
                        className="field py-1"
                        placeholder="Empresa"
                        value={editando.empresa}
                        onChange={(e) => setEditando({ ...editando, empresa: e.target.value })}
                      />
                    ) : (
                      c.empresa
                    )}
                  </td>
                  <td className={`${celda} text-right`}><Cifra valor={c.enviados} /></td>
                  <td className={`${celda} text-right`}><Cifra valor={c.abiertos} /></td>
                  <td className={`${celda} text-right`}><Cifra valor={c.clicados} /></td>
                  <td className={`${celda} text-ink-2`}>{c.ultimo_envio ? formatFecha(c.ultimo_envio) : <span className="text-muted">—</span>}</td>
                  <td className={`${celda} whitespace-nowrap text-right`}>
                    {enEdicion ? (
                      <>
                        <button onClick={guardarEdicion} className="rounded-md px-2 py-1 text-ink hover:bg-surface-2">
                          Guardar
                        </button>
                        <button onClick={() => setEditando(null)} className="rounded-md px-2 py-1 text-muted hover:bg-surface-2">
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setEditando({ id: c.id, nombre: c.nombre, empresa: c.empresa })}
                        className="rounded-md px-2 py-1 text-ink-2 hover:bg-surface-2 hover:text-ink"
                      >
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Cada destinatario al que le enviás se agrega solo. El CSV para importar necesita una columna email (o correo); nombre y
        empresa son opcionales y se usan en las variables {"{{nombre}}"} y {"{{empresa}}"}.
      </p>
    </div>
  );
}
