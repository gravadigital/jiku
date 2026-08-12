import joi from 'joi';
import { Op } from 'sequelize';
import { Objective, ObjectiveActivity, Person, PersonObjective, Requirement } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { pickPresent, validateWith } from '../validate';
import { TASK_PRIORITY_VALUES, TaskPriority, resolvePriority } from './priority';
import { activityVisibility } from './activity';

export interface TasksEditPayload {
  editor: string;
  title?: string;
  description?: string | null;
  estimatedFinishDate?: Date | null;
  state?: string;
  area?: string;
  priority?: TaskPriority;
  /** Escape transitorio: número original que manda la api. Ver priority.ts */
  priorityValue?: number;
  responsiblePersonIds?: number[];
  visibilityLevel?: string;
  requirementId?: number | null;
}

/**
 * Sin campos requeridos: toda edición es parcial.
 *
 * Un campo ausente se deja como estaba; para vaciarlo hay que mandar null explícito.
 *
 * `editor` no está en el protocolo pero es REQUERIDO: `objective_activity.changed_by`
 * tiene una foreign key contra `users`, así que sin un id de usuario real no se puede
 * registrar la actividad. Ver docs/nats-protocol.md.
 */
const schema = joi.object({
  editor: joi.string().required(),
  title: joi.string().optional(),
  description: joi.string().allow('', null).optional(),
  // Ver tasks-new: la columna es STRING.
  estimatedFinishDate: joi.date().allow(null).optional().custom((value) =>
    value instanceof Date ? value.toISOString().split('T')[0] : value
  ),
  state: joi.string()
    .valid('backlog', 'activo', 'finalizado', 'cancelado', 'en_revision')
    .optional(),
  area: joi.string().valid('diseño', 'desarrollo', 'gestion', 'investigacion').optional(),
  priority: joi.string().valid(...TASK_PRIORITY_VALUES).optional(),
  responsiblePersonIds: joi.array().items(joi.number().integer()).optional(),
  visibilityLevel: joi.string().valid('public', 'internal').optional(),
  requirementId: joi.number().integer().allow(null).optional(),
  priorityValue: joi.number().integer().min(0).max(5).optional(),
});

/** Campos que dejan rastro en `objective_activities`. */
const TRACKED = ['title', 'estimatedFinishDate', 'state', 'area', 'priority', 'description'] as const;

function asComparable(field: string, value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (field === 'estimatedFinishDate') {
    const date = new Date(value as string);
    return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
  }
  return String(value);
}

export const tasksEdit: Command<TasksEditPayload, void> = {
  pattern: 'tasks.{id}.edit',

  validate(payload: unknown) {
    return validateWith<TasksEditPayload>(schema, payload);
  },

  async execute(payload, ctx: CommandContext): Promise<Reply<void>> {
    const task = await Objective.findByPk(ctx.params.id, { transaction: ctx.transaction });
    if (!task) {
      return failure(ErrorCode.OBJECTIVE_NOT_FOUND, 'Objective not found');
    }

    if (payload.responsiblePersonIds && payload.responsiblePersonIds.length > 0) {
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
      if (!requirement || requirement.projectId !== task.projectId) {
        return failure(
          ErrorCode.REQUIREMENT_PROJECT_MISMATCH,
          'Requirement does not belong to the specified project'
        );
      }
    }


    // Registrar la actividad ANTES de escribir: hace falta el valor anterior.
    const changedBy = payload.editor;
    const activities = TRACKED.flatMap((field) => {
      if (!Object.prototype.hasOwnProperty.call(payload, field)) {
        return [];
      }
      // `priority` se compara y se registra como número, que es como se guarda.
      const incoming =
        field === 'priority'
          ? resolvePriority(payload.priority, payload.priorityValue)
          : (payload as unknown as Record<string, unknown>)[field];

      const previousValue = asComparable(field, (task as any)[field]);
      const newValue = asComparable(field, incoming);

      if (previousValue === newValue) {
        return [];
      }
      // El paso a vacío no se registra, salvo en estimatedFinishDate: es el historial
      // que espera ver la web.
      if (newValue === '' && field !== 'estimatedFinishDate') {
        return [];
      }
      return [{
        typeOfActivity: field,
        previousValue,
        newValue,
        visibilityLevel: activityVisibility(field),
        objectiveId: task.id,
        changedBy,
      }];
    });

    const changes: Record<string, unknown> = pickPresent(payload, [
      'title', 'description', 'estimatedFinishDate', 'state', 'area',
      'visibilityLevel', 'requirementId',
    ]);

    if (Object.prototype.hasOwnProperty.call(payload, 'priority')) {
      changes.priority = resolvePriority(payload.priority, payload.priorityValue);
    }

    if (Object.keys(changes).length > 0) {
      await task.update(changes, { transaction: ctx.transaction });
    }

    // Reemplazo total de responsables, igual que la api.
    if (payload.responsiblePersonIds) {
      await PersonObjective.destroy({
        where: {
          objectiveId: task.id,
          personId: { [Op.notIn]: payload.responsiblePersonIds },
        },
        transaction: ctx.transaction,
      });
      await Promise.all(
        payload.responsiblePersonIds.map((personId, index) =>
          PersonObjective.upsert(
            { personId, objectiveId: task.id, isLeader: index === 0 },
            { transaction: ctx.transaction }
          )
        )
      );
    }

    await Promise.all(
      activities.map((activity) =>
        ObjectiveActivity.create(activity, { transaction: ctx.transaction })
      )
    );

    return success();
  },
};

export default tasksEdit;
