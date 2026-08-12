import joi from 'joi';
import { ErrorCode, Reply, failure } from '@jiku/nats-protocol';

/**
 * Valida el payload de un comando contra un esquema joi.
 *
 * `convert: true` deja que joi normalice tipos (la fecha que llega como string queda
 * como Date), igual que hacía `validate-body-fields` en la api.
 */
export function validateWith<T>(
  schema: joi.Schema,
  payload: unknown
): { value: T } | { error: Reply<never> } {
  const result = schema.validate(payload, { convert: true, abortEarly: true });

  if (result.error) {
    return { error: failure(ErrorCode.INVALID_FIELDS, result.error.message) };
  }

  return { value: result.value as T };
}

/**
 * Semántica de edición parcial del protocolo:
 *
 *   campo ausente              -> no se toca
 *   campo con valor            -> se reemplaza
 *   campo en null              -> se vacía
 *   campo en null, obligatorio -> falla (lo declara el esquema con `.allow(null)` o no)
 *
 * Devuelve solo las claves presentes en el payload, así un `undefined` nunca llega a
 * Sequelize como "poner en null".
 */
export function pickPresent<T extends object>(payload: T, keys: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      out[key] = payload[key];
    }
  }
  return out;
}
