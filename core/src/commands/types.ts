import { Transaction } from 'sequelize';
import { Reply } from '@jiku/nats-protocol';

/**
 * Contexto de un comando.
 *
 * `caller` sale del subject y dice qué SERVICIO publicó (hoy siempre `api`). No es el
 * usuario final: ese viaja en el cuerpo (`creator` / `author`), porque la api usa un
 * único service_user para todas las personas.
 */
export interface CommandContext {
  /** Servicio que publicó el mensaje, leído del subject. */
  caller: string;
  /** Partes variables del subject: `clients.{id}.edit` deja `{ id: '7' }`. */
  params: Record<string, string>;
  /** Transacción abierta por el despachador; todo el comando escribe adentro. */
  transaction: Transaction;
}

/**
 * Un comando: valida su payload y escribe.
 *
 * No maneja permisos ni roles — eso queda en la api. Tampoco abre ni cierra la
 * transacción: la maneja el despachador, que hace commit si el comando responde
 * `success` y rollback en cualquier otro caso.
 */
export interface Command<TPayload = any, TData = unknown> {
  /**
   * Patrón del subject, con `{param}` para las partes variables:
   *   `clients.new`
   *   `clients.{id}.edit`
   */
  readonly pattern: string;

  /** Valida y normaliza el payload. Devuelve el error del protocolo si no es válido. */
  validate(payload: unknown): { value: TPayload } | { error: Reply<never> };

  /** Ejecuta la escritura. */
  execute(payload: TPayload, ctx: CommandContext): Promise<Reply<TData>>;
}
