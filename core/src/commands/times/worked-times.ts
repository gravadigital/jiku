import joi from 'joi';
import { Objective, Person, Project, Requirement, WorkedTime } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { resolveActor } from '../resolve-actor';
import { validateWith } from '../validate';
import { isWithinSubmissionWindow } from './window';

const DAILY_LIMIT_MINUTES = 1440;

export interface WorkedTimesNewPayload {
  date: string;
  minutes: number;
  projectId: number;
  taskId?: number | null;
  requirementId?: number | null;
  personId?: number;
}

/**
 * `taskId` es el nombre nuevo de `objectiveId`: la columna sigue siendo `objective_id`.
 *
 * `personId` ES OPCIONAL DESDE REQ-007 (S-031), y espeja `WorkedTimesNewPayload` de
 * `docs/apis/core.yaml`, que ya lo sacó de `required`. Cuando falta, core lo resuelve DESDE EL
 * ACTOR (`people` con `user_id = actor`).
 *
 * LA NOTA QUE HABÍA ACÁ —«core no conoce al usuario final, así que es la api la que resuelve ese
 * default»— QUEDÓ DEROGADA POR EL SOBRE DE S-029: con el sobre, core SÍ conoce al usuario final.
 * Sin este cambio, una persona publicando directo al bus tendría que saber su propio `people.id`,
 * un id que ninguna interfaz le muestra, y la paridad de los dos caminos sería falsa (RF-6).
 *
 * EL `.oxor` SE QUEDA: es la exclusión `taskId` / `requirementId` (C-42) y desde esta story es la
 * ÚNICA definición — el `.oxor` de Joi de la api se elimina, para que las dos no puedan divergir.
 */
const schema = joi.object({
  date: joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  minutes: joi.number().integer().min(1).required(),
  projectId: joi.number().integer().required(),
  taskId: joi.number().integer().allow(null).optional(),
  requirementId: joi.number().integer().allow(null).optional(),
  personId: joi.number().integer().optional(),
}).oxor('taskId', 'requirementId');

export const workedTimesNew: Command<WorkedTimesNewPayload, { id: number }> = {
  pattern: 'worked-times.new',

  validate(payload: unknown) {
    return validateWith<WorkedTimesNewPayload>(schema, payload);
  },

  /**
   * EL ORDEN DE `execute`, y por qué no es el literal de la convención `commands` (D-7 del plan):
   *
   *   1. `resolveActor`                                  -> actorId | undefined
   *   2. resolver la Persona (explícita o desde el actor) -> person_not_found
   *   3. C-41: imputar a terceros                         -> access_denied
   *   4. proyecto / tarea / requisito                     -> *_not_found, *_mismatch
   *   5. C-40: la ventana de carga                        -> invalid_date_range
   *   6. tope diario                                      -> daily_limit_exceeded
   *   7. INSERT                                           -> success({ id })
   *
   * C-41 VA ANTES QUE LAS REFERENCIAS, contra el orden literal de la convención, Y ES A PROPÓSITO:
   * un rechazo de permiso no tiene por qué confirmarle a nadie si un proyecto o un requisito
   * existen. La ventana, en cambio, queda en el escalón 3 de la convención —las reglas de
   * negocio—, junto al tope diario, que es donde la convención la pone.
   */
  async execute(payload, ctx: CommandContext): Promise<Reply<{ id: number }>> {
    // LA IDENTIDAD DE QUIEN ACTÚA. `undefined` SOLO en el canal exento (el publicador de confianza
    // sin sobre), que hoy es inalcanzable en producción —`sendCommand` inyecta el sobre en el
    // embudo— y es el canal por defecto de `dispatch()` en los tests. Ver D-1 del plan de S-031 y
    // la clase `connector` de S-030.
    const actorId = resolveActor(ctx, undefined, 'worked-times.new');

    // UNA SOLA LECTURA DE `Person` POR CAMINO, nunca dos: la fila que resuelve el default es la
    // MISMA que después decide la titularidad de C-41.
    let person: Person | null;
    if (payload.personId === undefined) {
      // EL DEFAULT SALE DEL ACTOR, y es lo que hace que `personId` pueda ser opcional (REQ-007).
      // Sin actor no hay Persona que resolver, y eso también es `person_not_found` (D-4): las tres
      // causas —el id explícito no existe, el actor no tiene Persona, el canal no trajo actor—
      // significan lo mismo para quien carga horas y las tres salen 400.
      person = actorId
        ? await Person.findOne({ where: { userId: actorId }, transaction: ctx.transaction })
        : null;
    } else {
      person = await Person.findByPk(payload.personId, { transaction: ctx.transaction });
    }

    if (!person) {
      return failure(ErrorCode.PERSON_NOT_FOUND, 'Person not found');
    }

    // C-41: SOLO UN `admin` IMPUTA HORAS A OTRA PERSONA.
    //
    // SE COMPARA `person.userId` Y NO EL ID DE LA PERSONA DEL ACTOR, y no es un atajo: son
    // equivalentes y esta forma NO AGREGA NINGUNA LECTURA. Resolver la Persona del actor para
    // comparar ids costaría un SELECT por CADA carga de horas, porque `web` SIEMPRE manda
    // `personId`.
    //
    // UNA PERSONA SIN USUARIO VINCULADO (`user_id IS NULL`) NO ES DE NADIE, y es el mismo
    // resultado que da la api hoy.
    //
    // NO SE EVALÚA SIN ACTOR (canal exento): esa exención es la de S-030 —`exemptDirect` cae en la
    // clase `connector`, «el caller autoriza por su cuenta»—. Fallar cerrado ahí convertiría un
    // CORE_TRUSTED_PUBLISHER_ID mal configurado en una caída total y silenciosa de escritura, que
    // es exactamente lo que la exención existe para evitar.
    //
    // EL MENSAJE NO NOMBRA A NADIE: ni el `personId`, ni el `sub`, ni el subject.
    if (actorId && person.userId !== actorId && !ctx.roles.includes('admin')) {
      return failure(ErrorCode.ACCESS_DENIED, 'Solo podés cargar tus propias horas');
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

    // C-40, LA VENTANA DE CARGA. Se aplica A TODOS LOS ROLES, `admin` incluido (D-5): la api la
    // aplica hoy sin mirar el rol, y mudarla con una excepción sería AMPLIARLA, no migrarla.
    //
    // EL TEXTO ES EL MISMO QUE RESPONDE LA API HOY (`worked-times-post.ts`): el mensaje cruza el
    // bus y llega al usuario final, así que conservarlo es lo que hace que «nada cambia para el
    // frontend» sea cierto hasta en la redacción.
    if (!isWithinSubmissionWindow(payload.date)) {
      return failure(
        ErrorCode.INVALID_DATE_RANGE,
        'Solo se pueden cargar horas del día actual y los 10 días previos'
      );
    }

    // Tope de 24 horas por persona y día.
    //
    // CUENTA SOLO HORAS TRABAJADAS, y no es un olvido: es lo que dice el contrato del bus
    // («counting worked time only») y lo que hace `unworked-times.new`, que sí suma las dos, es
    // OTRA regla. Hacerlo compartido acá sería un endurecimiento visible para el usuario —una
    // ausencia de jornada completa dejaría de permitir cargar horas ese día— que esta story no
    // pide (D-2 del plan de S-031).
    //
    // EL `where` VA POR `person.id` Y NO POR `payload.personId`: es el único valor que existe en
    // los dos caminos de resolución.
    const total = (await WorkedTime.sum('minutes', {
      where: { personId: person.id, date: payload.date },
      transaction: ctx.transaction,
    })) || 0;

    if (total + payload.minutes > DAILY_LIMIT_MINUTES) {
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

    const workedTime = await WorkedTime.create(
      {
        date: payload.date,
        minutes: payload.minutes,
        projectId: payload.projectId,
        objectiveId: payload.taskId || null,
        requirementId: payload.requirementId || null,
        personId: person.id,
      },
      { transaction: ctx.transaction }
    );

    return success({ id: workedTime.id });
  },
};

/**
 * EL BORRADO YA NO «BORRA LO QUE LE DICEN» (S-031). Hasta REQ-007 este docblock decía que la
 * titularidad y la ventana las validaba la api «que es quien conoce el rol»; el sobre de S-029
 * derogó esa premisa y las dos reglas viven acá:
 *
 *   - TITULARIDAD (CA-8): el registro tiene que ser de la Persona del actor, salvo `admin`.
 *   - VENTANA (CA-9): la fecha del registro tiene que estar dentro de la ventana de carga, igual
 *     que en el alta — «se puede borrar lo que se podría haber cargado», y nada más.
 *
 * EL ORDEN ES: no existe -> titularidad -> ventana -> borrar. La titularidad ANTES que la ventana
 * porque es la que menos revela; y ninguna de las dos adelanta al «no existe», porque un id que no
 * existe responde «no existe» por los dos canales y para cualquier rol.
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
    const actorId = resolveActor(ctx, undefined, 'worked-times.{id}.delete');

    // EL `include` NO ES UN LUJO: la titularidad necesita `people.user_id` y el registro solo
    // lleva `person_id`. Traerlos juntos deja el comando en UNA consulta donde la forma obvia
    // —leer el registro y después la Persona— cuesta dos.
    //
    // EL ALIAS ES `person` (singular) porque así lo declara el modelo; el de proyecto es
    // `projects` (plural). La asimetría es del modelo, no un typo.
    const workedTime = await WorkedTime.findByPk(ctx.params.id, {
      include: [{ model: Person, as: 'person' }],
      transaction: ctx.transaction,
    });

    if (!workedTime) {
      return failure(ErrorCode.WORKED_TIME_NOT_FOUND, 'Worked time not found');
    }

    // La misma titularidad del alta, con la misma exención del canal sin actor (D-1).
    if (actorId && workedTime.person?.userId !== actorId && !ctx.roles.includes('admin')) {
      // EL TEXTO ES EL DE LA API (`worked-times-id-delete.ts`), igual que el del alta: el mensaje
      // llega al usuario final a través del bus, así que la paridad se conserva hasta acá.
      return failure(ErrorCode.ACCESS_DENIED, 'Solo podés eliminar tus propios registros');
    }

    // `workedTime.date` VUELVE COMO `Date` porque la columna es TIMESTAMP —`unworked_times.date`
    // es DATE y vuelve como string—, y por eso el helper acepta las dos representaciones.
    if (!isWithinSubmissionWindow(workedTime.date)) {
      return failure(
        ErrorCode.INVALID_DATE_RANGE,
        'Solo se pueden eliminar registros del día actual y los 10 días previos'
      );
    }

    // Con la instancia en la mano, `destroy()` sobre ella y no un `where` repetido: dos formas de
    // decir lo mismo, y una de ellas puede quedar desincronizada. El «no existe» ya se respondió.
    await workedTime.destroy({ transaction: ctx.transaction });

    return success();
  },
};
