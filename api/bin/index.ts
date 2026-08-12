import * as dotenv from 'dotenv';
dotenv.config();
import {afterInitialize, initialize} from '../app';
import initializeDb from '../lib/models/index';
import logger from '../lib/logger';
import {assertAuthConfig} from '../lib/utils/middlewares/validate-token';
import {Application} from 'express';
let application: Application;

// Antes de escuchar: si la configuración de autenticación no es utilizable, no arrancamos.
// Es preferible fallar acá que levantar la api sin validar tokens.
assertAuthConfig();

initializeDb()
  .then(() => {
    application = initialize();
    return afterInitialize();
  })
  .then(() => {
    application.listen(process.env.SERVER_PORT);
    logger.info(`Your server is listening on port ${process.env.SERVER_PORT}`);
  })
  .catch((error: Error): void => {
    logger.error('Error starting the application');
    logger.error(error.message);
    logger.error(error.stack);
    // Código 1: un arranque fallido tiene que verse como fallido para docker/pm2/systemd.
    return process.exit(1);
  });
