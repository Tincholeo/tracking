import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import { parsearDestinatarios } from "@/lib/recipients";
import { personalizar } from "@/lib/personalize";
import { buscarContactos, guardarContactos } from "@/lib/contacts";
import { procesarCola } from "@/lib/queue";

const MAX_DESTINATARIOS = 2000;

export async function POST(request: NextRequest) {
  const { destinatarios, asunto, cuerpo, userId } = await request.json();

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

  const pool = getPool();
  const campanaId = validos.length > 1 ? randomUUID() : null;
  if (campanaId) {
    await pool.query(
      "INSERT INTO campanas (id, nombre, asunto, creado_at) VALUES (?, ?, ?, UTC_TIMESTAMP())",
      [campanaId, asunto, asunto]
    );
  }

  // Cada destinatario queda como un correo propio (su pixel, sus links, sin ver
  // a los demás) con el contenido ya personalizado.
  const filas = validos.map((d) => {
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
    ];
  });

  for (let i = 0; i < filas.length; i += 200) {
    const lote = filas.slice(i, i + 200);
    await pool.query(
      `INSERT INTO emails (id, destinatario, asunto, cuerpo, user_id, campana_id, estado, creado_at)
       VALUES ${lote.map(() => "(?, ?, ?, ?, ?, ?, 'pendiente', UTC_TIMESTAMP())").join(", ")}`,
      lote.flat()
    );
  }

  const envio = await procesarCola();

  const [[pendientesCampana]] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM emails WHERE estado = 'pendiente' AND id IN (?)",
    [filas.map((f) => f[0])]
  );

  return NextResponse.json({
    campanaId,
    total: filas.length,
    pendientes: Number(pendientesCampana.n),
    enviadosAhora: envio.enviados,
    fallidos: envio.fallidos,
    errorEnvio: envio.error,
    disponiblesHoy: envio.disponibles,
  });
}
