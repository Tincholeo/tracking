"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import EmailEditor from "@/components/EmailEditor";
import ContactPicker, { type ContactoResumen } from "@/components/ContactPicker";
import { parsearDestinatarios } from "@/lib/recipients";
import { personalizar, usaVariables } from "@/lib/personalize";

type Plantilla = { id: number; nombre: string; asunto: string; cuerpo: string };
type Cola = { pendientes: number; disponibles: number; usadosHoy: number; limite: number; reserva: number };
type Aviso = { texto: string; tipo: "ok" | "error" | "info" };

function lineaContacto(c: { email: string; nombre: string }) {
  return c.nombre ? `${c.nombre} <${c.email}>` : c.email;
}

function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}

export default function Enviar() {
  const [destinatarios, setDestinatarios] = useState("");
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState("");
  const [contactos, setContactos] = useState<ContactoResumen[]>([]);
  const [cola, setCola] = useState<Cola | null>(null);
  const [pickerAbierto, setPickerAbierto] = useState(false);
  const [previa, setPrevia] = useState<number | null>(null);

  // null = automático: se incluye el enlace de baja en campañas, no en correos individuales.
  const [bajaManual, setBajaManual] = useState<boolean | null>(null);
  const [seguimientoActivo, setSeguimientoActivo] = useState(false);
  const [segCondicion, setSegCondicion] = useState<"sin_apertura" | "sin_clic">("sin_apertura");
  const [segDias, setSegDias] = useState(3);
  const [segAsunto, setSegAsunto] = useState("");
  const [segCuerpo, setSegCuerpo] = useState(
    "<p>Hola {{primer_nombre|}},</p><p>Te escribo de nuevo por si no llegaste a ver mi correo anterior. Quedo atento a tu respuesta.</p>"
  );
  const [segKey, setSegKey] = useState(0);

  function cargarCola() {
    fetch("/api/queue")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setCola(data));
  }

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setPlantillas(data.plantillas));

    fetch("/api/contacts")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setContactos(data.contactos);
        // Llegada desde Contactos con una selección: /enviar?contactos=1,2,3
        const ids = new URLSearchParams(window.location.search).get("contactos");
        if (ids) {
          const elegidos = new Set(ids.split(",").map(Number));
          const lista: ContactoResumen[] = data.contactos.filter((c: ContactoResumen) => elegidos.has(c.id));
          setDestinatarios(lista.map(lineaContacto).join("\n"));
        }
      });

    fetch("/api/queue")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setCola(data));
  }, []);

  const { validos, invalidos } = useMemo(() => parsearDestinatarios(destinatarios), [destinatarios]);
  const porEmail = useMemo(() => new Map(contactos.map((c) => [c.email, c])), [contactos]);
  const incluidos = useMemo(() => new Set(validos.map((v) => v.email)), [validos]);

  function datosDe(i: number) {
    const d = validos[i];
    const c = porEmail.get(d.email);
    return { email: d.email, nombre: d.nombre || c?.nombre || "", empresa: c?.empresa ?? "" };
  }

  function usarPlantilla(id: string) {
    setPlantillaSeleccionada(id);
    const plantilla = plantillas.find((p) => String(p.id) === id);
    if (!plantilla) return;
    setAsunto(plantilla.asunto);
    setCuerpo(plantilla.cuerpo);
    setEditorKey((k) => k + 1);
  }

  function agregarContactos(seleccion: ContactoResumen[]) {
    const nuevas = seleccion.map(lineaContacto).join("\n");
    setDestinatarios((prev) => (prev.trim() ? `${prev.trimEnd()}\n${nuevas}` : nuevas));
    setPickerAbierto(false);
  }

  async function guardarComoPlantilla() {
    if (!asunto || !cuerpo) {
      setAviso({ texto: "Completá asunto y cuerpo antes de guardar la plantilla.", tipo: "error" });
      return;
    }
    const nombre = window.prompt("Nombre para esta plantilla:", asunto);
    if (!nombre) return;
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, asunto, cuerpo }),
    });
    if (res.ok) {
      setAviso({ texto: "Plantilla guardada.", tipo: "ok" });
      fetch("/api/templates")
        .then((r) => r.json())
        .then((data) => setPlantillas(data.plantillas));
    } else {
      setAviso({ texto: "No se pudo guardar la plantilla.", tipo: "error" });
    }
  }

  async function enviarCorreo(e: React.FormEvent) {
    e.preventDefault();
    if (invalidos.length > 0) {
      setAviso({ texto: `Corregí las direcciones inválidas: ${invalidos.join(", ")}`, tipo: "error" });
      return;
    }
    if (validos.length === 0) {
      setAviso({ texto: "Agregá al menos un destinatario.", tipo: "error" });
      return;
    }
    if (!cuerpo.trim()) {
      setAviso({ texto: "El cuerpo del correo está vacío.", tipo: "error" });
      return;
    }

    setEnviando(true);
    setAviso(null);
    const res = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destinatarios,
        asunto,
        cuerpo,
        conBaja,
        seguimiento: seguimientoActivo
          ? { condicion: segCondicion, dias: segDias, asunto: segAsunto, cuerpo: segCuerpo }
          : null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setEnviando(false);

    if (!res.ok) {
      setAviso({ texto: `Error: ${data.error ?? res.statusText}`, tipo: "error" });
      return;
    }

    const partes = [`${plural(data.enviadosAhora, "correo enviado", "correos enviados")} ahora`];
    if (data.pendientes > 0) partes.push(`${data.pendientes} en cola: salen solos los próximos días`);
    if (data.fallidos > 0) partes.push(`${data.fallidos} con error (ver historial)`);
    if (data.omitidos?.length) partes.push(`${data.omitidos.length} omitidos por estar dados de baja o rebotar`);
    if (seguimientoActivo) partes.push(`recordatorio programado a ${segDias} día(s)`);
    if (data.errorEnvio) partes.push(`Resend respondió: ${data.errorEnvio}`);
    setAviso({ texto: partes.join(" · "), tipo: data.errorEnvio || data.fallidos ? "info" : "ok" });

    setDestinatarios("");
    setAsunto("");
    setCuerpo("");
    setPlantillaSeleccionada("");
    setEditorKey((k) => k + 1);
    setPrevia(null);
    setBajaManual(null);
    setSeguimientoActivo(false);
    setSegAsunto("");
    setSegKey((k) => k + 1);
    cargarCola();
  }

  const conBaja = bajaManual ?? validos.length > 1;
  const inactivos = validos.filter((v) => {
    const estado = porEmail.get(v.email)?.estado;
    return estado && estado !== "activo";
  });
  const saleHoy = cola ? Math.max(0, Math.min(validos.length, cola.disponibles - cola.pendientes)) : null;
  const personaliza = usaVariables(asunto) || usaVariables(cuerpo);
  const indicePrevia = previa !== null && previa < validos.length ? previa : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Enviar correo</h1>

      {cola && (
        <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-2">
          Cupo de hoy: <span className="font-medium text-ink">{cola.disponibles}</span> disponibles
          <span className="text-muted">
            {" "}
            ({cola.usadosHoy} usados de {cola.limite}, {cola.reserva} reservados para avisos y reportes · se renueva a
            las 21:00 hora Argentina)
          </span>
          {cola.pendientes > 0 && (
            <>
              {" "}· <span className="font-medium text-ink">{cola.pendientes}</span> en cola que salen primero
            </>
          )}
        </p>
      )}

      <form onSubmit={enviarCorreo} className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5">
        {plantillas.length > 0 && (
          <label className="flex flex-col gap-1.5 text-sm text-ink-2">
            Plantilla
            <select className="field" value={plantillaSeleccionada} onChange={(e) => usarPlantilla(e.target.value)}>
              <option value="">Sin plantilla</option>
              {plantillas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex flex-col gap-1.5 text-sm text-ink-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="destinatarios">Destinatarios</label>
            <button
              type="button"
              onClick={() => setPickerAbierto(true)}
              className="rounded-lg border border-line px-3 py-1 text-sm text-ink hover:bg-surface-2"
            >
              + Desde contactos
            </button>
          </div>
          <textarea
            id="destinatarios"
            className="field min-h-24 font-mono text-sm"
            placeholder={"Uno por línea:\nana@empresa.com\nJuan Pérez <juan@empresa.com>"}
            value={destinatarios}
            onChange={(e) => setDestinatarios(e.target.value)}
          />
          <div className="flex flex-wrap gap-x-3 text-xs text-muted">
            {validos.length > 0 && (
              <span>
                {plural(validos.length, "destinatario", "destinatarios")}
                {validos.length > 1 && " · se envía como campaña, cada uno recibe su propio correo"}
              </span>
            )}
            {saleHoy !== null && validos.length > saleHoy && (
              <span className="text-ink-2">
                Hoy salen {saleHoy}; los otros {validos.length - saleHoy} quedan en cola y se envían solos cada día a
                las 9:05 (hora Argentina).
              </span>
            )}
          </div>
          {inactivos.length > 0 && (
            <p className="text-xs text-danger">
              No se les va a enviar (dados de baja o rebotan): {inactivos.map((v) => v.email).join(", ")}
            </p>
          )}
          {invalidos.length > 0 && (
            <p className="text-xs text-danger">No son direcciones válidas: {invalidos.join(", ")}</p>
          )}
        </div>

        <label className="flex flex-col gap-1.5 text-sm text-ink-2">
          Asunto
          <input
            className="field"
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            placeholder="Ej.: Propuesta para {{empresa}}"
            required
          />
        </label>

        <div className="flex flex-col gap-1.5 text-sm text-ink-2">
          <span>Mensaje</span>
          <EmailEditor key={editorKey} value={cuerpo} onChange={setCuerpo} />
          <span className="text-xs text-muted">
            Las variables como {"{{nombre}}"} se completan con los datos de cada contacto. Para un valor por defecto
            cuando falta el dato: {"{{nombre|equipo}}"}.
          </span>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-line p-4">
          <label className="flex items-start gap-2.5 text-sm text-ink">
            <input type="checkbox" className="mt-0.5" checked={conBaja} onChange={(e) => setBajaManual(e.target.checked)} />
            <span>
              Incluir enlace para darse de baja
              <span className="block text-xs text-muted">
                Recomendado en campañas: protege tu dominio de ser marcado como spam. Quien se da de baja queda excluido de futuros envíos.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2.5 text-sm text-ink">
            <input type="checkbox" className="mt-0.5" checked={seguimientoActivo} onChange={(e) => setSeguimientoActivo(e.target.checked)} />
            <span>
              Enviar un recordatorio automático
              <span className="block text-xs text-muted">Solo a quien no cumpla la condición. Se revisa una vez por día (9:05, hora Argentina).</span>
            </span>
          </label>

          {seguimientoActivo && (
            <div className="ml-6 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
                Si
                <select className="field w-auto py-1" value={segCondicion} onChange={(e) => setSegCondicion(e.target.value as "sin_apertura" | "sin_clic")}>
                  <option value="sin_apertura">no lo abre</option>
                  <option value="sin_clic">no hace clic en ningún enlace</option>
                </select>
                en
                <input
                  type="number"
                  min={1}
                  max={60}
                  className="field w-20 py-1"
                  value={segDias}
                  onChange={(e) => setSegDias(Math.min(60, Math.max(1, Number(e.target.value) || 1)))}
                />
                día(s)
              </div>
              <label className="flex flex-col gap-1.5 text-sm text-ink-2">
                Asunto del recordatorio
                <input className="field" value={segAsunto} onChange={(e) => setSegAsunto(e.target.value)} placeholder="Vacío = «Re: » + asunto original" />
              </label>
              <div className="flex flex-col gap-1.5 text-sm text-ink-2">
                Mensaje del recordatorio
                <EmailEditor key={segKey} value={segCuerpo} onChange={setSegCuerpo} minHeight={120} />
              </div>
            </div>
          )}
        </div>

        {validos.length > 0 && (asunto || cuerpo) && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
              <button
                type="button"
                onClick={() => setPrevia(indicePrevia === null ? 0 : null)}
                className="rounded-lg border border-line px-3 py-1 text-ink hover:bg-surface-2"
              >
                {indicePrevia === null ? "Vista previa" : "Ocultar vista previa"}
              </button>
              {indicePrevia !== null && validos.length > 1 && (
                <select
                  className="rounded-md border border-line bg-surface px-2 py-1 text-sm"
                  value={indicePrevia}
                  onChange={(e) => setPrevia(Number(e.target.value))}
                  aria-label="Ver como"
                >
                  {validos.slice(0, 100).map((v, i) => (
                    <option key={v.email} value={i}>
                      Como la ve {v.email}
                    </option>
                  ))}
                </select>
              )}
              {personaliza && indicePrevia === null && <span className="text-xs text-muted">Revisá cómo queda personalizado</span>}
            </div>
            {indicePrevia !== null && (
              <div className="overflow-hidden rounded-lg border border-line">
                <div className="border-b border-line bg-surface-2 px-4 py-2 text-sm">
                  <span className="text-muted">Para:</span> {validos[indicePrevia].email}
                  <br />
                  <span className="text-muted">Asunto:</span>{" "}
                  <span className="font-medium text-ink">{personalizar(asunto, datosDe(indicePrevia), false)}</span>
                </div>
                <iframe
                  title="Vista previa del correo"
                  sandbox=""
                  className="h-80 w-full bg-white"
                  srcDoc={`<!doctype html><meta charset="utf-8"><body style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#111;line-height:1.5;margin:16px">${personalizar(cuerpo, datosDe(indicePrevia), true)}</body>`}
                />
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={enviando}
            className="flex-1 rounded-lg bg-ink px-4 py-2.5 font-medium text-page disabled:opacity-50"
          >
            {enviando
              ? "Enviando…"
              : validos.length > 1
                ? `Enviar a ${validos.length} destinatarios`
                : "Enviar correo"}
          </button>
          <button
            type="button"
            onClick={guardarComoPlantilla}
            className="rounded-lg border border-line px-4 py-2.5 text-ink hover:bg-surface-2"
          >
            Guardar como plantilla
          </button>
        </div>

        {aviso && (
          <p
            className={`text-sm ${
              aviso.tipo === "ok" ? "text-success" : aviso.tipo === "error" ? "text-danger" : "text-ink-2"
            }`}
          >
            {aviso.texto}{" "}
            {aviso.tipo !== "error" && (
              <Link href="/historial" className="underline">
                Ver en historial
              </Link>
            )}
          </p>
        )}
      </form>

      {pickerAbierto && (
        <ContactPicker
          contactos={contactos}
          yaIncluidos={incluidos}
          onAgregar={agregarContactos}
          onCerrar={() => setPickerAbierto(false)}
        />
      )}
    </div>
  );
}
