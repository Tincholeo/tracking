export function urlBaja(emailId: string, baseUrl: string) {
  return `${baseUrl}/baja/${emailId}`;
}

export function pieBaja(emailId: string, baseUrl: string) {
  return `<p style="margin-top:32px;font-size:12px;color:#8a8a8a;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">Si no querés recibir más correos, podés <a href="${urlBaja(emailId, baseUrl)}" style="color:#8a8a8a">darte de baja acá</a>.</p>`;
}

// Encabezados estándar (RFC 8058): Gmail y otros muestran un botón "Anular
// suscripción" que llama a este endpoint con un POST de un clic.
export function encabezadosBaja(emailId: string, baseUrl: string) {
  return {
    "List-Unsubscribe": `<${baseUrl}/api/unsubscribe/${emailId}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
