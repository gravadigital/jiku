import * as dotenv from 'dotenv';
dotenv.config();

import { COMMAND_SERVICE } from '@jiku/nats-protocol';
import logger from './logger';
import initializeDb from './models';
import { loadConfig } from './config';
import { BusHost } from './bus/host';
import { Dispatcher } from './bus/dispatcher';
import { registry } from './commands';

const dispatcher = new Dispatcher(registry);

// Un spec por servicio del bus. Hoy hay uno; el segundo es un elemento más en esta misma
// llamada, sobre la misma conexión.
const host = new BusHost({
  name: COMMAND_SERVICE,
  description: 'Comandos de dominio de Jiku: la única vía de escritura a la base',
  patterns: registry.patterns(),
  handle: (subject, payload) => dispatcher.dispatch(subject, payload),
});

async function main(): Promise<void> {
  // Antes que nada: si falta configuración obligatoria, el proceso tiene que morir acá y no
  // atender el primer comando con una identidad mal resuelta.
  loadConfig();

  await initializeDb();
  logger.info(`[core] ${registry.patterns().length} registered commands`);
  await host.start();
}

/** Para los servicios y drena el bus antes de salir, para no cortar mensajes en vuelo. */
function shutdown(signal: string): void {
  logger.info(`[core] ${signal} recibido, cerrando`);
  host
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
