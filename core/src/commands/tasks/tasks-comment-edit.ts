import joi from 'joi';
import { AttachmentEntityType, Objective, ObjectiveActivity } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { validateWith } from '../validate';
import { syncFileLinks } from '../link-files';
import { resolveActor } from '../resolve-actor';
import { taskCommentEdited } from '../../events/domain/task';
import { readTaskResponsiblePersonIds, taskToSnapshot } from '../../events/domain/task-snapshot';
import { readCommentFileIds } from '../../events/domain/requirement-snapshot';

const COMPONENT = 'tasks.comment.edit';

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

export const tasksCommentEdit: Command<CommentEditPayload, never> = {
  pattern: 'tasks.{id}.comment.{cid}.edit',

  validate(payload: unknown) {
    return validateWith<CommentEditPayload>(schema, payload);
  },

  async execute(payload, ctx: CommandContext): Promise<Reply<never>> {
    // Se busca directo por el PAR `(id, objectiveId)`, no por PK y después comparar: una
    // consulta menos dentro de la transacción, y "ese comentario no está en esa tarea" es la
    // misma respuesta que "la tarea no existe" desde el punto de vista del cliente. Por eso
    // `objective_not_found` (declarado en `x-error-codes`) no lo emite este comando.
    const activity = await ObjectiveActivity.findOne({
      where: { id: ctx.params.cid, objectiveId: ctx.params.id },
      transaction: ctx.transaction,
    });
    if (!activity) {
      return failure(ErrorCode.COMMENT_NOT_FOUND, 'Comentario no encontrado');
    }

    // El chequeo de tipo va ANTES que el de autoría (orden de `commands.md`): primero la
    // entidad y su forma, después las reglas del actor. El enum de esta familia NO SE EXPORTA,
    // así que la comparación es contra el literal, igual que hace `tasks-comment.ts`.
    if (activity.typeOfActivity !== 'comment') {
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
        entityType: AttachmentEntityType.ObjectiveComment,
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

    // EL EVENTO SE ARMA ACÁ, AL FINAL (REQ-014 / S-065, Task 5, D-6). Este comando busca la
    // actividad por el par `(id, objectiveId)` y NO leía la tarea hasta ahora — el `findByPk` de
    // acá es NUEVO y solo alimenta el evento, no decide ninguna respuesta: si devolviera `null`
    // (no debería, hay FK desde `objective_activity`), el comando NO FALLA — no declara evento y
    // sigue devolviendo `success()`. Por la FK DE LA FILA (`activity.objectiveId`), no por
    // `ctx.params.id`: la FK ya está validada por el `findOne` de arriba, que filtró justamente
    // por ese par, y deja una sola fuente para el id de la tarea en todo el comando.
    const task = await Objective.findByPk(activity.objectiveId, {
      transaction: ctx.transaction,
    });
    if (task) {
      const responsiblePersonIds = await readTaskResponsiblePersonIds(task.id, ctx.transaction);
      const reply = success<never>();
      reply.events = [
        taskCommentEdited({
          task: { id: task.id, projectId: task.projectId },
          actorId: actor,
          actorEnvelope: ctx.actor,
          snapshot: taskToSnapshot(task, responsiblePersonIds),
          comment: {
            id: activity.id,
            // EL TEXTO ACTUAL, ya escrito por el `update` de arriba — no hay `from`.
            body: activity.newValue,
            // CONJUNTO VIVO, leído DESPUÉS de `syncFileLinks`: el conjunto completo que queda
            // vinculado, no un delta y no lo que traiga (o no traiga) el payload.
            fileIds: await readCommentFileIds(
              activity.id,
              AttachmentEntityType.ObjectiveComment,
              ctx.transaction
            ),
          },
          // El de la RAÍZ es el del COMENTARIO, inmutable — nunca aparece en `changes`.
          visibilityLevel: activity.visibilityLevel,
          // LEÍDOS DE LA FILA, no recalculados: `editedAt`/`editedBy` son EXACTAMENTE los que el
          // `update` de arriba acaba de escribir.
          editedAt: activity.editedAt!.toISOString(),
          editedBy: activity.editedBy!,
        }),
      ];
      return reply;
    }

    return success();
  },
};

export default tasksCommentEdit;
