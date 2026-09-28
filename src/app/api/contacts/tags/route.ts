import { NextRequest, NextResponse } from "next/server";
import { etiquetar, normalizarEtiqueta } from "@/lib/contacts";

export async function POST(request: NextRequest) {
  const { ids, etiqueta, accion } = (await request.json()) as {
    ids?: number[];
    etiqueta?: string;
    accion?: string;
  };
  if (accion !== "agregar" && accion !== "quitar") {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }
  const nombre = normalizarEtiqueta(String(etiqueta ?? ""));
  if (!nombre) return NextResponse.json({ error: "Falta el nombre de la etiqueta" }, { status: 400 });
  const validos = (ids ?? []).filter((n) => Number.isInteger(n) && n > 0);
  if (validos.length === 0) return NextResponse.json({ error: "No se indicaron contactos" }, { status: 400 });

  const afectados = await etiquetar(validos, nombre, accion);
  return NextResponse.json({ afectados, etiqueta: nombre });
}
