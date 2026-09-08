import joi from 'joi';
import { AttachmentEntityType, Requirement, RequirementActivity, RequirementActivityType, VisibilityLevel } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { validateWith } from '../validate';
import { linkFiles } from '../link-files';
import { resolveActor } from '../resolve-actor';
import { requirementCommentCreated } from '../../events/domain/requirement';
import { readCommentFileIds, readResponsiblePersonIds, requirementToSnapshot, resolveRecipients } from '../../events/domain/requirement-snapshot';

const COMPONENT = 'requirements.comment';

export interface RequirementsCommentPayload {
  author?: string;
  comment: string;
  visibilityLevel?: VisibilityLevel;
  fileIds?: number[];
}

const schema = joi.object({
  // OPTIONAL: ver la nota de `projects-new.ts`.
  author: joi.string().optional(),
  comment: joi.string().required(),
  visibilityLevel: joi.string()
    .valid(...Object.values(VisibilityLevel))
    .default(VisibilityLevel.Internal),
  // Archivos a vincular al comentario. El tope de 10 es regla de dominio (D-20) y lo aplica
  // Joi, antes de que el despachador abra la transacción.
  fileIds: joi.array().max(10).items(joi.number().integer().positive()).optional(),
});

export const requirementsComment: Command<RequirementsCommentPayload, { id: number }> = {
  pattern: 'requirements.{id}.comment',

  validate(payload: unknown) {
    return validateWith<RequirementsCommentPayload>(schema, payload);
  },

  async execute(payload, ctx: CommandContext): Promise<Reply<{ id: number }>> {
    const actor = resolveActor(ctx, payload.author, COMPONENT);
    if (!actor) {
      return failure(ErrorCode.INVALID_FIELDS, 'Falta el autor del comentario');
    }

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
        changedBy: actor,
      },
      { transaction: ctx.transaction }
    );

    // El vínculo se crea contra el comentario que ACABA DE CREARSE. Ya no interviene ningún
    // `entityType` de draft —desapareció también la rama que aceptaba el `comment_draft`
    // viejo, porque el backfill de S-001 ya resolvió esas filas y no le queda a quién servir—.
    //
    // El test que importa acá no es que devuelva `file_not_owned`: es que NO QUEDE EL
    // COMENTARIO. Lo garantiza el rollback del despachador (ADR-003).
    if (payload.fileIds && payload.fileIds.length > 0) {
      const linkError = await linkFiles({
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

    // EL EVENTO SE ARMA ACÁ, AL FINAL — después de `linkFiles` y de todo `return linkError` de
    // arriba (S-064, Task 6): un comentario cuyo vínculo de archivo falla no llega a este punto
    // y no declara nada (CA-5).
    const responsiblePersonIds = await readResponsiblePersonIds(requirement.id, ctx.transaction);
    const reply = success({ id: activity.id });
    reply.events = [
      requirementCommentCreated({
        requirement: { id: requirement.id, projectId: requirement.projectId },
        actorId: actor,
        actorEnvelope: ctx.actor,
        snapshot: requirementToSnapshot(requirement, responsiblePersonIds),
        recipients: await resolveRecipients(requirement.id, responsiblePersonIds, ctx.transaction),
        comment: {
          id: activity.id,
          body: activity.newValue,
          // LEÍDO DESPUÉS de `linkFiles` (D-5): antes devolvería `[]` siempre. Una sola fuente
          // para el mismo campo del contrato, aunque `payload.fileIds` diría lo mismo acá.
          fileIds: await readCommentFileIds(activity.id, ctx.transaction),
        },
        // El de la RAÍZ es el del COMENTARIO (`activity.visibilityLevel`), no
        // `snapshot.visibilityLevel` (el del requisito, tres líneas más arriba): un comentario
        // `internal` sobre un requisito `public` es válido (CA-5, D-1).
        visibilityLevel: activity.visibilityLevel,
      }),
    ];
    return reply;
  },
};

export default requirementsComment;
