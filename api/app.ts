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

export function initialize(): Application {
  const app: Application = express();
  app.set('query parser', 'extended');
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
    statusLevels: true
  }));

  app.get(publicPaths('get'), validateToken);
  app.patch(publicPaths('patch'), validateToken);
  app.post(publicPaths('post'), validateToken);
  app.put(publicPaths('put'), validateToken);
  app.delete(publicPaths('delete'), validateToken);


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
