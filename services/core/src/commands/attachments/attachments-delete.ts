import joi from 'joi';
import { Attachment } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { validateWith } from '../validate';

/**
 * Desvincula un archivo de una entidad: borra la fila de `attachments`.
 *
 * NO TOCA `files` NI EL BUCKET (D-04, CA-8). Un `File` tiene 0..N vínculos, así que borrar el
 * objeto al desvincular rompería los otros. El ciclo de retención del ARCHIVO vive en
 * `files.retention_status`; el del VÍNCULO no existe: desvincular es borrar la fila.
 *
 * ES UN COMANDO Y NO UNA ESCRITURA DIRECTA DE LA API porque era su tercera escritura implícita
 * (fila + objeto). Dejarla afuera reabriría por otra puerta la excepción 2 de ADR-001 que este
 * rediseño cierra (CA-9).
 *
 * EL PARÁMETRO ES EL ID DE `attachments` —el vínculo—, al revés que
 * `files.{fileId}.request-download`, cuyo parámetro es el id del archivo. El nombre del comando
 * lo dice a propósito: `attachments.{id}.delete` es más honesto que `files.{id}.unlink`.
 */
export const attachmentsDelete: Command<Record<string, never>, void> = {
  pattern: 'attachments.{id}.delete',

  validate(payload: unknown) {
    // Un borrado no lleva cuerpo: el id viene en el subject. `unknown(false)` rechaza cualquier
    // campo —mandar datos a un borrado es un error del cliente, no algo a ignorar—.
    return validateWith<Record<string, never>>(
      joi.object({}).unknown(false).default({}),
      payload ?? {}
    );
  },

  async execute(_payload, ctx: CommandContext): Promise<Reply<void>> {
    // `ctx.params.id` llega SIEMPRE como string: el registry extrae segmentos del subject. Se
    // valida que sea entero ANTES de consultar porque un valor no numérico haría que PostgreSQL
    // lance por tipo inválido, y el despachador lo traduciría a `internal_error` — que es justo
    // lo que este comando no debe responder ante un id mal formado.
    const id = Number(ctx.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return failure(ErrorCode.INVALID_FIELDS, 'El identificador del vínculo no es válido');
    }

    // DELETE REAL, no `softDelete()`. `softDelete()` escribe `retentionStatus` y `deletedAt`
    // sobre `attachments`, columnas que la migración 20260819_05 YA DROPEÓ: el ciclo de
    // retención vive ahora en `files.retention_status`. Usarlo funcionaría en los tests —donde
    // `sequelize.sync()` recrea las columnas desde el modelo (ADR-013)— y fallaría en
    // producción. Es la misma trampa que `link-files.ts` ya documenta.
    //
    // `force: true` es obligatorio: el hook `@BeforeDestroy` del modelo lanza sin él.
    const deleted = await Attachment.destroy({
      where: { id },
      force: true,
      transaction: ctx.transaction,
    });

    if (deleted === 0) {
      // `invalid_fields` y no un `*_not_found` propio: es el código que el contrato declara para
      // este comando (`x-error-codes: [invalid_fields, internal_error]`). Agregar
      // `attachment_not_found` obligaría a tocar el paquete, el YAML y el mapa a HTTP de la api
      // — los tres, o el usuario ve un 500 (convención `error-handling`).
      //
      // El mensaje NO lleva el id: la convención prohíbe datos internos en el texto de error.
      return failure(ErrorCode.INVALID_FIELDS, 'El vínculo no existe');
    }

    // SIN `data`. El contrato declara `ReplyEmpty` y la convención `commands` lo dice para todo
    // borrado: "las ediciones y borrados, nada". La api ya tiene el id — es el de su propia URL.
    return success();
  },
};

export default attachmentsDelete;
