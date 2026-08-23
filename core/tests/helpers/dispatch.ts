import { Reply, commandSubject } from '@jiku/nats-protocol';
import { Dispatcher } from '../../src/bus/dispatcher';
import { registry } from '../../src/commands';

const dispatcher = new Dispatcher(registry);

/**
 * Despacha un comando como si hubiera llegado por el bus, armando el subject completo.
 *
 * Entra por el mismo camino que un mensaje real —incluida la transacción del
 * despachador—, así los tests verifican el comportamiento de punta a punta y no solo
 * el `execute` de cada comando.
 *
 * El subject lo arma `commandSubject()` y no una concatenación local: la gramática vive en el
 * paquete, y duplicarla acá dejaba que los tests pasaran contra una forma vieja del subject.
 *
 *   await dispatch('clients.new', { name: 'Acme' })
 */
export function dispatch<T = unknown>(
  command: string,
  payload: unknown,
  caller = 'api'
): Promise<Reply<T>> {
  return dispatcher.dispatch(commandSubject(command, caller), payload) as Promise<Reply<T>>;
}
