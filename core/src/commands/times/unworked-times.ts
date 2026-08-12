import joi from 'joi';
import { Person, UnworkedTime, WorkedTime } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { validateWith } from '../validate';

const DAILY_LIMIT_MINUTES = 1440;

export interface UnworkedTimesNewPayload {
  date: string;
  minutes: number;
  reason: string;
  personId: number;
}

/**
 * `personId` es requerido: core no conoce al usuario final, así que el default "persona
 * del usuario autenticado" lo resuelve la api antes de publicar.
 */
const schema = joi.object({
  date: joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  minutes: joi.number().integer().min(1).required(),
  reason: joi.string().valid(
    'tramite', 'corte_servicios', 'vacaciones', 'dia_no_laborable',
    'personal', 'medico', 'estudio', 'enfermedad', 'otro'
  ).required(),
  personId: joi.number().integer().min(1).required(),
});

export const unworkedTimesNew: Command<UnworkedTimesNewPayload, { id: number }> = {
  pattern: 'unworked-times.new',

  validate(payload: unknown) {
    return validateWith<UnworkedTimesNewPayload>(schema, payload);
  },

  async execute(payload, ctx: CommandContext): Promise<Reply<{ id: number }>> {
    const person = await Person.findByPk(payload.personId, { transaction: ctx.transaction });
    if (!person) {
      return failure(ErrorCode.PERSON_NOT_FOUND, 'Person not found');
    }

    // El tope diario suma horas trabajadas Y no trabajadas.
    const [worked, unworked] = await Promise.all([
      WorkedTime.sum('minutes', {
        where: { personId: payload.personId, date: payload.date },
        transaction: ctx.transaction,
      }),
      UnworkedTime.sum('minutes', {
        where: { personId: payload.personId, date: payload.date },
        transaction: ctx.transaction,
      }),
    ]);

    const total = (worked || 0) + (unworked || 0);
    if (total + payload.minutes > DAILY_LIMIT_MINUTES) {
      return failure(
        ErrorCode.DAILY_LIMIT_EXCEEDED,
        `Se superaría el máximo de 24 horas (1440 minutos). Minutos disponibles: ${DAILY_LIMIT_MINUTES - total}`
      );
    }

    const unworkedTime = await UnworkedTime.create(
      {
        date: payload.date,
        minutes: payload.minutes,
        reason: payload.reason,
        personId: payload.personId,
      },
      { transaction: ctx.transaction }
    );

    return success({ id: unworkedTime.id });
  },
};

/** Core borra lo que se le indique; el permiso lo valida la api. */
export const unworkedTimesDelete: Command<Record<string, never>, void> = {
  pattern: 'unworked-times.{id}.delete',

  validate(payload: unknown) {
    return validateWith<Record<string, never>>(
      joi.object({}).unknown(false).default({}),
      payload ?? {}
    );
  },

  async execute(_payload, ctx: CommandContext): Promise<Reply<void>> {
    const deleted = await UnworkedTime.destroy({
      where: { id: ctx.params.id },
      transaction: ctx.transaction,
    });

    if (deleted === 0) {
      return failure('unworked_time_not_found', 'Unworked time not found');
    }

    return success();
  },
};
