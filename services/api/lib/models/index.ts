import { Sequelize } from 'sequelize-typescript';
import { allModels } from '@jiku/models';
import logger from '../../lib/logger';

const NODE_ENV = process.env.NODE_ENV || 'production';

const CONN_MAX_ATTEMPTS = 5;
const CONN_INTERVAL = 1;

/**
 * La conexión de la api: es de SOLO LECTURA.
 *
 * Los modelos vienen de `@jiku/models` y se registran explícitamente. El paquete no
 * abre la conexión a propósito: core usa la misma definición con el usuario que escribe.
 */
export const sequelize = new Sequelize({
  database: process.env.POSTGRESQL_DB,
  username: process.env.POSTGRESQL_USER,
  password: process.env.POSTGRESQL_PASSWORD,
  port: Number(process.env.POSTGRESQL_PORT) || 5432,
  host: process.env.POSTGRESQL_HOST,
  dialect: 'postgres',
  omitNull: false,
  models: allModels,
  logging: false
});

function waitInterval(seconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}

async function connectToDatabase() {
  let attempt = 0;
  let connectionOk = false;
  while (!connectionOk && attempt < CONN_MAX_ATTEMPTS) {
    logger.debug(`[DB] Attempting to connect -> ${attempt}`);
    attempt++;
    try {
      await sequelize.authenticate();
      connectionOk = true;
    } catch (error: any) {
      logger.info(`Connection error: ${error.message}`);
      await waitInterval(CONN_INTERVAL);
    }
  }
  if (!connectionOk) {
    throw new Error('Cant connect database');
  }
}

function initializeDb() {
  return connectToDatabase()
    .then(() => {
      if (['testing', 'development'].includes(NODE_ENV)) {
        logger.debug(`[DB] Syncing database in ${NODE_ENV} mode...`);
        return sequelize.sync().then((result) => {
          logger.debug('[DB] Database synced successfully');
          return result;
        });
      }
      return null;
    });
}

export default initializeDb;
