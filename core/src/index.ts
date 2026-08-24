import * as dotenv from 'dotenv';
dotenv.config();

import { COMMAND_SERVICE, QUERY_SERVICE, authEventSubject } from '@jiku/nats-protocol';
import logger from './logger';
import initializeDb from './models';
import { readDb } from './models/read';
import { loadConfig } from './config';
import { BusHost } from './bus/host';
import { Dispatcher } from './bus/dispatcher';
import { registry } from './commands';
import { QueryDispatcher } from './queries/dispatcher';
import { queryRegistry } from './queries';
import { EventDispatcher } from './events/dispatcher';
import { syncUser } from './events/auth/user-sync';

const dispatcher = new Dispatcher(registry);

// La conexión de lectura se inyecta acá y no se importa dentro de `queries/`: es lo que permite
// testear el módulo con otra conexión, lo que hace que el import de `read.ts` —y con él la
// construcción de su Sequelize, que lee `process.env` al importarse— ocurra DESPUÉS de dotenv, y
// lo que mantiene a `queries/` sin ninguna referencia al ORM.
const queries = new QueryDispatcher(queryRegistry, readDb);

// El despachador de eventos: su propio objeto, con su propia validación y su propia transacción.
// Se construye al nivel del módulo igual que los otros dos, que es lo que permite pasarle el
// consumidor al host en la misma expresión.
const events = new EventDispatcher(syncUser);

// Un spec por servicio del bus, sobre la MISMA conexión: `nc.services.add()` no tiene singleton,
// así que cada uno se anuncia por separado en `$SRV`, con su queue group y sus contadores. El
// orden es el del contrato: comandos primero, consultas después.
const host = new BusHost(
  {
    name: COMMAND_SERVICE,
    description: 'Comandos de dominio de Jiku: la única vía de escritura a la base',
    patterns: registry.patterns(),
    handle: (subject, payload) => dispatcher.dispatch(subject, payload),
  },
  {
    name: QUERY_SERVICE,
    description: 'Consultas de lectura de Jiku: proyectos, tareas y comentarios',
    patterns: queryRegistry.patterns(),
    handle: (subject, payload) => queries.dispatch(subject, payload),
  }
  // El consumidor de eventos va sobre la MISMA conexión que los dos servicios micro: el callout
  // mintea los permisos POR CONEXIÓN, así que `templates/core.yaml` autoriza las suscripciones de
  // comandos y consultas y la del evento en la misma plantilla. Los dos specs de arriba NO
  // CAMBIAN: el evento no es un endpoint micro, y por eso va por `withEventConsumer()`.
).withEventConsumer({
  // El subject SE DERIVA de `INSTANCE` en el paquete, igual que los de comandos y consultas. No
  // hay variable que lo pise: una permitiría desalinear el código respecto del permiso del
  // callout SIN NINGÚN SÍNTOMA.
  subject: authEventSubject(),
  // La lambda y no `events.dispatch` a secas: el segundo pierde el `this` de la clase y falla en
  // runtime con "Cannot read properties of undefined".
  handle: (payload) => events.dispatch(payload),
});

async function main(): Promise<void> {
  // Antes que nada: si falta configuración obligatoria, el proceso tiene que morir acá y no
  // atender el primer comando con una identidad mal resuelta.
  loadConfig();

  await initializeDb();
  // Una línea por servicio, no una sola con los dos números: es lo que hace obvio en el log si
  // uno de los dos no se registró.
  logger.info(`[core] ${registry.patterns().length} registered commands`);
  logger.info(`[core] ${queryRegistry.patterns().length} registered queries`);
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
