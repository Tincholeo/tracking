import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import { marcarContacto } from "@/lib/contacts";
import { UUID } from "@/lib/unsubscribe";

// Público. Lo llaman la página /baja/[id] y el botón "Anular suscripción" de
// Gmail (POST de un clic, RFC 8058). Solo POST: los escáneres de enlaces hacen
// GET y no deben dar de baja a nadie por accidente.
export async function POST(_request: Request, ctx: RouteContext<"/api/unsubscribe/[id]">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response("Enlace inválido", { status: 400 });

  const [filas] = await getPool().query<RowDataPacket[]>(
    "SELECT destinatario FROM emails WHERE id = ? LIMIT 1",
    [id]
  );
  if (!filas[0]) return new Response("Enlace inválido", { status: 404 });

  await marcarContacto(filas[0].destinatario, "baja", "Desde el enlace del correo");
  return new Response("Listo, no vas a recibir más correos.", { status: 200 });
}
