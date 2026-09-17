import * as dotenv from 'dotenv';
dotenv.config();

import { COMMAND_SERVICE, QUERY_SERVICE, authEventSubject } from '@jiku/nats-protocol';
import logger from './logger';
import initializeDb from './models';
import { readDb } from './models/read';
import { loadConfig } from './config';
import { BusHost } from './bus/host';
import { Dispatcher } from './bus/dispatcher';
import { EventPublisher } from './bus/event-publisher';
import { registry } from './commands';
import { QueryDispatcher, budgetFrom } from './queries/dispatcher';
import { queryRegistry } from './queries';
import { EventDispatcher } from './events/dispatcher';
import { syncUser } from './events/auth/user-sync';
import { startDispatchLoop, stopDispatchLoop } from './notifications/dispatch';

// EL PUBLICADOR SE RESUELVE DE FORMA PEREZOSA, EN UN OBJETO INTERMEDIO (D-3 de S-063), por el
// mismo problema de orden que resuelve el presupuesto de bytes tres líneas más abajo: `dispatcher`
// se construye ACÁ, antes de que `host` exista (se declara más abajo) y mucho antes de que
// `host.start()` abra la conexión. `host.eventPublisher()` LANZA si se llama antes de `start()`,
// así que no se puede invocar al construir `dispatcher` — hay que envolverlo en un objeto cuyo
// `publish()` recién resuelve el publicador real en el primer uso, análogo a la closure de
// `budgetFrom(host.maxPayload())`. La diferencia con esa closure es de FORMA, no de fondo:
// `Dispatcher` pide un `EventPublisher` (un objeto con `.publish()`), no una función, así que el
// proveedor perezoso tiene que tener esa forma.
const eventPublisher: EventPublisher = {
  publish: (subject, payload) => host.eventPublisher().publish(subject, payload),
};

const dispatcher = new Dispatcher(registry, eventPublisher);

// La conexión de lectura se inyecta acá y no se importa dentro de `queries/`: es lo que permite
// testear el módulo con otra conexión, lo que hace que el import de `read.ts` —y con él la
// construcción de su Sequelize, que lee `process.env` al importarse— ocurra DESPUÉS de dotenv, y
// lo que mantiene a `queries/` sin ninguna referencia al ORM.
//
// El tercer argumento es el PROVEEDOR PEREZOSO del presupuesto de bytes de la página. Es una
// closure y no un número: se invoca en CADA dispatch, así que una reconexión a un server con
// otro `max_payload` cambia el presupuesto sin reiniciar el proceso. La closure referencia
// `host`, que se declara más abajo: es válido porque se INVOCA después de `start()`, nunca
// durante la evaluación de este módulo.
// El tipo va explícito porque la closure de abajo referencia `host`, que a su vez referencia a
// `queries`: sin la anotación, TypeScript no puede inferir el tipo de ninguno de los dos.
const queries: QueryDispatcher = new QueryDispatcher(queryRegistry, readDb, () =>
  budgetFrom(host.maxPayload())
);

// El despachador de eventos: su propio objeto, con su propia validación y su propia transacción.
// Se construye al nivel del módulo igual que los otros dos, que es lo que permite pasarle el
// consumidor al host en la misma expresión.
const events = new EventDispatcher(syncUser);

// Un spec por servicio del bus, sobre la MISMA conexión: `nc.services.add()` no tiene singleton,
// así que cada uno se anuncia por separado en `$SRV`, con su queue group y sus contadores. El
// orden es el del contrato: comandos primero, consultas después.
const host: BusHost = new BusHost(
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

  // El proceso de envío de notificaciones arranca DESPUÉS de `host.start()` (CA-7, REQ-015/
  // S-073): es el primer plano de `core` que corre por TIEMPO y no por mensaje, y no depende de
  // que el bus esté arriba —solo de la base—, pero mantener el orden documentado (comandos,
  // consultas, notificaciones) es lo que hace obvio en el log qué arrancó y en qué secuencia.
  startDispatchLoop();
}

/**
 * Para los servicios y drena el bus antes de salir, para no cortar mensajes en vuelo.
 *
 * PASA A `async` (CA-7): antes de `host.stop()`, espera a que el proceso de envío pare — cancela
 * su timer y ESPERA la corrida en curso. Un `SIGTERM` a mitad de lote no corta el envío en seco:
 * los mails en curso completan, y por at-least-once los que no llegaron a marcarse se reenvían
 * en la réplica siguiente, sin lógica de deduplicación de por medio. Con un lote grande, esto
 * puede alargar la parada del contenedor hasta lo que tarde ese lote — es la razón práctica,
 * además del tamaño del pool, por la que `notification-batch-size` es configurable.
 *
 * SE CONSERVA el `.catch(() => process.exit(1))`: un fallo al cerrar (acá o en `host.stop()`)
 * sigue terminando el proceso, nunca lo deja colgado esperando para siempre.
 */
async function shutdown(signal: string): Promise<void> {
  logger.info(`[core] ${signal} recibido, cerrando`);
  try {
    await stopDispatchLoop();
    await host.stop();
    process.exit(0);
  } catch {
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((error: Error) => {
  logger.error(`[core] no pudo arrancar: ${error.message}`);
  logger.error(error.stack);
  process.exit(1);
});
