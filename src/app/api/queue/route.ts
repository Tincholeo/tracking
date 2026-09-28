import { estadoCola, procesarCola } from "@/lib/queue";

export async function GET() {
  return Response.json(await estadoCola());
}

export async function POST() {
  return Response.json(await procesarCola());
}
