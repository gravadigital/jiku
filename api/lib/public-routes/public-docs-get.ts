import { Request, Response, Router } from 'express';
import logger from '../logger';
import { fetchSharedHtml } from '../modules/docs/public-html';
import { sendPublicNotice, sendSharedDocument } from '../modules/docs/public-page';
import { queryShare, SharedDocument, SHARE_TOKEN_PATTERN } from '../modules/docs/public-share';

const router = Router();

/**
 * @name Shared document (public)
 * @description Página HTML de solo lectura con el documento de un link compartido (REQ-016 / S-080).
 * Es la única ruta sin credencial del producto y merece revisión propia: no lleva `hasAnyRole` ni
 * `requireModule` porque no hay identidad. Su control de acceso es la cadena host -> rate limit ->
 * formato del token -> estado del módulo -> jiku-docs (que valida el token contra su hash), y el
 * 404 es UNO solo para cualquier link inválido (no revela si existió).
 * @route {GET} /p/docs/:token
 * @response {200} text/html
 * @response {404} text/html Link no disponible (idéntico para cualquier causa)
 * @response {429} text/html Demasiados pedidos
 * @response {503} text/html Módulo no disponible
 */
async function readSharedDocument(req: Request, res: Response) {
  const token = String(req.params.token);
  // Paso 3: formato antes del bus. Mismo 404 que un token inexistente (CA-21).
  if (!SHARE_TOKEN_PATTERN.test(token)) return sendPublicNotice(res, 404);
  try {
    const result = await queryShare<SharedDocument>('shares.resolve', req, { token });
    if (!result.ok) return sendPublicNotice(res, result.status);
    const { title, html, htmlUrl } = result.data;
    if (typeof html === 'string') return sendSharedDocument(res, title, html);
    if (typeof htmlUrl === 'string') {
      return sendSharedDocument(res, title, await fetchSharedHtml(htmlUrl));
    }
    logger.error('[public-docs] shares.resolve: reply sin html ni htmlUrl');
    return sendPublicNotice(res, 503);
  } catch (error: any) {
    // Nunca se loguea el token, la URL ni el contenido: solo el código del error.
    logger.error(`GET /p/docs/:token readSharedDocument error: ${error.code || 'unexpected'}`);
    return sendPublicNotice(res, 503);
  }
}

router.get('/p/docs/:token', readSharedDocument);

export default router;
