import type { RowDataPacket } from "mysql2";
import { getPool } from "@/lib/db";

export type Ajustes = { nombreRemitente: string; responderA: string };

const CLAVES: Record<keyof Ajustes, string> = {
  nombreRemitente: "nombre_remitente",
  responderA: "responder_a",
};

// La dirección del remitente viene de RESEND_FROM_EMAIL porque tiene que ser
// del dominio verificado en Resend; desde el panel solo se cambia el nombre.
export function remitenteBase() {
  const valor = process.env.RESEND_FROM_EMAIL ?? "";
  const direccion = valor.match(/<([^>]+)>/)?.[1] ?? valor.trim();
  const nombre = valor.includes("<") ? valor.slice(0, valor.indexOf("<")).replace(/"/g, "").trim() : "";
  return { direccion, nombre };
}

export async function leerAjustes(): Promise<Ajustes> {
  const [filas] = await getPool().query<RowDataPacket[]>("SELECT clave, valor FROM ajustes");
  const mapa = new Map(filas.map((f) => [f.clave, f.valor as string]));
  return {
    nombreRemitente: mapa.get(CLAVES.nombreRemitente) ?? "",
    responderA: mapa.get(CLAVES.responderA) ?? "",
  };
}

export async function guardarAjustes(ajustes: Ajustes) {
  for (const [campo, clave] of Object.entries(CLAVES) as [keyof Ajustes, string][]) {
    await getPool().query(
      "INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
      [clave, ajustes[campo]]
    );
  }
}

export function remitente(ajustes: Ajustes) {
  const base = remitenteBase();
  const nombre = (ajustes.nombreRemitente || base.nombre).replace(/["<>]/g, "").trim();
  return nombre ? `"${nombre}" <${base.direccion}>` : base.direccion;
}
