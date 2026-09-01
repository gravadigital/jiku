import joi from 'joi';
import { AttachmentEntityType, RequirementActivity, RequirementActivityType } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { validateWith } from '../validate';
import { syncFileLinks } from '../link-files';
import { resolveActor } from '../resolve-actor';

const COMPONENT = 'requirements.comment.edit';

export interface CommentEditPayload {
  editor?: string;
  comment: string;
  fileIds?: number[];
}

// `additionalProperties: false` del contrato lo cumple Joi POR DEFECTO: `joi.object()` sin
// `.unknown(true)` rechaza cualquier campo no declarado, `visibilityLevel` incluido (CA-7). No
// hace falta un `.forbidden()` explícito: la ausencia de la propiedad ES la regla.
const schema = joi.object({
  editor: joi.string().optional(),
  comment: joi.string().required(),
  fileIds: joi.array().max(10).items(joi.number().integer().positive()).optional(),
});

export const requirementsCommentEdit: Command<CommentEditPayload, never> = {
  pattern: 'requirements.{id}.comment.{cid}.edit',

  validate(payload: unknown) {
    return validateWith<CommentEditPayload>(schema, payload);
  },

  async execute(payload, ctx: CommandContext): Promise<Reply<never>> {
    // Se busca directo por el PAR `(id, requirementId)`, no por PK y después comparar: una
    // consulta menos dentro de la transacción, y "ese comentario no está en ese requisito" es
    // la misma respuesta que "el requisito no existe" desde el punto de vista del cliente. Por
    // eso `requirement_not_found` (declarado en `x-error-codes`) no lo emite este comando.
    const activity = await RequirementActivity.findOne({
      where: { id: ctx.params.cid, requirementId: ctx.params.id },
      transaction: ctx.transaction,
    });
    if (!activity) {
      return failure(ErrorCode.COMMENT_NOT_FOUND, 'Comentario no encontrado');
    }

    // El chequeo de tipo va ANTES que el de autoría (orden de `commands.md`): primero la
    // entidad y su forma, después las reglas del actor.
    if (activity.typeOfActivity !== RequirementActivityType.Comment) {
      return failure(ErrorCode.ACTIVITY_NOT_EDITABLE, 'La actividad no es un comentario editable');
    }

    const actor = resolveActor(ctx, payload.editor, COMPONENT);
    if (!actor) {
      return failure(ErrorCode.INVALID_FIELDS, 'Falta el editor del comentario');
    }

    // La excepción por rol es DEL ADMIN Y SOLO DEL ADMIN, y `ctx.roles` vacío NO la habilita:
    // `[]` significa "el canal no trae roles", no "la persona no tiene ninguno", así que en el
    // canal exento un no-autor cae acá — el lado seguro.
    if (actor !== activity.changedBy && !ctx.roles.includes('admin')) {
      return failure(ErrorCode.COMMENT_NOT_OWNED, 'Solo el autor del comentario puede editarlo');
    }

    // Se escribe SOLO el texto y la marca de edición. `visibilityLevel` no aparece (CA-7,
    // inmutable después de creado), `previousValue` no aparece (CA-11), `changedBy` no aparece
    // (CA-4, la autoría original no se toca ni cuando edita un admin). Sin `pickPresent`: no es
    // una edición parcial — `comment` es requerido y los otros dos campos son calculados, no del
    // payload. Y SIN límite de ediciones ni ventana temporal (CA-9): `editedAt` se pisa con la
    // fecha de la última edición y nada más.
    await activity.update(
      { newValue: payload.comment, editedAt: new Date(), editedBy: actor },
      { transaction: ctx.transaction }
    );

    // `fileIds` es el CONJUNTO COMPLETO que debe quedar vinculado, no un agregado:
    // `syncFileLinks` vincula los nuevos y BORRA los que no vienen. El chequeo es de PRESENCIA
    // (`!== undefined`) y no de longitud: un `fileIds: []` explícito significa "que no quede
    // ninguno vinculado" y tiene que desvincular, a diferencia del alta donde no hay vínculos
    // previos que borrar.
    if (payload.fileIds !== undefined) {
      const linkError = await syncFileLinks({
        fileIds: payload.fileIds,
        actor,
        entityType: AttachmentEntityType.RequirementComment,
        entityId: activity.id,
        ctx,
      });
      if (linkError) {
        return linkError;
      }
    }

    // NO NOTIFICA, y la ausencia es una decisión, no un olvido: hoy no existe canal de
    // notificación en el producto. Cuando FG-2 lo agregue, la regla es que la EDICIÓN de un
    // comentario no dispara notificación — solo el alta.
    return success();
  },
};

export default requirementsCommentEdit;
