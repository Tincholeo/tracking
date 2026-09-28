// "GoogleImageProxy" NO es un bot: es como Gmail carga las imágenes cuando un
// humano abre el correo, así que cuenta como apertura real.

// Escáner de seguridad de Gmail: user-agent falso de Edge 12 / Chrome 42.
const GMAIL_SCANNER_UA = /Chrome\/42\.0\.2311\.135.*Edge\/12\.246/;
// Rango de rastreadores de Google (el proxy de imágenes usa 66.102.x.x).
const GOOGLE_CRAWLER_IP = /^66\.249\./;

const SCANNER_UA = /mimecast|proofpoint|barracuda|symantec|mailscanner|bot|crawler|spider|scanner|slurp/i;

// Un hit a los pocos segundos del envío casi nunca es un humano.
const UMBRAL_SEGUNDOS = 10;

export function esAperturaSospechosa(
  userAgent: string,
  ip: string,
  segundosDesdeEnvio: number | null
): boolean {
  if (GMAIL_SCANNER_UA.test(userAgent)) return true;
  if (GOOGLE_CRAWLER_IP.test(ip.split(",")[0].trim())) return true;
  if (SCANNER_UA.test(userAgent)) return true;
  if (segundosDesdeEnvio !== null && segundosDesdeEnvio < UMBRAL_SEGUNDOS) return true;
  return false;
}
