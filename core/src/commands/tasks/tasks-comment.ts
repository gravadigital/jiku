import joi from 'joi';
import { Op } from 'sequelize';
import { Attachment, AttachmentEntityType, Objective, ObjectiveActivity, RetentionStatus, activityVisibilityLevel } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { validateWith } from '../validate';

export interface TasksCommentPayload {
  author: string;
  comment: string;
  visibilityLevel?: activityVisibilityLevel;
  attachmentIds?: number[];
}

const schema = joi.object({
  author: joi.string().required(),
  comment: joi.string().required(),
  visibilityLevel: joi.string()
    .valid('public', 'internal')
    .default(activityVisibilityLevel.Internal),
  // La web siempre manda este campo, aunque el array esté vacío.
  attachmentIds: joi.array().items(joi.number().integer().positive()).optional(),
});

export const tasksComment: Command<TasksCommentPayload, { id: number }> = {
  pattern: 'tasks.{id}.comment',

  validate(payload: unknown) {
    return validateWith<TasksCommentPayload>(schema, payload);
  },

  async execute(payload, ctx: CommandContext): Promise<Reply<{ id: number }>> {
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
        changedBy: payload.author,
        visibilityLevel: payload.visibilityLevel,
      },
      { transaction: ctx.transaction }
    );

    // Los adjuntos se suben como draft anclado a la task y se confirman acá.
    if (payload.attachmentIds && payload.attachmentIds.length > 0) {
      for (const id of payload.attachmentIds) {
        const attachment = await Attachment.scope('active').findOne({
          where: {
            id,
            entityType: {
              [Op.in]: [
                AttachmentEntityType.ObjectiveCommentDraft,
                AttachmentEntityType.CommentDraft,
              ],
            },
            entityId: task.id,
            uploadedBy: payload.author,
            retentionStatus: RetentionStatus.Active,
          },
          transaction: ctx.transaction,
        });
        if (!attachment) {
          return failure(
            ErrorCode.INVALID_ATTACHMENT_ID,
            `Attachment ID ${id} is invalid or does not belong to this comment draft`
          );
        }
      }

      await Attachment.update(
        {
          entityType: AttachmentEntityType.ObjectiveComment,
          entityId: comment.id,
        },
        { where: { id: payload.attachmentIds }, transaction: ctx.transaction }
      );
    }

    return success({ id: comment.id });
  },
};

export default tasksComment;
