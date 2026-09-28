import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import { esEmailValido } from "@/lib/recipients";
import { CONSULTA_CONTACTOS, etiquetar, guardarContactos, type ContactoEntrada } from "@/lib/contacts";

function idsDesde(request: NextRequest) {
  return (request.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
}

export async function GET(request: NextRequest) {
  const ids = idsDesde(request);
  const [filas] = await getPool().query<RowDataPacket[]>(
    `${CONSULTA_CONTACTOS}
     ${ids.length ? "WHERE c.id IN (?)" : ""}
     GROUP BY c.id
     ORDER BY COALESCE(MAX(e.enviado_at), c.creado_at) DESC`,
    ids.length ? [ids] : []
  );
  return NextResponse.json({
    contactos: filas.map((f) => ({
      ...f,
      enviados: Number(f.enviados),
      abiertos: Number(f.abiertos),
      clicados: Number(f.clicados),
    })),
  });
}

export async function POST(request: NextRequest) {
  const { contactos, etiqueta } = (await request.json()) as { contactos?: ContactoEntrada[]; etiqueta?: string };
  if (!Array.isArray(contactos) || contactos.length === 0) {
    return NextResponse.json({ error: "No hay contactos para guardar" }, { status: 400 });
  }
  if (contactos.length > 5000) {
    return NextResponse.json({ error: "Máximo 5000 contactos por importación" }, { status: 400 });
  }

  const validos: ContactoEntrada[] = [];
  const invalidos: string[] = [];
  for (const c of contactos) {
    const email = String(c?.email ?? "").trim().toLowerCase();
    if (esEmailValido(email)) {
      validos.push({ email, nombre: String(c.nombre ?? ""), empresa: String(c.empresa ?? "") });
    } else if (email) {
      invalidos.push(email);
    }
  }

  await guardarContactos(validos);

  if (etiqueta && validos.length > 0) {
    const [filas] = await getPool().query<RowDataPacket[]>("SELECT id FROM contactos WHERE email IN (?)", [
      validos.map((c) => c.email),
    ]);
    await etiquetar(
      filas.map((f) => f.id),
      etiqueta,
      "agregar"
    );
  }

  return NextResponse.json({ guardados: validos.length, invalidos });
}

export async function DELETE(request: NextRequest) {
  const { ids } = (await request.json()) as { ids?: number[] };
  const validos = (ids ?? []).filter((n) => Number.isInteger(n) && n > 0);
  if (validos.length === 0) {
    return NextResponse.json({ error: "No se indicaron contactos" }, { status: 400 });
  }
  const [resultado] = await getPool().query("DELETE FROM contactos WHERE id IN (?)", [validos]);
  return NextResponse.json({ borrados: (resultado as { affectedRows: number }).affectedRows });
}
