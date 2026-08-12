import express, { Response, Application } from 'express';
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

export function initialize(): Application {
  const app: Application = express();
  app.set('query parser', 'extended');
  app.use(cors());
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
    .then(() => synchronizeIdentityKeys());
}
