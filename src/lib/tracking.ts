// Reescribe el HTML de un correo para insertar el pixel de tracking de apertura
// y reescribir los links para que pasen por /track/click antes de ir al destino real.

const LINK_REGEX = /href="(https?:\/\/[^"]+)"/g;

export function injectTracking(html: string, emailId: string, baseUrl: string) {
  const withTrackedLinks = html.replace(LINK_REGEX, (_match, url: string) => {
    const trackedUrl = `${baseUrl}/track/click/${emailId}?url=${encodeURIComponent(url)}`;
    return `href="${trackedUrl}"`;
  });

  const pixel = `<img src="${baseUrl}/track/open/${emailId}" width="1" height="1" alt="" style="display:none" />`;

  return `${withTrackedLinks}${pixel}`;
}

// GIF transparente de 1x1, usado como respuesta del endpoint de apertura.
export const TRANSPARENT_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7",
  "base64"
);
