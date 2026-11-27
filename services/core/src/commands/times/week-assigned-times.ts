import joi from 'joi';
import { Op } from 'sequelize';
import { Person, Project, WeekAssignedTime } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { validateWith } from '../validate';
import { toDayUTC } from './window';

/** `getUTCDay()` del lunes. La semana de la grilla se identifica por su lunes. */
const MONDAY = 1;

/** Del lunes al viernes: `date_to` es `date_from` + 4 días. Es la forma de la grilla. */
const WEEK_SPAN_DAYS = 4;

/** El proyecto que marca la asignación como interna. El valor está en español en la base. */
const INTERNAL_PROJECT_TYPE = 'interno';

/**
 * EL PAYLOAD DEL COMANDO 21, CON LOS NOMBRES DEL BUS.
 *
 * `dateFrom` Y `assignments`, NO `weekStart` Y `allocations`, y no es un typo de nadie: el contrato
 * HTTP de `PUT /api/week-assigned-times` usa los segundos y el contrato del bus usa los primeros.
 * Los dos documentos son correctos y dicen cosas distintas; la traducción la hace la api. Un
 * esquema escrito con los nombres de HTTP compila, pasa el lint y rechaza TODO lo que la api
 * mande, con `invalid_fields`.
 *
 * SE ESCRIBE A MANO y no se infiere del esquema: es la convención `validation`, y es lo que hace
 * que un cambio del esquema que no sea intencional rompa la compilación.
 */
export interface WeekAssignedTimesReplacePayload {
  dateFrom: string;
  assignments: {
    projectId: number;
    personId: number;
    minutes: number;
  }[];
}

/**
 * LA REGLA DEL LUNES VIVE ACÁ Y C-36 NO, y la razón es mecánica: `validateWith` traduce TODO fallo
 * de esquema a `invalid_fields`, sin excepción. CA-5 pide exactamente ese código para un día que no
 * sea lunes, así que la regla entra en el esquema y sale gratis. CA-4 pide `invalid_date_range`
 * para una semana pasada, que Joi NO PUEDE devolver — así que C-36 va en `execute`.
 *
 * `minutes` LLEVA `.min(0)` Y NO `.min(1)`, y es la diferencia deliberada con `worked-times.new`:
 * un `0` es VÁLIDO y se DESCARTA (CA-7). Una celda vacía de la grilla es justo lo que el frontend
 * manda, y un `min(1)` respondería `invalid_fields` sobre ella.
 *
 * NINGÚN NIVEL LLEVA `.unknown(true)`: es lo que traduce el `additionalProperties: false` del
 * contrato y lo que rechaza `weekStart`, `allocations` e `internal`.
 *
 * NO DECLARA LA CLAVE `actor`, y no debe: el despachador la extrae del cuerpo ANTES de validar, así
 * que el sobre nunca le llega al esquema.
 */
const schema = joi.object({
  dateFrom: joi
    .string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required()
    .custom((value: string, helpers) => {
      // EL SUFIJO `Z` ES EXPLÍCITO. `new Date('2026-08-24')` ya es medianoche UTC, pero la forma
      // sin sufijo es la que un lector futuro va a "corregir" a `new Date(v + 'T00:00:00')`, que es
      // medianoche LOCAL: el mismo bug de borde que `window.ts` documenta.
      //
      // `getUTCDay()`, NUNCA `getDay()`: en una TZ negativa un lunes UTC se lee como domingo y el
      // comando rechazaría lunes válidos ALGUNAS HORAS DEL DÍA.
      if (new Date(`${value}T00:00:00Z`).getUTCDay() !== MONDAY) {
        return helpers.error('any.invalid');
      }
      return value;
    }),
  // UNA LISTA VACÍA ES VÁLIDA Y VACÍA LA SEMANA: es la forma en que la grilla se limpia (CA-2).
  assignments: joi
    .array()
    .items(
      joi.object({
        projectId: joi.number().integer().required(),
        personId: joi.number().integer().required(),
        minutes: joi.number().integer().min(0).required(),
      })
    )
    .required(),
});

/**
 * El lunes de la semana de `today`, `YYYY-MM-DD` en UTC.
 *
 * ES EL BORDE INFERIOR DE C-36: la semana actual se acepta, la anterior se rechaza.
 */
function mondayOfWeekUTC(today: Date): string {
  const day = today.getUTCDay();
  // EL DOMINGO RESTA 6, NO 1: `1 - 0` daría el lunes SIGUIENTE, y el comando aceptaría toda la
  // semana pasada durante 24 h por semana. Es el mismo ajuste que hace `validateWeekNotPast`.
  const diff = day === 0 ? -6 : 1 - day;
  // `Date.UTC` NORMALIZA EL DESBORDE de mes y de año, y no muta `today`, que es del llamador.
  const monday = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate() + diff
  ));
  return toDayUTC(monday);
}

/** El viernes de la semana que arranca en `dateFrom`, `YYYY-MM-DD` en UTC. */
function fridayOfWeekUTC(dateFrom: string): string {
  const from = new Date(`${dateFrom}T00:00:00Z`);
  const friday = new Date(Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate() + WEEK_SPAN_DAYS
  ));
  return toDayUTC(friday);
}

/**
 * EL COMANDO 21: reemplaza LA SEMANA COMPLETA de la grilla proyecto × persona.
 *
 * ES UNA MUDANZA DE SERVICIO, NO UN REDISEÑO. La semántica de *borrar + recrear la semana entera*
 * ya es la de la entidad —es la única que se reemplaza por semana completa— y hasta S-032 la
 * ejecutaba la api con el ORM, en una transacción propia. Lo que cambia es QUIÉN escribe (`core`,
 * con el usuario dueño de la base) y DÓNDE viven las dos reglas de la grilla.
 *
 * C-38 —*solo `admin` edita la grilla*— NO ESTÁ ACÁ, y su ausencia es la decisión: la regla no
 * depende del payload, así que la resuelve el MAPA ROL → MÉTODO de `authorize-caller.ts`, antes de
 * resolver el método y antes de abrir la transacción. Un `user` no llega ni a enterarse de que el
 * comando existe. Es el mismo corte que S-030 estableció entre `caller_not_authorized` y
 * `access_denied`.
 *
 * TAMPOCO USA `resolveActor`: ninguna de sus reglas depende de quién actúa. C-38 la decide el mapa
 * por el ROL y C-36 depende solo de `dateFrom`. Es la diferencia con los cuatro comandos de tiempos
 * de S-031, que sí la usan — no la importes por simetría.
 */
export const weekAssignedTimesReplace: Command<WeekAssignedTimesReplacePayload, void> = {
  pattern: 'week-assigned-times.replace',

  validate(payload: unknown) {
    return validateWith<WeekAssignedTimesReplacePayload>(schema, payload);
  },

  /**
   * EL ORDEN, y por qué no es el literal de la convención `commands` (D-2 del plan):
   *
   *   1. C-36: la semana no puede ser pasada        -> invalid_date_range
   *   2. derivar `dateTo`                            (puro)
   *   3. filtrar las asignaciones con `minutes: 0`   (puro)
   *   4. validar proyectos en UNA consulta           -> project_not_found
   *   5. validar personas en UNA consulta            -> person_not_found
   *   6. DELETE de la semana                         (transacción del despachador)
   *   7. bulkCreate                                  -> success()
   *
   * C-36 VA PRIMERO, contra el orden literal de la convención (referencias antes que reglas), y es
   * a propósito: es pura, no cuesta una sola consulta, y rechazar una semana pasada ANTES de
   * preguntar por proyectos y personas es el mismo criterio con que el despachador corre Joi antes
   * de abrir la transacción.
   *
   * EL FILTRO DE LOS CEROS VA ANTES DE VALIDAR REFERENCIAS, y también importa: una celda VACÍA con
   * un `projectId` que ya no existe NO DEBE hacer fallar el guardado de toda la grilla. Es lo que
   * hace la api hoy — su `continue` está antes del `findByPk`.
   *
   * LA TRANSACCIÓN ES DEL DESPACHADOR (ADR-003), y es lo que hace segura esta operación entera: un
   * `destroy` ya ejecutado seguido de un `failure` SE PIERDE SOLO, sin que este comando escriba una
   * línea de manejo de errores. Una semana a medio reemplazar es estructuralmente imposible.
   */
  async execute(payload, ctx: CommandContext): Promise<Reply<void>> {
    // C-36. LA COMPARACIÓN ES ENTRE STRINGS `YYYY-MM-DD`, que ordenan lexicográficamente igual que
    // cronológicamente: comparar `Date`s volvería a meter la zona horaria en la decisión.
    //
    // EL TEXTO SE CONSERVA de `validate-week-not-past.ts` de la api: cruza el bus y llega al
    // usuario final, así que la paridad se sostiene hasta en la redacción. EL `errorCode` NO SE
    // CONSERVA — `invalid_week` era de HTTP; el contrato del bus dice `invalid_date_range`.
    if (payload.dateFrom < mondayOfWeekUTC(new Date())) {
      return failure(ErrorCode.INVALID_DATE_RANGE, 'No se pueden modificar semanas pasadas');
    }

    const dateTo = fridayOfWeekUTC(payload.dateFrom);

    // CA-7: UNA CELDA VACÍA DE LA GRILLA NO ES UNA FILA. No se inserta y no es un error.
    const rows = payload.assignments.filter((assignment) => assignment.minutes !== 0);

    // EL `[...new Set(...)]` NO ES COSMÉTICO: la grilla manda la misma `personId` una vez por
    // proyecto y el mismo `projectId` una vez por persona, así que sin deduplicar la comparación
    // `length !== length` fallaría con datos perfectamente válidos.
    const projectIds = [...new Set(rows.map((assignment) => assignment.projectId))];
    const projects = await Project.findAll({
      where: { id: { [Op.in]: projectIds } },
      transaction: ctx.transaction,
    });
    if (projects.length !== projectIds.length) {
      // NO INFORMA CUÁL FALTA, y es el patrón de la validación en bloque de la convención `orm`.
      return failure(ErrorCode.PROJECT_NOT_FOUND, 'Proyecto no encontrado');
    }
    // EL `Map` ES LO QUE HACE QUE LA DERIVACIÓN DE `internal` NO CUESTE UNA CONSULTA POR
    // ASIGNACIÓN. La api hace un `findByPk` por celda; sobre una grilla de ~20 personas × ~10
    // proyectos la diferencia es real.
    const isInternal = new Map(
      projects.map((project) => [project.id, project.type === INTERNAL_PROJECT_TYPE])
    );

    // `findAll` PARA PROYECTOS Y `count` PARA PERSONAS, Y LA ASIMETRÍA ES DELIBERADA: de los
    // proyectos hace falta el `type` para derivar `internal`; de las personas solo hace falta saber
    // que existen. Traer sus filas sería traer datos que nadie mira.
    //
    // LA API NO VALIDA PERSONAS —una `personId` inexistente le rompe por foreign key y sale 500—
    // así que ésta es la ÚNICA diferencia de comportamiento observable de la mudanza, y está
    // DECLARADA en el contrato del bus como `person_not_found` → 400.
    const personIds = [...new Set(rows.map((assignment) => assignment.personId))];
    const personCount = await Person.count({
      where: { id: { [Op.in]: personIds } },
      transaction: ctx.transaction,
    });
    if (personCount !== personIds.length) {
      return failure(ErrorCode.PERSON_NOT_FOUND, 'Persona no encontrada');
    }

    // EL DELETE VA POR `date_from` SOLO, no por el par `(date_from, date_to)` que usa la api hoy
    // (D-5). Es lo que dice CA-2 —*borra y recrea la semana entera*—: una fila legada con un
    // `date_to` que no sea `date_from + 4` sobreviviría al reemplazo y quedaría huérfana en una
    // semana que el usuario cree haber vaciado. En datos sanos las dos formas borran lo mismo.
    await WeekAssignedTime.destroy({
      where: { dateFrom: payload.dateFrom },
      transaction: ctx.transaction,
    });

    // `bulkCreate` CON UNA LISTA VACÍA ES VÁLIDO y no hace nada: es lo que hace que una lista vacía
    // vacíe la semana sin un `if` que habría que mantener.
    await WeekAssignedTime.bulkCreate(
      rows.map((assignment) => ({
        // SE ESCRIBE EL STRING `'YYYY-MM-DD'` y no un `Date`: la columna es TIMESTAMP y `pg` lo
        // coerciona a medianoche. Convertirlo acá sería reintroducir el instante ambiguo.
        dateFrom: payload.dateFrom,
        dateTo,
        internal: isInternal.get(assignment.projectId)!,
        minutes: assignment.minutes,
        projectId: assignment.projectId,
        personId: assignment.personId,
      })),
      { transaction: ctx.transaction }
    );

    // `ReplyEmpty`, NO `ReplyWithId` (CA-8): es un reemplazo, no una creación. No hay entidad
    // creada de la que devolver un id — hay una semana reemplazada.
    return success();
  },
};

export default weekAssignedTimesReplace;
