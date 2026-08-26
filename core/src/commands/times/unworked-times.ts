import joi from 'joi';
import { Person, UnworkedTime, WorkedTime } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { resolveActor } from '../resolve-actor';
import { validateWith } from '../validate';

const DAILY_LIMIT_MINUTES = 1440;

export interface UnworkedTimesNewPayload {
  date: string;
  minutes: number;
  reason: string;
  personId: number;
}

/**
 * `personId` SIGUE SIENDO REQUERIDO ACÁ, Y ES A PROPÓSITO (S-031).
 *
 * En `worked-times.new` pasó a opcional porque REQ-007 lo pide explícitamente y el contrato del
 * bus ya lo declara así. EN AUSENCIAS NO: `UnworkedTimesNewPayload` de `docs/apis/core.yaml`
 * mantiene `required: [date, minutes, reason, personId]`, y CA-10 solo mudó la TITULARIDAD. La api
 * conserva su `resolvePersonId` para esta ruta. Hacerlo opcional «para que quede igual que en
 * horas» sería ampliar el contrato sin que ninguna CA lo pida.
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
    const actorId = resolveActor(ctx, undefined, 'unworked-times.new');

    const person = await Person.findByPk(payload.personId, { transaction: ctx.transaction });
    if (!person) {
      return failure(ErrorCode.PERSON_NOT_FOUND, 'Person not found');
    }

    // LA MISMA TITULARIDAD QUE LAS HORAS (CA-10), sobre la fila que YA se leyó: sin lectura extra.
    // `person.userId` y no el id de la Persona del actor — son equivalentes y esta forma no agrega
    // ningún SELECT (H-4 / D-3 del plan de S-031).
    //
    // NO SE EVALÚA SIN ACTOR (canal exento, D-1), igual que en horas.
    //
    // LA VENTANA DE CARGA NO SE APLICA A LAS AUSENCIAS, Y NO ES UN OLVIDO (CA-10). La regla de la
    // api para borrar una ausencia es OTRA —`deadline_exceeded` sobre `created_at`, no
    // `invalid_date_range` sobre `date`— y esta story no la muda. Agregar acá la ventana de horas
    // sería AMPLIAR una regla, no migrarla. Hay un test que lo fija.
    if (actorId && person.userId !== actorId && !ctx.roles.includes('admin')) {
      return failure(ErrorCode.ACCESS_DENIED, 'Solo podés cargar tus propias ausencias');
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
      // UNA SOLA CONSTANTE PARA LOS DOS USOS: el número del texto y el de `errorDetails` tienen
      // que ser literalmente el mismo valor, no dos cálculos que hoy coinciden.
      const remainingMinutes = DAILY_LIMIT_MINUTES - total;
      return failure(
        ErrorCode.DAILY_LIMIT_EXCEEDED,
        // EL TEXTO NO SE TOCA. La api recupera `remainingMinutes` con un regex sobre este mensaje
        // (`api/lib/utils/bus/protocol.ts`): cambiar una coma la rompe. `errorDetails` es la
        // salida estructurada que ese regex va a poder dejar de necesitar, y ES ADITIVA —quien no
        // conoce el campo lo ignora—. El regex desaparece cuando FG-4 migre el consumo.
        `Se superaría el máximo de 24 horas (1440 minutos). Minutos disponibles: ${remainingMinutes}`,
        { remainingMinutes }
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

/**
 * EL BORRADO DE AUSENCIAS GANA LA TITULARIDAD POR ACTOR (CA-10, S-031). Este docblock decía «core
 * borra lo que se le indique; el permiso lo valida la api»: el sobre de S-029 derogó esa premisa
 * y la regla vive acá, en el único servicio que escribe.
 *
 * NO GANA LA VENTANA DE CARGA: la regla de la api para borrar una ausencia es otra
 * (`deadline_exceeded` sobre `created_at`) y esta story no la muda.
 *
 * El orden es: no existe -> titularidad -> borrar. El «no existe» va primero, igual que en horas.
 */
export const unworkedTimesDelete: Command<Record<string, never>, void> = {
  pattern: 'unworked-times.{id}.delete',

  validate(payload: unknown) {
    return validateWith<Record<string, never>>(
      joi.object({}).unknown(false).default({}),
      payload ?? {}
    );
  },

  async execute(_payload, ctx: CommandContext): Promise<Reply<void>> {
    const actorId = resolveActor(ctx, undefined, 'unworked-times.{id}.delete');

    // EL `include` TRAE LA TITULARIDAD EN LA MISMA CONSULTA: el registro solo lleva `person_id` y
    // la regla necesita `people.user_id`. El alias es `person` (singular), como lo declara el
    // modelo.
    const unworkedTime = await UnworkedTime.findByPk(ctx.params.id, {
      include: [{ model: Person, as: 'person' }],
      transaction: ctx.transaction,
    });

    if (!unworkedTime) {
      return failure(ErrorCode.UNWORKED_TIME_NOT_FOUND, 'Unworked time not found');
    }

    // El texto es el de la api (`unworked-times-id-delete.ts`).
    if (actorId && unworkedTime.person?.userId !== actorId && !ctx.roles.includes('admin')) {
      return failure(ErrorCode.ACCESS_DENIED, 'Solo podés eliminar tus propios registros');
    }

    await unworkedTime.destroy({ transaction: ctx.transaction });

    return success();
  },
};
