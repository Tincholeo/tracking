// Descripción aproximada del dispositivo a partir del user-agent. Gmail y
// Apple Mail cargan las imágenes desde sus servidores, así que en esos casos
// solo se sabe el cliente de correo, no el dispositivo real.
export function describirDispositivo(userAgent: string | null) {
  const ua = userAgent ?? "";
  if (!ua) return "Desconocido";
  if (/GoogleImageProxy/i.test(ua)) return "Gmail (no informa el dispositivo)";
  if (/Microsoft Outlook|ms-office|Outlook-iOS|Outlook-Android/i.test(ua)) return "Outlook";
  if (/YahooMailProxy/i.test(ua)) return "Yahoo Mail";

  const sistema = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : "";
  const navegador = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : /Mozilla\/5\.0/.test(ua) && /AppleWebKit/.test(ua)
              ? "Apple Mail"
              : "";

  return [navegador, sistema].filter(Boolean).join(" en ") || "Desconocido";
}
