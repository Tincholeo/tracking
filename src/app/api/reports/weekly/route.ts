import { enviarReporteSemanal } from "@/lib/weeklyReport";

export async function POST() {
  try {
    const destino = await enviarReporteSemanal();
    return Response.json({ ok: true, destino });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
