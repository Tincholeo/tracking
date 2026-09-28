import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import { describirDispositivo } from "@/lib/device";

export async function GET(_request: Request, ctx: RouteContext<"/api/emails/[id]">) {
  const { id } = await ctx.params;
  const pool = getPool();

  const [[email]] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, e.destinatario, e.asunto, e.cuerpo, e.estado, e.error_envio, e.enviado_at, e.creado_at,
       e.con_baja, e.seguimiento_hecho, e.programado_at, e.seguimiento_de, e.campana_id,
       s.condicion AS seg_condicion, s.dias AS seg_dias,
       c.nombre, c.empresa, c.estado AS estado_contacto
     FROM emails e
     LEFT JOIN seguimientos s ON s.id = e.seguimiento_id
     LEFT JOIN contactos c ON c.email = LOWER(e.destinatario)
     WHERE e.id = ?`,
    [id]
  );
  if (!email) return NextResponse.json({ error: "No existe" }, { status: 404 });

  const [aperturas] = await pool.query<RowDataPacket[]>(
    "SELECT abierto_at AS fecha, user_agent, sospechosa FROM aperturas WHERE email_id = ? ORDER BY abierto_at",
    [id]
  );
  const [clics] = await pool.query<RowDataPacket[]>(
    "SELECT click_at AS fecha, url_destino, user_agent FROM clics WHERE email_id = ? ORDER BY click_at",
    [id]
  );
  const [recordatorios] = await pool.query<RowDataPacket[]>(
    "SELECT id, asunto, estado, enviado_at FROM emails WHERE seguimiento_de = ? ORDER BY creado_at",
    [id]
  );
  const [original] = email.seguimiento_de
    ? await pool.query<RowDataPacket[]>("SELECT id, asunto, enviado_at FROM emails WHERE id = ?", [email.seguimiento_de])
    : [[]];

  return NextResponse.json({
    email,
    aperturas: aperturas.map((a) => ({
      fecha: a.fecha,
      dispositivo: describirDispositivo(a.user_agent),
      descartada: Boolean(a.sospechosa),
    })),
    clics: clics.map((k) => ({ fecha: k.fecha, url: k.url_destino, dispositivo: describirDispositivo(k.user_agent) })),
    recordatorios,
    original: original[0] ?? null,
  });
}
