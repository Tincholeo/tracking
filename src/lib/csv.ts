function separarFilas(texto: string, separador: string) {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entreComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (entreComillas) {
      if (ch === '"' && texto[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (ch === '"') {
        entreComillas = false;
      } else {
        celda += ch;
      }
    } else if (ch === '"') {
      entreComillas = true;
    } else if (ch === separador) {
      fila.push(celda);
      celda = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && texto[i + 1] === "\n") i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = "";
    } else {
      celda += ch;
    }
  }
  if (celda || fila.length) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas.map((f) => f.map((c) => c.trim())).filter((f) => f.some(Boolean));
}

const COLUMNAS = {
  email: /^(e-?mail|correo( electr[oó]nico)?|mail|email address)$/i,
  nombre: /^(nombre( completo)?|name|full name|contacto)$/i,
  empresa: /^(empresa|compa[nñ][ií]a|company|organizaci[oó]n|organization)$/i,
};

export type FilaContacto = { email: string; nombre: string; empresa: string };

// Lee un CSV de contactos. Reconoce encabezados comunes (email/correo,
// nombre/name, empresa/company) y, si no hay encabezado, toma como email la
// columna que contiene "@" y la siguiente como nombre.
export function leerContactosCsv(texto: string): FilaContacto[] {
  const limpio = texto.replace(/^﻿/, "");
  const primera = limpio.split(/\r?\n/)[0] ?? "";
  const separador = (primera.match(/;/g)?.length ?? 0) > (primera.match(/,/g)?.length ?? 0) ? ";" : ",";
  const filas = separarFilas(limpio, separador);
  if (filas.length === 0) return [];

  const encabezado = filas[0];
  let iEmail = encabezado.findIndex((c) => COLUMNAS.email.test(c));
  let iNombre = encabezado.findIndex((c) => COLUMNAS.nombre.test(c));
  let iEmpresa = encabezado.findIndex((c) => COLUMNAS.empresa.test(c));
  let datos = filas.slice(1);

  if (iEmail === -1) {
    iEmail = encabezado.findIndex((c) => c.includes("@"));
    if (iEmail === -1) return [];
    iNombre = encabezado.length > 1 ? (iEmail === 0 ? 1 : 0) : -1;
    iEmpresa = -1;
    datos = filas;
  }

  return datos
    .map((f) => ({
      email: (f[iEmail] ?? "").toLowerCase(),
      nombre: iNombre >= 0 ? (f[iNombre] ?? "") : "",
      empresa: iEmpresa >= 0 ? (f[iEmpresa] ?? "") : "",
    }))
    .filter((c) => c.email);
}
