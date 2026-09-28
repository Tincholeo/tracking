import { escapeHtml } from "@/lib/html";

export type DatosContacto = { email: string; nombre: string; empresa: string };

export const VARIABLES = [
  { clave: "nombre", descripcion: "Nombre completo" },
  { clave: "primer_nombre", descripcion: "Solo el primer nombre" },
  { clave: "empresa", descripcion: "Empresa" },
  { clave: "email", descripcion: "Correo del destinatario" },
] as const;

const PATRON = /\{\{\s*(\w+)\s*(?:\|([^}]*))?\}\}/g;

function valores(datos: DatosContacto): Record<string, string> {
  const nombre = datos.nombre.trim();
  return {
    nombre,
    primer_nombre: nombre.split(/\s+/)[0] ?? "",
    empresa: datos.empresa.trim(),
    email: datos.email,
  };
}

// Reemplaza {{variable}} o {{variable|valor si está vacío}}. Las variables
// desconocidas quedan tal cual para que el error se note en la vista previa.
export function personalizar(plantilla: string, datos: DatosContacto, html: boolean) {
  const v = valores(datos);
  return plantilla.replace(PATRON, (original, clave: string, respaldo?: string) => {
    if (!(clave in v)) return original;
    const valor = v[clave] || (respaldo ?? "").trim();
    return html ? escapeHtml(valor) : valor;
  });
}

export function usaVariables(texto: string) {
  return new RegExp(PATRON.source).test(texto);
}
