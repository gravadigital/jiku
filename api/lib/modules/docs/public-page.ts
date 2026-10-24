import { Response } from 'express';

/**
 * Cabeceras de TODA respuesta de `/p/docs/*` (200, 302, 404, 429, 503), solo lectura.
 *
 * `img-src 'self' https: data:` (H-5): las imágenes apuntan a `/p/docs/{token}/attachments/{id}`, que
 * redirige (302) al storage S3, y la CSP se evalúa también contra el destino de la redirección:
 * `img-src 'self'` rompería toda imagen. La CSP va en UNA línea (el header no admite saltos).
 * `Referrer-Policy: no-referrer` evita que el token viaje como `Referer` al storage tras el 302.
 */
export const PUBLIC_DOCS_HEADERS: Record<string, string> = {
  'Content-Security-Policy':
    'default-src \'none\'; img-src \'self\' https: data:; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'; frame-ancestors \'none\'',
  'X-Robots-Tag': 'noindex',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};

/**
 * Páginas de excepción (`docs/ux/cross-surface-flows.md`, Flujo 5). Idénticas para cualquier causa:
 * no revelan si un link existió, venció o fue revocado. Sin datos del pedido ni marca de producto.
 */
export const PUBLIC_NOTICES = {
  404: {
    title: 'Este link no está disponible',
    text: 'Puede que haya vencido o que lo hayan revocado. Pedile un link nuevo a quien te lo compartió.',
  },
  429: {
    title: 'Demasiados intentos',
    text: 'Esperá un minuto y volvé a intentar.',
  },
  503: {
    title: 'El documento no está disponible en este momento',
    text: 'Probá de nuevo en unos minutos.',
  },
} as const;

export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Plantilla mínima (DD-12). `html` va TAL CUAL: lo sanitizó jiku-docs y la api no re-sanitiza ni
 * parsea markdown. Sin scripts, sin enlaces a la aplicación, sin marca de Jiku ni de Grava.
 */
export function renderSharedDocument(title: string, html: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.6;color:#1f2328;background:#fff}
main{max-width:760px;margin:0 auto;padding:24px 16px}
img{max-width:100%;height:auto}
pre{overflow-x:auto;padding:12px;background:#f6f8fa}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
table{border-collapse:collapse;display:block;overflow-x:auto}
th,td{border:1px solid #d0d7de;padding:4px 8px}
</style>
</head>
<body><main>${html}</main></body>
</html>
`;
}

export function sendSharedDocument(res: Response, title: string, html: string): Response {
  res.set(PUBLIC_DOCS_HEADERS);
  return res.status(200).type('html').send(renderSharedDocument(title, html));
}

export function sendPublicNotice(res: Response, status: 404 | 429 | 503): Response {
  const { title, text } = PUBLIC_NOTICES[status];
  res.set(PUBLIC_DOCS_HEADERS);
  return res
    .status(status)
    .type('html')
    .send(renderSharedDocument(title, `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(text)}</p>`));
}
