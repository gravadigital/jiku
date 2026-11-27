import path from 'path';
const envPath = path.join(process.cwd(), '.env.test');
import * as dotenv from 'dotenv';
// Cargar variables de entorno del archivo .env.test
// Las variables POSTGRESQL_* son establecidas por run-tests.ts cuando se usa Testcontainers
dotenv.config({path: envPath});
import {initialize} from '../../app';
import initializeDb from '../../lib/models';
import logger from '../../lib/logger';

function initDb() {
  return initializeDb()
    .then(() => {
      return initialize();
    })
    .catch((error) => {
      logger.error('APP STOPPED');
      logger.error(error.stack);
      return process.exit(1);
    });
}

function start() {
  return initialize();
}

export {
  initDb,
  start
};