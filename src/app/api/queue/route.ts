import { estadoCola, procesarCola } from "@/lib/queue";
import { generarSeguimientos } from "@/lib/followups";

export async function GET() {
  return Response.json(await estadoCola());
}

export async function POST() {
  const seguimientos = await generarSeguimientos();
  return Response.json({ seguimientos, ...(await procesarCola()) });
}
