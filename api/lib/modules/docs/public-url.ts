import { Request } from 'express';

/**
 * Rutas públicas de links compartidos: `/p/docs/` seguido de al menos un carácter
 * (case-insensitive, como el router de Express).
 */
export const PUBLIC_DOCS_PATH = /^\/p\/docs\/./i;

/**
 * Host (con puerto si no es el default) de `JIKU_PUBLIC_URL`, en minúsculas, o `null` si no está
 * configurada (ausente o en blanco). Se lee en cada llamada (convención `env-config`), igual que
 * `docsFeatures()`: los dos miran la MISMA variable y el assert de arranque garantiza que no diverjan.
 */
export function publicDocsHost(): string | null {
  const raw = (process.env.JIKU_PUBLIC_URL || '').trim();
  if (!raw) return null;
  try {
    return new URL(raw).host.toLowerCase();
  } catch {
    // No se alcanza en producción (assertPublicUrlConfig corta el arranque); en tests protege.
    return null;
  }
}

/**
 * `true` si el header `Host` crudo del pedido es el host de `JIKU_PUBLIC_URL`.
 * Se compara contra `req.headers.host` y NO contra `req.hostname` ni `X-Forwarded-Host` (P-7): con
 * `trust proxy` Express leería `X-Forwarded-Host`, que arma el cliente si no hay proxy delante.
 */
export function isPublicHostRequest(req: Request): boolean {
  const host = publicDocsHost();
  return !!host && (req.headers.host || '').toLowerCase() === host;
}

/**
 * Corta el arranque si `JIKU_PUBLIC_URL` está configurada pero no es utilizable (P-3). Ausente o en
 * blanco es válido: los links quedan apagados. Una URL con path haría que jiku-docs entregue links
 * `.../docs/p/docs/{token}` que la api nunca sirve, con `features.sharing: true`: links rotos en
 * silencio (DD-14).
 */
export function assertPublicUrlConfig(): void {
  const raw = (process.env.JIKU_PUBLIC_URL || '').trim();
  if (!raw) return;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('JIKU_PUBLIC_URL no es una URL válida');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('JIKU_PUBLIC_URL tiene que usar http: o https:');
  }
  if ((url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) {
    throw new Error('JIKU_PUBLIC_URL tiene que ser solo el origen: sin path, query ni fragmento');
  }
}

/** `/p/docs/<token>/attachments/X?y` -> `/p/docs/jds_…/attachments/X` (sin query). Para el log. */
export function maskPublicDocsUrl(url: string): string {
  return url.split('?')[0].replace(/^(\/p\/docs\/)[^/]*/i, '$1jds_…');
}
