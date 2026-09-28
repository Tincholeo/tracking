import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import { parsearDestinatarios } from "@/lib/recipients";
import { personalizar } from "@/lib/personalize";
import { buscarContactos, guardarContactos } from "@/lib/contacts";
import { procesarCola } from "@/lib/queue";
import { validarSeguimiento, type SeguimientoEntrada } from "@/lib/followups";

const MAX_DESTINATARIOS = 2000;

export async function POST(request: NextRequest) {
  const { destinatarios, asunto, cuerpo, userId, conBaja, seguimiento, programadoPara } = await request.json();

  let programado: Date | null = null;
  if (programadoPara) {
    programado = new Date(programadoPara);
    const ahora = Date.now();
    if (Number.isNaN(programado.getTime())) {
      return NextResponse.json({ error: "Fecha de programación inválida" }, { status: 400 });
    }
    if (programado.getTime() < ahora - 60_000) {
      return NextResponse.json({ error: "La fecha programada ya pasó" }, { status: 400 });
    }
    if (programado.getTime() > ahora + 366 * 86_400_000) {
      return NextResponse.json({ error: "Se puede programar hasta un año adelante" }, { status: 400 });
    }
  }

  let seguimientoValido: SeguimientoEntrada | null = null;
  if (seguimiento) {
    const r = validarSeguimiento(seguimiento);
    if (typeof r === "string") return NextResponse.json({ error: r }, { status: 400 });
    seguimientoValido = r;
  }

  const texto = Array.isArray(destinatarios) ? destinatarios.join("\n") : String(destinatarios ?? "");
  const { validos, invalidos } = parsearDestinatarios(texto);

  if (!asunto || !cuerpo) {
    return NextResponse.json({ error: "Faltan el asunto o el cuerpo" }, { status: 400 });
  }
  if (invalidos.length > 0) {
    return NextResponse.json(
      { error: `Direcciones inválidas: ${invalidos.slice(0, 10).join(", ")}`, invalidos },
      { status: 400 }
    );
  }
  if (validos.length === 0) {
    return NextResponse.json({ error: "No hay destinatarios" }, { status: 400 });
  }
  if (validos.length > MAX_DESTINATARIOS) {
    return NextResponse.json({ error: `Máximo ${MAX_DESTINATARIOS} destinatarios por envío` }, { status: 400 });
  }

  await guardarContactos(validos);
  const contactos = await buscarContactos(validos.map((d) => d.email));

  // Nunca se escribe a quien se dio de baja, rebota o marcó como spam.
  const omitidos = validos.filter((d) => (contactos.get(d.email)?.estado ?? "activo") !== "activo");
  const aEnviar = validos.filter((d) => (contactos.get(d.email)?.estado ?? "activo") === "activo");
  if (aEnviar.length === 0) {
    return NextResponse.json(
      { error: "Todos los destinatarios están dados de baja o rebotan", omitidos: omitidos.map((d) => d.email) },
      { status: 400 }
    );
  }

  const pool = getPool();
  let seguimientoId: number | null = null;
  if (seguimientoValido) {
    const [r] = await pool.query(
      "INSERT INTO seguimientos (condicion, dias, asunto, cuerpo, creado_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())",
      [seguimientoValido.condicion, seguimientoValido.dias, seguimientoValido.asunto, seguimientoValido.cuerpo]
    );
    seguimientoId = (r as { insertId: number }).insertId;
  }

  const campanaId = aEnviar.length > 1 ? randomUUID() : null;
  if (campanaId) {
    await pool.query(
      "INSERT INTO campanas (id, nombre, asunto, creado_at) VALUES (?, ?, ?, UTC_TIMESTAMP())",
      [campanaId, asunto, asunto]
    );
  }

  // Cada destinatario queda como un correo propio (su pixel, sus links, sin ver
  // a los demás) con el contenido ya personalizado.
  const filas = aEnviar.map((d) => {
    const contacto = contactos.get(d.email);
    const datos = {
      email: d.email,
      nombre: d.nombre || contacto?.nombre || "",
      empresa: contacto?.empresa ?? "",
    };
    return [
      randomUUID(),
      d.email,
      personalizar(asunto, datos, false).slice(0, 500),
      personalizar(cuerpo, datos, true),
      userId ?? "default",
      campanaId,
      conBaja ? 1 : 0,
      seguimientoId,
      programado,
    ];
  });

  for (let i = 0; i < filas.length; i += 200) {
    const lote = filas.slice(i, i + 200);
    await pool.query(
      `INSERT INTO emails (id, destinatario, asunto, cuerpo, user_id, campana_id, con_baja, seguimiento_id, programado_at, estado, creado_at)
       VALUES ${lote.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', UTC_TIMESTAMP())").join(", ")}`,
      lote.flat()
    );
  }

  // Un envío programado solo queda en cola; lo despacha el cron cuando llegue la hora.
  const envio = programado ? { error: null, disponibles: null } : await procesarCola();

  const [[resumen]] = await pool.query<RowDataPacket[]>(
    `SELECT SUM(estado = 'pendiente') AS pendientes, SUM(estado = 'enviado') AS enviados,
       SUM(estado = 'error') AS fallidos
     FROM emails WHERE id IN (?)`,
    [filas.map((f) => f[0])]
  );

  return NextResponse.json({
    campanaId,
    total: filas.length,
    omitidos: omitidos.map((d) => d.email),
    programadoPara: programado?.toISOString() ?? null,
    pendientes: Number(resumen.pendientes ?? 0),
    enviadosAhora: Number(resumen.enviados ?? 0),
    fallidos: Number(resumen.fallidos ?? 0),
    errorEnvio: envio.error,
    disponiblesHoy: envio.disponibles,
  });
}
