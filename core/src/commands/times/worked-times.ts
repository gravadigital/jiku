import joi from 'joi';
import { Objective, Person, Project, Requirement, WorkedTime } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { validateWith } from '../validate';

const DAILY_LIMIT_MINUTES = 1440;

export interface WorkedTimesNewPayload {
  date: string;
  minutes: number;
  projectId: number;
  taskId?: number | null;
  requirementId?: number | null;
  personId: number;
}

/**
 * `taskId` es el nombre nuevo de `objectiveId`: la columna sigue siendo `objective_id`.
 *
 * `personId` es requerido acá. El protocolo lo declara opcional con default "persona del
 * usuario autenticado", pero core no conoce al usuario final: es la api la que resuelve
 * ese default (ver docs/known-limitations.md).
 */
const schema = joi.object({
  date: joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  minutes: joi.number().integer().min(1).required(),
  projectId: joi.number().integer().required(),
  taskId: joi.number().integer().allow(null).optional(),
  requirementId: joi.number().integer().allow(null).optional(),
  personId: joi.number().integer().required(),
}).oxor('taskId', 'requirementId');

export const workedTimesNew: Command<WorkedTimesNewPayload, { id: number }> = {
  pattern: 'worked-times.new',

  validate(payload: unknown) {
    return validateWith<WorkedTimesNewPayload>(schema, payload);
  },

  async execute(payload, ctx: CommandContext): Promise<Reply<{ id: number }>> {
    const person = await Person.findByPk(payload.personId, { transaction: ctx.transaction });
    if (!person) {
      return failure(ErrorCode.PERSON_NOT_FOUND, 'Person not found');
    }

    const project = await Project.findByPk(payload.projectId, { transaction: ctx.transaction });
    if (!project) {
      return failure(ErrorCode.PROJECT_NOT_FOUND, 'Proyecto no encontrado');
    }

    if (payload.taskId) {
      const task = await Objective.findByPk(payload.taskId, { transaction: ctx.transaction });
      if (!task) {
        return failure(ErrorCode.OBJECTIVE_NOT_FOUND, 'Objetivo no encontrado');
      }
    }

    if (payload.requirementId) {
      const requirement = await Requirement.findByPk(payload.requirementId, {
        transaction: ctx.transaction,
      });
      if (!requirement) {
        return failure(ErrorCode.REQUIREMENT_NOT_FOUND, 'Requisito no encontrado');
      }
      if (requirement.projectId !== payload.projectId) {
        return failure(
          ErrorCode.REQUIREMENT_PROJECT_MISMATCH,
          'El requisito no pertenece al proyecto indicado'
        );
      }
    }

    // Tope de 24 horas por persona y día.
    const total = (await WorkedTime.sum('minutes', {
      where: { personId: payload.personId, date: payload.date },
      transaction: ctx.transaction,
    })) || 0;

    if (total + payload.minutes > DAILY_LIMIT_MINUTES) {
      const remainingMinutes = DAILY_LIMIT_MINUTES - total;
      return failure(
        ErrorCode.DAILY_LIMIT_EXCEEDED,
        `Se superaría el máximo de 24 horas (1440 minutos). Minutos disponibles: ${remainingMinutes}`
      );
    }

    const workedTime = await WorkedTime.create(
      {
        date: payload.date,
        minutes: payload.minutes,
        projectId: payload.projectId,
        objectiveId: payload.taskId || null,
        requirementId: payload.requirementId || null,
        personId: payload.personId,
      },
      { transaction: ctx.transaction }
    );

    return success({ id: workedTime.id });
  },
};

/**
 * Core borra lo que se le indique: que sea propio o que la fecha esté dentro del plazo
 * lo valida la api, que es quien conoce el rol (ver el protocolo).
 */
export const workedTimesDelete: Command<Record<string, never>, void> = {
  pattern: 'worked-times.{id}.delete',

  validate(payload: unknown) {
    return validateWith<Record<string, never>>(
      joi.object({}).unknown(false).default({}),
      payload ?? {}
    );
  },

  async execute(_payload, ctx: CommandContext): Promise<Reply<void>> {
    const deleted = await WorkedTime.destroy({
      where: { id: ctx.params.id },
      transaction: ctx.transaction,
    });

    if (deleted === 0) {
      return failure('worked_time_not_found', 'Worked time not found');
    }

    return success();
  },
};
