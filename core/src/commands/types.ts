import { Transaction } from 'sequelize';
import { Actor, Reply } from '@jiku/nats-protocol';

/**
 * Contexto de un comando.
 *
 * `caller` sale del subject y dice qué SERVICIO publicó (hoy siempre `api`). NO ES EL USUARIO
 * FINAL, porque la api usa un único service_user para todas las personas.
 *
 * DÓNDE VIAJA EL USUARIO FINAL, desde S-029, y son dos lugares distintos:
 *
 *   - en el SOBRE (`actor`), cuando lo manda el publicador de confianza. Es la clave reservada
 *     que el despachador extrae del cuerpo antes de validar, y la fuente que MANDA.
 *   - en el CAMPO DE DOMINIO (`creator` / `author` / `editor` / `uploader`) cuando no hay sobre.
 *     Esos campos NO desaparecieron y no son redundantes: son datos de dominio y siguen yendo a
 *     su columna. Lo único que cambia es quién gana — ver `resolveActor`.
 */
export interface CommandContext {
  /** Servicio que publicó el mensaje, leído del subject. */
  caller: string;
  /** Partes variables del subject: `clients.{id}.edit` deja `{ id: '7' }`. */
  params: Record<string, string>;
  /** Transacción abierta por el despachador; todo el comando escribe adentro. */
  transaction: Transaction;
  /**
   * Quién actúa detrás del comando, si el publicador de confianza lo declaró.
   *
   * OPCIONAL Y NO REQUERIDO, y es lo que hace que los 20 comandos compilen sin cambios: un caller
   * directo del bus no manda sobre y su identidad sigue saliendo del subject (CA-4). Cuando está,
   * el despachador ya garantizó que tiene `id` y `roles`, y que no choca con el campo de dominio.
   *
   * NINGÚN COMANDO LO LEE DIRECTO: se consume a través de `resolveActor`, que es donde vive la
   * precedencia entre las tres fuentes.
   */
  actor?: Actor;
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
