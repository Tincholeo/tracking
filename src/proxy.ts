import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Límite de intentos fallidos de Basic Auth por IP. Es en memoria (el proxy
// corre en el runtime Edge, sin acceso a MySQL), así que se resetea si Vercel
// recicla la instancia; igual frena a cualquier script que pruebe contraseñas
// en bucle, que es el riesgo real frente a una sola contraseña fija.
const MAX_INTENTOS = 8;
const VENTANA_MS = 10 * 60 * 1000;
const BLOQUEO_MS = 15 * 60 * 1000;
const intentos = new Map<string, { fallos: number; desde: number; bloqueadoHasta?: number }>();

function ip(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "desconocida";
}

function demasiadosIntentos(clave: string) {
  const registro = intentos.get(clave);
  if (!registro) return false;
  if (registro.bloqueadoHasta && registro.bloqueadoHasta > Date.now()) return true;
  if (registro.bloqueadoHasta && registro.bloqueadoHasta <= Date.now()) intentos.delete(clave);
  return false;
}

function registrarFallo(clave: string) {
  const ahora = Date.now();
  const registro = intentos.get(clave);
  if (!registro || ahora - registro.desde > VENTANA_MS) {
    intentos.set(clave, { fallos: 1, desde: ahora });
    return;
  }
  registro.fallos++;
  if (registro.fallos >= MAX_INTENTOS) registro.bloqueadoHasta = ahora + BLOQUEO_MS;
}

function unauthorized(bloqueado = false) {
  return new NextResponse(bloqueado ? "Demasiados intentos, probá de nuevo más tarde" : "Acceso restringido", {
    status: bloqueado ? 429 : 401,
    headers: bloqueado ? {} : { "WWW-Authenticate": 'Basic realm="Email Tracker"' },
  });
}

export function proxy(request: NextRequest) {
  const user = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;

  if (!user || !password) return unauthorized();

  const clave = ip(request);
  if (demasiadosIntentos(clave)) return unauthorized(true);

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    const givenUser = decoded.slice(0, separator);
    const givenPassword = decoded.slice(separator + 1);
    if (givenUser === user && givenPassword === password) {
      intentos.delete(clave);
      return NextResponse.next();
    }
  }

  registrarFallo(clave);
  return unauthorized();
}

export const config = {
  // Públicas: tracking, baja y webhook de Resend (firma propia). /api/cron/*
  // se autentica con CRON_SECRET en el propio handler.
  matcher: ["/((?!track/|baja/|api/unsubscribe/|api/webhooks/|api/cron/|_next/static|_next/image|favicon.ico).*)"],
};
