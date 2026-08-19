import joi from 'joi';
import { AttachmentEntityType, Person, PersonRequirement, Project, Requirement, RequirementPriority, RequirementState, RequirementType, RequirementVisibilityLevel } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { validateWith } from '../validate';
import { linkFiles } from '../link-files';

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
  fileIds?: number[];
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
  // Los archivos ya existen por su cuenta: `fileIds` son ids de `files`, no de drafts.
  // El tope de 10 es REGLA DE DOMINIO, no un límite de transporte (D-20): vive acá, en el
  // contrato del bus, y no en el `multer` de la api. Al correr Joi antes de que el
  // despachador abra la transacción, un array de 11 se rechaza SIN LLEGAR A LA BASE (CA-12).
  fileIds: joi.array().max(10).items(joi.number().integer().positive()).optional(),
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

    // Los archivos YA EXISTEN por su cuenta (los creó `files.request-upload`) y el vínculo se
    // crea contra el requisito, que para este punto TAMBIÉN existe. No hay draft, no hay
    // anclaje que elegir —por eso el campo de scope del draft desapareció (CA-2)— ni reanclaje:
    // es un INSERT, no un UPDATE.
    //
    // VALIDAR DESPUÉS DE CREAR ES SEGURO por ADR-003: la transacción es del despachador, que
    // hace rollback ante cualquier reply que no sea `success`. Si la titularidad de un solo
    // archivo falla, no queda ni el requisito, ni las asignaciones, ni un solo vínculo (CA-4).
    // Lo que sí queda son los `File`, sin vincular, que es un estado válido (CA-5).
    if (payload.fileIds && payload.fileIds.length > 0) {
      const linkError = await linkFiles({
        fileIds: payload.fileIds,
        declaredActor: payload.creator,
        entityType: AttachmentEntityType.Requirement,
        entityId: requirement.id,
        component: 'requirements.new',
        ctx,
      });
      if (linkError) {
        return linkError;
      }
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
