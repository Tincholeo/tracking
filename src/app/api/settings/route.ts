import { NextRequest, NextResponse } from "next/server";
import { guardarAjustes, leerAjustes, remitenteBase } from "@/lib/settings";
import { esEmailValido } from "@/lib/recipients";

export async function GET() {
  const base = remitenteBase();
  return NextResponse.json({ ajustes: await leerAjustes(), direccion: base.direccion, nombrePorDefecto: base.nombre });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const nombreRemitente = String(body.nombreRemitente ?? "").replace(/["<>]/g, "").trim().slice(0, 100);
  const responderA = String(body.responderA ?? "").trim().toLowerCase();
  if (responderA && !esEmailValido(responderA)) {
    return NextResponse.json({ error: "La dirección para respuestas no es válida" }, { status: 400 });
  }
  await guardarAjustes({ nombreRemitente, responderA });
  return NextResponse.json({ ok: true });
}
