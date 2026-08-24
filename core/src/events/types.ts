import { Transaction } from 'sequelize';

/**
 * Qué hizo el handler con el evento, y con eso el despachador decide la transacción.
 *
 * ES EL DISCRIMINANTE QUE REEMPLAZA A `reply.status`. ADR-003 dice "commit si el reply es
 * success, rollback en cualquier otro caso", y acá NO HAY REPLY: un evento no se contesta. La
 * garantía es la misma —el handler no puede dejar una escritura a medias porque no tiene acceso
 * a `commit` ni a `rollback`—, el discriminante es otro.
 */
export type EventOutcome = 'applied' | 'discarded';

/**
 * Lo que un handler de evento recibe. Tiene `transaction` y NADA MÁS, y las tres ausencias son
 * el contrato:
 *   - sin `caller`: el subject del evento no lo lleva (3 segmentos). La identidad viaja en el
 *     payload, porque el evento es SOBRE una identidad y no publicado POR una en su nombre.
 *   - sin `params`: el subject es literal, no tiene `{param}` que extraer.
 *   - sin `commit` ni `rollback`: la misma imposibilidad estructural de ADR-003. Si un handler
 *     pudiera cerrar la transacción, la garantía dejaría de ser del despachador.
 */
export interface EventContext {
  transaction: Transaction;
}

/**
 * Un handler de evento: recibe el payload YA VALIDADO y la transacción abierta.
 *
 * NUNCA LANZA para señalar un caso esperado —para eso devuelve `'discarded'`—, igual que un
 * comando señala su falla con un `Reply` y no con una excepción. Una excepción de la base sí
 * sube: la atrapa el despachador y hace el rollback.
 */
export type EventHandler<TPayload> = (
  payload: TPayload,
  ctx: EventContext
) => Promise<EventOutcome>;
