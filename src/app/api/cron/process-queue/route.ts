import type { NextRequest } from "next/server";
import { procesarCola } from "@/lib/queue";
import { generarSeguimientos } from "@/lib/followups";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const seguimientos = await generarSeguimientos();
  return Response.json({ seguimientos, ...(await procesarCola()) });
}
