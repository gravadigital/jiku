import { Router } from 'express';
import {
  publicDocsAccessLog,
  publicDocsHeaders,
  publicDocsNotFound,
  publicDocsRateLimit,
  requirePublicHost,
} from '../utils/middlewares/public-docs';
import PublicDocsGet from './public-docs-get';
import PublicDocsAttachmentsGet from './public-docs-attachments-get';

/**
 * Rutas públicas, montadas en la RAÍZ de la api (fuera de `/api`) por `app.ts`. Excepción deliberada
 * a la convención `http-server` (DD-10): el link es `{JIKU_PUBLIC_URL}/p/docs/{token}`.
 *
 * La cadena común vive acá y no en cada ruta porque el límite es UNO para `/p/docs/*` y el catch-all
 * tiene que ver las mismas cabeceras. Orden: cabeceras -> log -> host -> rate limit -> rutas -> 404.
 */
const router = Router();
router.use('/p/docs', publicDocsHeaders, publicDocsAccessLog, requirePublicHost, publicDocsRateLimit);
router.use(PublicDocsGet);
router.use(PublicDocsAttachmentsGet);
router.use('/p/docs', publicDocsNotFound);

export default router;
