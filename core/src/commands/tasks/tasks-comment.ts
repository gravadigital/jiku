import joi from 'joi';
import { AttachmentEntityType, Objective, ObjectiveActivity, activityVisibilityLevel } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { validateWith } from '../validate';
import { linkFiles } from '../link-files';
import { resolveActor } from '../resolve-actor';

const COMPONENT = 'tasks.comment';

export interface TasksCommentPayload {
  author?: string;
  comment: string;
  visibilityLevel?: activityVisibilityLevel;
  fileIds?: number[];
}

const schema = joi.object({
  // OPTIONAL: ver la nota de `projects-new.ts`.
  author: joi.string().optional(),
  comment: joi.string().required(),
  visibilityLevel: joi.string()
    .valid('public', 'internal')
    .default(activityVisibilityLevel.Internal),
  // La web siempre manda este campo, aunque el array esté vacío: por eso acepta `[]` y no
  // solo la ausencia. El tope de 10 es regla de dominio (D-20), aplicado por Joi antes de que
  // el despachador abra la transacción.
  fileIds: joi.array().max(10).items(joi.number().integer().positive()).optional(),
});

export const tasksComment: Command<TasksCommentPayload, { id: number }> = {
  pattern: 'tasks.{id}.comment',

  validate(payload: unknown) {
    return validateWith<TasksCommentPayload>(schema, payload);
  },

  async execute(payload, ctx: CommandContext): Promise<Reply<{ id: number }>> {
    const actor = resolveActor(ctx, payload.author, COMPONENT);
    if (!actor) {
      return failure(ErrorCode.INVALID_FIELDS, 'Falta el autor del comentario');
    }

    // La api no verificaba que la tarea existiera: comentar sobre un id inexistente
    // fallaba por la foreign key con un 500. Acá se valida y se responde el código del
    // protocolo. Ver docs/apis/core.yaml.
    const task = await Objective.findByPk(ctx.params.id, { transaction: ctx.transaction });
    if (!task) {
      return failure(ErrorCode.OBJECTIVE_NOT_FOUND, 'Objective not found');
    }

    const comment = await ObjectiveActivity.create(
      {
        objectiveId: task.id,
        typeOfActivity: 'comment',
        newValue: payload.comment,
        previousValue: '',
        changedBy: actor,
        visibilityLevel: payload.visibilityLevel,
      },
      { transaction: ctx.transaction }
    );

    // El vínculo se crea contra el comentario recién creado, sin ningún draft de por medio.
    // La rama que aceptaba el `comment_draft` viejo desapareció: el backfill de S-001 ya
    // resolvió esas filas.
    if (payload.fileIds && payload.fileIds.length > 0) {
      const linkError = await linkFiles({
        fileIds: payload.fileIds,
        actor,
        entityType: AttachmentEntityType.ObjectiveComment,
        entityId: comment.id,
        ctx,
      });
      if (linkError) {
        return linkError;
      }
    }

    return success({ id: comment.id });
  },
};

export default tasksComment;
