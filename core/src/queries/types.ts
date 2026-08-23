import { Sequelize } from 'sequelize-typescript';
import { Reply } from '@jiku/nats-protocol';

/**
 * Contexto de una consulta.
 *
 * NO tiene `transaction`, y la ausencia es el contrato: el despachador de consultas no abre
 * ninguna (RF-9). Una lectura no necesita atomicidad, y una transacción por request tomaría y
 * sostendría un snapshot por cada consulta. Una consulta que necesite consistencia entre varias
 * lecturas abre una transacción `READ ONLY` explícita DENTRO de sí misma.
 *
 * NO tiene `params`: los patrones de consulta no llevan `{param}` —el id del recurso viaja en el
 * payload, por el cache de subjects del server— así que un `params` acá estaría siempre vacío y
 * sugeriría que se puede agregar un `{id}` al patrón. No se puede.
 */
export interface QueryContext {
  /** Servicio que publicó el mensaje, leído del subject. */
  caller: string;
  /** Conexión de SOLO LECTURA. Se inyecta para que el módulo no importe `models/read`. */
  db: Sequelize;
}

/**
 * Una consulta: lee y devuelve.
 *
 * No hay `validate()` todavía: sin contrato (RF-10 de REQ-004) un esquema Joi inventaría
 * exactamente lo que el REQ declaró fuera de alcance. El REQ del contrato lo agrega, y ahí la
 * forma es la misma que en `Command`.
 */
export interface Query<TData = unknown> {
  /** Patrón del método, SIN `{param}`: `projects.list`, `tasks.get`. */
  readonly pattern: string;
  execute(payload: unknown, ctx: QueryContext): Promise<Reply<TData>>;
}
