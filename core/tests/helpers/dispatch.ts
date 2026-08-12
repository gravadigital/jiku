import { Dispatcher } from '../../src/bus/dispatcher';
import { INSTANCE, PROTOCOL_VERSION, SERVICE_NAME, Reply } from '@jiku/nats-protocol';
import { registry } from '../../src/commands';

const dispatcher = new Dispatcher(registry);

/**
 * Despacha un comando como si hubiera llegado por el bus, armando el subject completo.
 *
 * Entra por el mismo camino que un mensaje real —incluida la transacción del
 * despachador—, así los tests verifican el comportamiento de punta a punta y no solo
 * el `execute` de cada comando.
 *
 *   await dispatch('clients.new', { name: 'Acme' })
 */
export function dispatch<T = unknown>(
  command: string,
  payload: unknown,
  caller = 'api'
): Promise<Reply<T>> {
  const subject = `${INSTANCE}.${caller}.${SERVICE_NAME}.${PROTOCOL_VERSION}.${command}`;
  return dispatcher.dispatch(subject, payload) as Promise<Reply<T>>;
}
