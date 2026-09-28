import { NextRequest } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";
import { CONSULTA_CONTACTOS } from "@/lib/contacts";

function celda(valor: unknown) {
  const texto = valor instanceof Date ? valor.toISOString() : String(valor ?? "");
  // Evita que Excel interprete el contenido como fórmula al abrir el CSV.
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  return /[",\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

export async function GET(request: NextRequest) {
  const ids = (request.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);

  const [filas] = await getPool().query<RowDataPacket[]>(
    `${CONSULTA_CONTACTOS}
     ${ids.length ? "WHERE c.id IN (?)" : ""}
     GROUP BY c.id
     ORDER BY c.email`,
    ids.length ? [ids] : []
  );

  const encabezado = ["email", "nombre", "empresa", "etiquetas", "estado", "enviados", "abiertos", "clics", "ultimo_envio_utc", "creado_utc"];
  const lineas = filas.map((f) =>
    [f.email, f.nombre, f.empresa, (f.etiquetas ?? "").replace(/,/g, "; "), f.estado, f.enviados, f.abiertos, f.clicados, f.ultimo_envio ?? "", f.creado_at]
      .map(celda)
      .join(",")
  );
  // BOM para que Excel respete los acentos.
  const csv = "﻿" + [encabezado.join(","), ...lineas].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contactos-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
