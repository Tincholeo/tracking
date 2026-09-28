import type { NextRequest } from "next/server";
import { procesarCola } from "@/lib/queue";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json(await procesarCola());
}
