import type { NextRequest } from "next/server";
import { enviarReporteSemanal } from "@/lib/weeklyReport";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const destino = await enviarReporteSemanal();
    return Response.json({ ok: true, destino });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
