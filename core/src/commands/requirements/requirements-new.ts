import joi from 'joi';
import { Attachment, AttachmentEntityType, Person, PersonRequirement, Project, Requirement, RequirementPriority, RequirementState, RequirementType, RequirementVisibilityLevel, RetentionStatus } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { validateWith } from '../validate';

export interface RequirementsNewPayload {
  creator: string;
  title: string;
  description: string;
  projectId: number;
  type?: RequirementType | null;
  priority?: RequirementPriority;
  visibilityLevel?: RequirementVisibilityLevel;
  responsiblePersonIds?: number[];
  estimatedFinishDate?: string | null;
  tags?: Array<{ key: string; value: string }>;
  state?: RequirementState;
  attachmentIds?: number[];
  /** Ancla del draft: en Opus los adjuntos se suben contra el proyecto. */
  attachmentScope?: 'user' | 'project';
  scope?: string | null;
  technicalSolution?: string | null;
  acceptanceCriteria?: string | null;
}

const schema = joi.object({
  creator: joi.string().required(),
  title: joi.string().required(),
  description: joi.string().required(),
  projectId: joi.number().integer().required(),
  type: joi.string().valid(...Object.values(RequirementType)).allow(null).optional(),
  priority: joi.string()
    .valid(...Object.values(RequirementPriority))
    .default(RequirementPriority.SinPrioridad),
  visibilityLevel: joi.string()
    .valid(...Object.values(RequirementVisibilityLevel))
    .default(RequirementVisibilityLevel.Public),
  responsiblePersonIds: joi.array().items(joi.number().integer()).allow(null).optional(),
  // El protocolo no declara `state` al crear, pero la api lo aceptaba y la web lo usa.
  state: joi.string().valid(...Object.values(RequirementState)).optional(),
  // Los adjuntos siguen vivos mientras las rutas de attachments no se den de baja.
  attachmentIds: joi.array().items(joi.number().integer().positive()).optional(),
  attachmentScope: joi.string().valid('user', 'project').default('user'),
  estimatedFinishDate: joi.date().allow(null).optional(),
  tags: joi.array().items(joi.object({ key: joi.string(), value: joi.string() })).optional(),
  scope: joi.string().allow('', null).optional(),
  technicalSolution: joi.string().allow('', null).optional(),
  acceptanceCriteria: joi.string().allow('', null).optional(),
});

export const requirementsNew: Command<RequirementsNewPayload, { id: number }> = {
  pattern: 'requirements.new',

  validate(payload: unknown) {
    return validateWith<RequirementsNewPayload>(schema, payload);
  },

  async execute(payload, ctx: CommandContext): Promise<Reply<{ id: number }>> {
    const project = await Project.findByPk(payload.projectId, { transaction: ctx.transaction });
    if (!project) {
      return failure(ErrorCode.PROJECT_NOT_FOUND, 'Project not found');
    }

    const personIds = payload.responsiblePersonIds ?? [];
    if (personIds.length > 0) {
      const count = await Person.count({
        where: { id: personIds },
        transaction: ctx.transaction,
      });
      if (count !== personIds.length) {
        return failure(
          ErrorCode.INVALID_RESPONSIBLE_PERSON,
          'Responsible person does not exist'
        );
      }
    }

    const requirement = await Requirement.create(
      {
        title: payload.title,
        description: payload.description,
        type: payload.type ?? null,
        priority: payload.priority,
        state: payload.state ?? RequirementState.Analisis,
        visibilityLevel: payload.visibilityLevel,
        estimatedFinishDate: payload.estimatedFinishDate ?? null,
        projectId: payload.projectId,
        tags: payload.tags ?? null,
        createdBy: payload.creator,
        scope: payload.scope ?? null,
        technicalSolution: payload.technicalSolution ?? null,
        acceptanceCriteria: payload.acceptanceCriteria ?? null,
      },
      { transaction: ctx.transaction }
    );

    // Los adjuntos tienen que ser drafts del propio usuario. Se confirman pasándolos a
    // `requirement`.
    if (payload.attachmentIds && payload.attachmentIds.length > 0) {
      for (const id of payload.attachmentIds) {
        const attachment = await Attachment.scope('active').findOne({
          where: {
            id,
            entityType: AttachmentEntityType.RequirementDraft,
            // La ruta interna ancla el draft al usuario (entityId puede ser null); la de
            // Opus lo ancla al proyecto. Ver docs/apis/core.yaml.
            ...(payload.attachmentScope === 'project'
              ? { entityId: payload.projectId }
              : {}),
            uploadedBy: payload.creator,
            retentionStatus: RetentionStatus.Active,
          },
          transaction: ctx.transaction,
        });
        if (!attachment) {
          return failure(
            ErrorCode.INVALID_ATTACHMENT_ID,
            `Attachment ID ${id} is invalid or does not belong to this project draft`
          );
        }
      }

      await Attachment.update(
        { entityType: AttachmentEntityType.Requirement, entityId: requirement.id },
        { where: { id: payload.attachmentIds }, transaction: ctx.transaction }
      );
    }

    // El primero de la lista queda como líder.
    await Promise.all(
      personIds.map((personId, index) =>
        PersonRequirement.create(
          { personId, requirementId: requirement.id, isLeader: index === 0 ? true : null },
          { transaction: ctx.transaction }
        )
      )
    );

    return success({ id: requirement.id });
  },
};

export default requirementsNew;
