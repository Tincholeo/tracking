// Heurísticas para filtrar aperturas de pixel que no son un humano leyendo el
// correo: escáneres de seguridad corporativos y proxies de imágenes de los
// propios proveedores de correo, que cargan la imagen automáticamente.

const BOT_USER_AGENT = /googleimageproxy|google-imageproxy|mimecast|proofpoint|barracuda|symantec|mailscanner|bot|crawler|spider|scanner|slurp/i;

// Si el pixel se dispara casi en el mismo instante del envío, es prácticamente
// imposible que sea un humano habiendo leído el correo.
const UMBRAL_SEGUNDOS = 5;

export function esAperturaSospechosa(
  userAgent: string,
  enviadoAt: Date,
  abiertoAt: Date
): boolean {
  if (BOT_USER_AGENT.test(userAgent)) return true;

  const segundos = (abiertoAt.getTime() - enviadoAt.getTime()) / 1000;
  if (segundos >= 0 && segundos < UMBRAL_SEGUNDOS) return true;

  return false;
}
