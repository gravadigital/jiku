import * as dotenv from 'dotenv';
dotenv.config();

import logger from './logger';
import initializeDb from './models';
import { loadConfig } from './config';
import { Consumer } from './bus/consumer';
import { Dispatcher } from './bus/dispatcher';
import { registry } from './commands';

const consumer = new Consumer(new Dispatcher(registry));

async function main(): Promise<void> {
  // Antes que nada: si falta configuración obligatoria, el proceso tiene que morir acá y no
  // atender el primer comando con una identidad mal resuelta.
  loadConfig();

  await initializeDb();
  logger.info(`[core] ${registry.patterns().length} registered commands`);
  await consumer.start();
}

/** Drena el bus antes de salir para no cortar mensajes en vuelo. */
function shutdown(signal: string): void {
  logger.info(`[core] ${signal} recibido, cerrando`);
  consumer
    .stop()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((error: Error) => {
  logger.error(`[core] no pudo arrancar: ${error.message}`);
  logger.error(error.stack);
  process.exit(1);
});
