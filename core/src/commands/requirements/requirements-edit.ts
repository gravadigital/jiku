import joi from 'joi';
import { Attachment, AttachmentEntityType, FieldActivityChange, Person, PersonRequirement, Requirement, RequirementActivity, RequirementActivityType, RequirementPriority, RequirementResolution, RequirementState, RequirementType, RequirementVisibilityLevel, RetentionStatus, VisibilityLevel } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { pickPresent, validateWith } from '../validate';

export interface RequirementsEditPayload {
  editor: string;
  title?: string;
  description?: string;
  type?: RequirementType | null;
  priority?: RequirementPriority;
  visibilityLevel?: RequirementVisibilityLevel;
  responsiblePersonIds?: number[];
  estimatedFinishDate?: string | null;
  tags?: Array<{ key: string; value: string }>;
  state?: RequirementState;
  resolutionType?: string | null;
  resolutionConclusion?: string | null;
  resolutionComment?: string | null;
  attachmentIds?: number[];
  scope?: string | null;
  technicalSolution?: string | null;
  acceptanceCriteria?: string | null;
}

const schema = joi.object({
  editor: joi.string().required(),
  title: joi.string().optional(),
  description: joi.string().optional(),
  type: joi.string().valid(...Object.values(RequirementType)).allow(null).optional(),
  priority: joi.string().valid(...Object.values(RequirementPriority)).optional(),
  visibilityLevel: joi.string().valid(...Object.values(RequirementVisibilityLevel)).optional(),
  responsiblePersonIds: joi.array().items(joi.number().integer()).optional(),
  estimatedFinishDate: joi.date().allow(null).optional(),
  tags: joi.array().items(joi.object({ key: joi.string(), value: joi.string() })).optional(),
  state: joi.string().valid(...Object.values(RequirementState)).optional(),
  // La resolución tiene su propio comando, pero el PATCH de la api aceptaba estos
  // campos y la web los sigue mandando. Se aceptan mientras esa ruta exista.
  resolutionType: joi.string().valid(...Object.values(RequirementResolution)).allow(null).optional(),
  resolutionConclusion: joi.string().allow('', null).optional(),
  resolutionComment: joi.string().allow('', null).optional(),
  attachmentIds: joi.array().items(joi.number().integer().positive()).optional(),
  scope: joi.string().allow('', null).optional(),
  technicalSolution: joi.string().allow('', null).optional(),
  acceptanceCriteria: joi.string().allow('', null).optional(),
});

const ACTIVITY_TYPE_BY_FIELD: Record<FieldActivityChange['type'], RequirementActivityType> = {
  title: RequirementActivityType.Title,
  description: RequirementActivityType.Description,
  state: RequirementActivityType.State,
};

export const requirementsEdit: Command<RequirementsEditPayload, void> = {
  pattern: 'requirements.{id}.edit',

  validate(payload: unknown) {
    return validateWith<RequirementsEditPayload>(schema, payload);
  },

  async execute(payload, ctx: CommandContext): Promise<Reply<void>> {
    const requirement = await Requirement.findByPk(ctx.params.id, {
      transaction: ctx.transaction,
    });
    if (!requirement) {
      return failure(ErrorCode.REQUIREMENT_NOT_FOUND, 'Requirement not found');
    }

    if (payload.responsiblePersonIds && payload.responsiblePersonIds.length > 0) {
      const count = await Person.count({
        where: { id: payload.responsiblePersonIds },
        transaction: ctx.transaction,
      });
      if (count !== payload.responsiblePersonIds.length) {
        return failure(
          ErrorCode.INVALID_RESPONSIBLE_PERSON,
          'Responsible person does not exist'
        );
      }
    }

    const changes = pickPresent(payload, [
      'title', 'description', 'type', 'priority', 'visibilityLevel',
      'estimatedFinishDate', 'tags', 'state', 'scope', 'technicalSolution',
      'acceptanceCriteria', 'resolutionType', 'resolutionConclusion', 'resolutionComment',
    ]);

    if (Object.keys(changes).length > 0) {
      // El hook @BeforeUpdate del modelo calcula `activityLog` y, cuando cambia el
      // estado, completa las marcas de tiempo (scheduledAt, inProgressAt, ...).
      await requirement.update(changes, { transaction: ctx.transaction });

      const logged: FieldActivityChange[] = requirement.activityLog || [];
      await Promise.all(
        logged.map((change) =>
          RequirementActivity.create(
            {
              typeOfActivity: ACTIVITY_TYPE_BY_FIELD[change.type],
              previousValue: change.previous,
              newValue: change.next,
              visibilityLevel: VisibilityLevel.Public,
              requirementId: requirement.id,
              changedBy: payload.editor,
            },
            { transaction: ctx.transaction }
          )
        )
      );
    }

    // `attachmentIds` es el conjunto COMPLETO que debe quedar vinculado: los que no
    // estaban se confirman desde draft, y los que ya no vienen se soft-eliminan.
    if (payload.attachmentIds !== undefined) {
      const linked = await Attachment.scope('active').findAll({
        where: {
          entityType: AttachmentEntityType.Requirement,
          entityId: requirement.id,
        },
        transaction: ctx.transaction,
      });
      const linkedIds = new Set(linked.map((a) => a.id));
      const toConfirm = payload.attachmentIds.filter((id) => !linkedIds.has(id));
      const toRemove = linked.filter((a) => !payload.attachmentIds!.includes(a.id));

      for (const id of toConfirm) {
        const attachment = await Attachment.scope('active').findOne({
          where: {
            id,
            entityType: AttachmentEntityType.RequirementDraft,
            uploadedBy: payload.editor,
            retentionStatus: RetentionStatus.Active,
          },
          transaction: ctx.transaction,
        });
        if (!attachment) {
          return failure(
            ErrorCode.INVALID_ATTACHMENT_ID,
            `Attachment ID ${id} is invalid or does not belong to this requirement draft`
          );
        }
      }

      if (toConfirm.length > 0) {
        await Attachment.update(
          { entityType: AttachmentEntityType.Requirement, entityId: requirement.id },
          { where: { id: toConfirm }, transaction: ctx.transaction }
        );
      }

      for (const attachment of toRemove) {
        await attachment.softDelete(payload.editor, { transaction: ctx.transaction });
      }
    }

    // Reemplazo total de responsables.
    if (payload.responsiblePersonIds) {
      await PersonRequirement.destroy({
        where: { requirementId: requirement.id },
        transaction: ctx.transaction,
      });
      await Promise.all(
        payload.responsiblePersonIds.map((personId, index) =>
          PersonRequirement.create(
            {
              personId,
              requirementId: requirement.id,
              isLeader: index === 0 ? true : null,
            },
            { transaction: ctx.transaction }
          )
        )
      );
    }

    return success();
  },
};

export default requirementsEdit;
