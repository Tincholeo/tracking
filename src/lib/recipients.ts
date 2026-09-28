export type Destinatario = { email: string; nombre: string };

const EMAIL = /[^\s<>,;"'()]+@[^\s<>,;"'()]+\.[^\s<>,;"'()]+/g;
const EMAIL_VALIDO = /^[^\s@<>,;"'()]+@[^\s@<>,;"'()]+\.[a-z]{2,}$/i;

export function esEmailValido(email: string) {
  return EMAIL_VALIDO.test(email);
}

// Acepta una línea por destinatario en cualquiera de estas formas:
//   ana@x.com
//   Ana Pérez <ana@x.com>
//   ana@x.com, Ana Pérez   (o "Ana Pérez, ana@x.com")
// Una línea con varias direcciones se toma como varios destinatarios sin nombre.
export function parsearDestinatarios(texto: string) {
  const porEmail = new Map<string, Destinatario>();
  const invalidos: string[] = [];

  for (const linea of texto.split(/[\n;]+/)) {
    const limpia = linea.trim();
    if (!limpia) continue;

    const encontrados = limpia.match(EMAIL) ?? [];
    if (encontrados.length === 0) {
      invalidos.push(limpia);
      continue;
    }

    const nombre =
      encontrados.length === 1
        ? limpia.replace(encontrados[0], "").replace(/[<>"',]/g, " ").replace(/\s+/g, " ").trim()
        : "";

    for (const bruto of encontrados) {
      const email = bruto.toLowerCase();
      if (!esEmailValido(email)) {
        invalidos.push(bruto);
        continue;
      }
      const previo = porEmail.get(email);
      if (!previo) porEmail.set(email, { email, nombre });
      else if (!previo.nombre && nombre) previo.nombre = nombre;
    }
  }

  return { validos: [...porEmail.values()], invalidos };
}
