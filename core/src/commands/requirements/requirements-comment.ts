import joi from 'joi';
import { Op } from 'sequelize';
import { Attachment, AttachmentEntityType, Requirement, RequirementActivity, RequirementActivityType, RetentionStatus, VisibilityLevel } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { validateWith } from '../validate';

export interface RequirementsCommentPayload {
  author: string;
  comment: string;
  visibilityLevel?: VisibilityLevel;
  attachmentIds?: number[];
}

const schema = joi.object({
  author: joi.string().required(),
  comment: joi.string().required(),
  visibilityLevel: joi.string()
    .valid(...Object.values(VisibilityLevel))
    .default(VisibilityLevel.Internal),
  // Los adjuntos siguen vivos mientras las rutas de attachments no se den de baja.
  attachmentIds: joi.array().items(joi.number().integer().positive()).optional(),
});

export const requirementsComment: Command<RequirementsCommentPayload, { id: number }> = {
  pattern: 'requirements.{id}.comment',

  validate(payload: unknown) {
    return validateWith<RequirementsCommentPayload>(schema, payload);
  },

  async execute(payload, ctx: CommandContext): Promise<Reply<{ id: number }>> {
    const requirement = await Requirement.findByPk(ctx.params.id, {
      transaction: ctx.transaction,
    });
    if (!requirement) {
      return failure(ErrorCode.REQUIREMENT_NOT_FOUND, 'Requirement not found');
    }

    // No notifica: las notificaciones se eliminaron del producto (ver docs/features.md).
    const activity = await RequirementActivity.create(
      {
        typeOfActivity: RequirementActivityType.Comment,
        previousValue: '',
        newValue: payload.comment,
        visibilityLevel: payload.visibilityLevel,
        requirementId: requirement.id,
        changedBy: payload.author,
      },
      { transaction: ctx.transaction }
    );

    // Los adjuntos del comentario se confirman desde su draft.
    if (payload.attachmentIds && payload.attachmentIds.length > 0) {
      for (const id of payload.attachmentIds) {
        const attachment = await Attachment.scope('active').findOne({
          where: {
            id,
            // La api aceptaba los dos: `comment_draft` es el nombre viejo y todavía hay
            // adjuntos guardados así.
            entityType: {
              [Op.in]: [
                AttachmentEntityType.RequirementCommentDraft,
                AttachmentEntityType.CommentDraft,
              ],
            },
            // El draft se ancla al requisito: un adjunto de otro no sirve.
            entityId: requirement.id,
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
          entityType: AttachmentEntityType.RequirementComment,
          entityId: activity.id,
        },
        { where: { id: payload.attachmentIds }, transaction: ctx.transaction }
      );
    }

    return success({ id: activity.id });
  },
};

export default requirementsComment;
