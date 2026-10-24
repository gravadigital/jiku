import { NextFunction, Request, Response } from 'express';
import { MemoryStore, rateLimit } from 'express-rate-limit';
import logger from '../../logger';
import { PUBLIC_DOCS_PATH, isPublicHostRequest, maskPublicDocsUrl } from '../../modules/docs/public-url';
import { PUBLIC_DOCS_HEADERS, sendPublicNotice } from '../../modules/docs/public-page';

export const PUBLIC_DOCS_RATE_LIMIT = 60;
export const PUBLIC_DOCS_RATE_WINDOW_MS = 60_000;
/** Store explícito: en memoria y POR RÉPLICA (R-5). Exportado para que los tests lo vacíen. */
export const PUBLIC_DOCS_RATE_STORE = new MemoryStore();

/**
 * PRIMER middleware de la app (DD-10): en el host público la api no sirve nada más que
 * GET/HEAD `/p/docs/<algo>`; todo lo demás recibe el 404 genérico. Va antes de `validateToken` (un
 * `GET /api/clients` no tiene que dar un 401 que revele que hay una api detrás) y antes del logger de
 * requests (esos 404 no son pedidos a la aplicación). En cualquier otro host no hace nada.
 */
export function publicHostOnly(req: Request, res: Response, next: NextFunction) {
  if (!isPublicHostRequest(req)) return next();
  if ((req.method === 'GET' || req.method === 'HEAD') && PUBLIC_DOCS_PATH.test(req.path)) return next();
  return sendPublicNotice(res, 404);
}

/** Las cinco cabeceras de solo lectura en TODA respuesta de `/p/docs/*`, también 302 y 404. */
export function publicDocsHeaders(_req: Request, res: Response, next: NextFunction) {
  res.set(PUBLIC_DOCS_HEADERS);
  next();
}

/**
 * Una línea de log por pedido con el token enmascarado. El logger de requests ignora `/p/docs/*`
 * (`ignoreRoute` en `app.ts`) porque la URL lleva el token, que no puede estar en ningún log.
 * Nunca se loguea IP, User-Agent, título ni contenido.
 */
export function publicDocsAccessLog(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    const line = `${req.method} ${maskPublicDocsUrl(req.originalUrl)} ${res.statusCode} ${Date.now() - start}ms`;
    logger[res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'](line);
  });
  next();
}

/** Paso 1 de la cadena: sin `JIKU_PUBLIC_URL` o `Host` distinto -> 404 genérico sin llamar a nada. */
export function requirePublicHost(req: Request, res: Response, next: NextFunction) {
  return isPublicHostRequest(req) ? next() : sendPublicNotice(res, 404);
}

/**
 * Paso 2: 60 pedidos/min por IP sobre `/p/docs/*` (DD-11). UN solo limitador para las dos rutas: la
 * página y sus imágenes comparten cupo (P-8). A nivel de módulo (la v8 avisa si se crea uno por
 * request) y con el `keyGenerator` por defecto (maneja la máscara IPv6). Las validaciones de la
 * librería quedan activas: un `X-Forwarded-For` sin `trust proxy` es un `API_TRUST_PROXY` olvidado.
 */
export const publicDocsRateLimit = rateLimit({
  windowMs: PUBLIC_DOCS_RATE_WINDOW_MS,
  limit: PUBLIC_DOCS_RATE_LIMIT,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: PUBLIC_DOCS_RATE_STORE,
  handler: (_req, res) => {
    sendPublicNotice(res, 429);
  },
});

/** Catch-all de `/p/docs/*`: cualquier otro path es el mismo 404 genérico. */
export function publicDocsNotFound(_req: Request, res: Response) {
  return sendPublicNotice(res, 404);
}
