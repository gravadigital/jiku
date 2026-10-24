import express, { Request, Response, NextFunction, Application } from 'express';
import * as routes from './lib/routes';
import cors from 'cors';
import path from 'path';
import logger from './lib/logger';
import  expressWinston  from 'express-winston';
import './lib/interfaces';
import publicPaths from './config/public';
import validateToken from './lib/utils/middlewares/validate-token';
import {synchronizeIdentityKeys} from './lib/utils/auth-helper';
import { connectBus } from './lib/utils/bus';
import { docsModule } from './lib/modules/registry';
import publicRoutes from './lib/public-routes';
import { publicHostOnly } from './lib/utils/middlewares/public-docs';
import { PUBLIC_DOCS_PATH } from './lib/modules/docs/public-url';
import { parseTrustProxy } from './lib/utils/trust-proxy';

/**
 * Límite de body de las rutas de escritura de `/api/docs` (POST y PUT). 768 KiB = 256 KiB de
 * `content` con 2x de expansión por el escapado de JSON (saltos de línea, comillas) y holgura para el
 * sobre del request. Lo que supere eso sigue siendo 413 (los documentos de más de 256 KiB no se
 * editan por estas rutas, ver el plan de S-079).
 */
export const DOCS_WRITE_BODY_LIMIT = '768kb';
const docsJsonParser = express.json({ limit: DOCS_WRITE_BODY_LIMIT });
function docsWriteJson(req: Request, res: Response, next: NextFunction) {
  return req.method === 'POST' || req.method === 'PUT' ? docsJsonParser(req, res, next) : next();
}

/**
 * DD-3 de REQ-017: el 413 de body-parser (`entity.too.large`, de cualquiera de los parsers: el de
 * /api/docs con 768 KiB o el global con 100 kb) sale con la forma de error de toda la api en lugar del
 * HTML del finalhandler. Cuatro argumentos, y todo lo que no reconoce sigue su camino con next(err): el
 * 404 del fallback de arriba y cualquier otro error no cambian. No loguea: es un error del cliente, y en
 * /p/docs/* la URL lleva el token del link.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function payloadTooLargeHandler(err: any, _req: Request, res: Response, next: NextFunction) {
  if (err?.type === 'entity.too.large' && !res.headersSent) {
    return res.status(413).json({
      code: 'payload_too_large',
      message: 'El cuerpo de la solicitud supera el límite permitido',
    });
  }
  return next(err);
}

export function initialize(): Application {
  const app: Application = express();
  app.set('query parser', 'extended');
  // DD-11: detrás del ingress todas las IP serían la del proxy y un visitante agotaría el cupo del
  // rate limit de /p/docs/* de todos. Vacía = default de Express (sin proxy). Un valor inválido
  // hace lanzar a Express y la api no arranca, a propósito.
  const trustProxy = parseTrustProxy(process.env.API_TRUST_PROXY);
  if (trustProxy !== undefined) app.set('trust proxy', trustProxy);
  // DD-10: PRIMER middleware. En el host público la api no sirve nada que no sea /p/docs/*; va antes
  // de validateToken y del logger para que esos 404 no revelen la api ni ensucien el log.
  app.use(publicHostOnly);
  app.use(cors());
  // Las escrituras de /docs llevan `content` inline de hasta 256 KiB (contrato de jiku-docs): el
  // límite por defecto de body-parser (100 kb) las rechazaría con 413 antes de llegar a la ruta.
  // Este parser va ANTES del global y, al dejar el body leído, el global lo saltea; el resto de la
  // api conserva su límite.
  app.use('/api/docs', docsWriteJson);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, 'public')));

  app.use(expressWinston.logger({
    winstonInstance: logger,
    expressFormat: true,
    colorize: false,
    meta: false,
    statusLevels: true,
    // La URL de /p/docs/* lleva el token del link: no puede estar en ningún log. Esas rutas
    // registran su propia línea con el token enmascarado (publicDocsAccessLog).
    ignoreRoute: (req) => PUBLIC_DOCS_PATH.test(req.path)
  }));

  app.get(publicPaths('get'), validateToken);
  app.patch(publicPaths('patch'), validateToken);
  app.post(publicPaths('post'), validateToken);
  app.put(publicPaths('put'), validateToken);
  app.delete(publicPaths('delete'), validateToken);

  // DD-10: las rutas públicas de links compartidos se montan UNA vez en la RAÍZ, fuera de /api (el
  // link es {JIKU_PUBLIC_URL}/p/docs/{token}). Por eso no van en el barrel de lib/routes, que el
  // bucle de abajo monta entero bajo /api. Quedan después de validateToken: sin la exención de
  // config/public.ts responderían 401.
  app.use(publicRoutes);

  for (const key of Object.keys(routes)) {
    app.use('/api', routes[key as keyof typeof routes]);
  }

  app.use(function (_req, _res, next) {
    const err = { message: 'Not Found', status: 404, stack: {}, };
    next(err);
  });

  app.use((res: Response) => {
    console.error('Not Found');
    return res.status(400).json({
      status: 'not_found',
      message: 'Not Found'
    });
  });
  // DD-3: AL FINAL de la cadena, para recibir el error de cualquier parser sin interceptar nada más.
  app.use(payloadTooLargeHandler);
  return app;
}

export function afterInitialize(): Promise<void> {
  // La api publica los comandos de escritura por NATS. Si el bus no está disponible al
  // arrancar, las rutas de escritura responden 503 hasta que se restablezca.
  return connectBus()
    .catch((error: Error) => {
      logger.error(`[bus] no se pudo conectar: ${error.message}`);
    })
    // DD-6: `start()` nunca rechaza; un registro ilegible no tumba la api. Se espera (acotado por
    // los timeouts del bus) para que los primeros requests vean el estado real.
    .then(() => docsModule.start())
    .then(() => synchronizeIdentityKeys());
}
