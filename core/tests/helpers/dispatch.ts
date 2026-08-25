import { Reply, commandSubject, querySubject } from '@jiku/nats-protocol';
import { Dispatcher } from '../../src/bus/dispatcher';
import { registry } from '../../src/commands';
import { getTrustedPublisherId } from '../../src/config';
import { readDb } from '../../src/models/read';
import { queryRegistry } from '../../src/queries';
import { DEFAULT_PAYLOAD_BUDGET_BYTES, QueryDispatcher } from '../../src/queries/dispatcher';

const dispatcher = new Dispatcher(registry);

/**
 * El presupuesto de bytes de la página, INYECTABLE.
 *
 * Los tests del corte por presupuesto (CA-14) y del item que solo no entra (CA-15) necesitan un
 * número chico y predecible. Depender del `max_payload` real de un server NATS haría el test
 * frágil —y obligaría a levantar un bus para probar una regla que no es del bus—, así que el
 * proveedor perezoso que el despachador acepta desde S-022 lee esta variable.
 *
 * El default es el mismo `DEFAULT_PAYLOAD_BUDGET_BYTES` del código: 524288, la mitad del
 * `max_payload` por defecto de NATS.
 */
let queryBudgetBytes = DEFAULT_PAYLOAD_BUDGET_BYTES;

/** Fija el presupuesto para el resto del test. Acordate de `resetQueryBudget()` en el `after`. */
export function setQueryBudget(bytes: number): void {
  queryBudgetBytes = bytes;
}

export function resetQueryBudget(): void {
  queryBudgetBytes = DEFAULT_PAYLOAD_BUDGET_BYTES;
}

// El proveedor se evalúa EN CADA dispatch, así que cambiar la variable entre dos despachos
// cambia el presupuesto del segundo sin reconstruir nada.
const queries = new QueryDispatcher(queryRegistry, readDb, () => queryBudgetBytes);

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
 *
 * EL DEFAULT DEL CALLER ES EL PUBLICADOR CONFIABLE, y cambió en S-017. Antes era `'api'`, que NO
 * coincide con `CORE_TRUSTED_PUBLISHER_ID`, y eso servía para que un test no cayera en la rama
 * confiable de `resolveActor` sin darse cuenta. Con la compuerta de autorización instalada esa
 * elección deja de ser viable: `'api'` no es el publicador confiable y no tiene fila en `users`,
 * así que los ~112 despachos que no pasan caller responderían `caller_not_authorized`. Las
 * alternativas eran pasar el caller explícito en 112 líneas de un diff que es un cambio de
 * seguridad, o inventar un rol de test que autorizara los 20 comandos —o sea un agujero en el
 * mapa que la suite mantendría abierto—.
 *
 * LO QUE HAY QUE SABER: un test que OLVIDE su caller cae ahora en la rama EXENTA, no en la
 * externa. La mitad que importaba se conserva: los tests de la rama externa siguen pasando su
 * caller explícito, porque afirman sobre él (`files.test.ts`, `requirements.test.ts`,
 * `attachments.test.ts`).
 *
 * Sale de `getTrustedPublisherId()` y no de un literal para que `core/.env.test` siga siendo la
 * única fuente del valor.
 */
export function dispatch<T = unknown>(
  command: string,
  payload: unknown,
  caller = getTrustedPublisherId()
): Promise<Reply<T>> {
  return dispatcher.dispatch(commandSubject(command, caller), payload) as Promise<Reply<T>>;
}

/**
 * Igual que `dispatch()` pero para el plano de CONSULTAS: subject con el token `jiku-queries` y
 * el despachador que NO abre transacción.
 *
 * Entra por el `QueryDispatcher` real sobre el `queryRegistry` real y `readDb`, así cada test
 * cubre también la compuerta de autorización y la resolución del método. Existe desde S-017: la
 * compuerta necesitaba ejercitar los dos planos y solo había helper para uno.
 */
export function dispatchQuery<T = unknown>(
  query: string,
  payload: unknown,
  caller = getTrustedPublisherId()
): Promise<Reply<T>> {
  return queries.dispatch(querySubject(query, caller), payload) as Promise<Reply<T>>;
}
