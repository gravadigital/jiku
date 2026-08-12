import joi from 'joi';
import { Op } from 'sequelize';
import { Objective, Person, PersonObjective, Project, Requirement } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { validateWith } from '../validate';
import { TASK_PRIORITY_VALUES, TaskPriority, resolvePriority } from './priority';

export interface TasksNewPayload {
  creator: string;
  title: string;
  description?: string;
  estimatedFinishDate?: Date | null;
  state?: string;
  area?: string;
  priority?: TaskPriority;
  /** Escape transitorio: número original que manda la api. Ver priority.ts */
  priorityValue?: number;
  projectId: number;
  responsiblePersonIds: number[];
  visibilityLevel?: string;
  requirementId?: number | null;
}

/**
 * "task" es el nombre nuevo de "objective": la tabla sigue siendo `objectives`.
 * `responsiblePersonIds` es el nombre nuevo de `personIds`.
 */
const schema = joi.object({
  creator: joi.string().required(),
  title: joi.string().required(),
  description: joi.string().allow('', null).optional(),
  // La columna es STRING, no DATE: se guarda como YYYY-MM-DD. Con `joi.date()` el valor
  // llegaría como objeto Date y Sequelize lo rechaza.
  estimatedFinishDate: joi.date().allow(null).optional().custom((value) =>
    value instanceof Date ? value.toISOString().split('T')[0] : value
  ),
  state: joi.string()
    .valid('backlog', 'activo', 'finalizado', 'cancelado', 'en_revision')
    .default('backlog'),
  // El protocolo lo marcaba como requerido y con default a la vez. Queda opcional con
  // default `desarrollo`, que es lo que se definió al revisarlo.
  area: joi.string()
    .valid('diseño', 'desarrollo', 'gestion', 'investigacion')
    .default('desarrollo'),
  priority: joi.string().valid(...TASK_PRIORITY_VALUES).default(TaskPriority.SinPrioridad),
  projectId: joi.number().integer().required(),
  responsiblePersonIds: joi.array().items(joi.number().integer()).required(),
  visibilityLevel: joi.string().valid('public', 'internal').default('public'),
  requirementId: joi.number().integer().allow(null).optional(),
  priorityValue: joi.number().integer().min(0).max(5).optional(),
});

export const tasksNew: Command<TasksNewPayload, { id: number }> = {
  pattern: 'tasks.new',

  validate(payload: unknown) {
    return validateWith<TasksNewPayload>(schema, payload);
  },

  async execute(payload, ctx: CommandContext): Promise<Reply<{ id: number }>> {
    const project = await Project.findByPk(payload.projectId, { transaction: ctx.transaction });
    if (!project) {
      return failure(ErrorCode.PROJECT_NOT_FOUND, 'Project not found');
    }

    if (payload.responsiblePersonIds.length > 0) {
      const count = await Person.count({
        where: { id: { [Op.in]: payload.responsiblePersonIds } },
        transaction: ctx.transaction,
      });
      if (count !== payload.responsiblePersonIds.length) {
        return failure(ErrorCode.PERSON_NOT_FOUND, 'Person not found');
      }
    }

    if (payload.requirementId !== undefined && payload.requirementId !== null) {
      const requirement = await Requirement.findByPk(payload.requirementId, {
        transaction: ctx.transaction,
      });
      if (!requirement || requirement.projectId !== payload.projectId) {
        return failure(
          ErrorCode.REQUIREMENT_PROJECT_MISMATCH,
          'Requirement does not belong to the specified project'
        );
      }
    }


    const task = await Objective.create(
      {
        title: payload.title,
        description: payload.description,
        estimatedFinishDate: payload.estimatedFinishDate ?? null,
        state: payload.state,
        area: payload.area,
        priority: resolvePriority(payload.priority, payload.priorityValue),
        projectId: payload.projectId,
        visibilityLevel: payload.visibilityLevel,
        requirementId: payload.requirementId ?? null,
        createdBy: payload.creator,
      },
      { transaction: ctx.transaction }
    );

    // El primero de la lista queda como líder.
    await Promise.all(
      payload.responsiblePersonIds.map((personId, index) =>
        PersonObjective.create(
          { personId, objectiveId: task.id, isLeader: index === 0 },
          { transaction: ctx.transaction }
        )
      )
    );

    return success({ id: task.id });
  },
};

export default tasksNew;
