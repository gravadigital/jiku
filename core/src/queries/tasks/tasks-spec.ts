import { ErrorCode } from '@jiku/nats-protocol';
import {
  TASK_PRIORITY_VALUES,
  priorityFromNumber,
} from '../../commands/tasks/priority';
import {
  ExternalScopeSpec,
  FilterableSpec,
  IncludableSpec,
  ResourceSpec,
  SortableSpec,
  BaseFieldSpec,
} from '../types';

/**
 * LA FICHA DE `tasks` — un DATO, no código.
 *
 * En el contrato el recurso es `task`, SIEMPRE. En la base la tabla es `objectives`: la
 * traducción vive acá (ADR-004) y NO se filtra a `@jiku/models`, que describe la base tal como es
 * y lo comparte con `api`.
 *
 * SOBRE EL IMPORT DE `commands/tasks/priority`: la dependencia va de `queries/` a `commands/` a
 * propósito. La convención `contract-translation` dice que una traducción vive en UN helper del
 * módulo y no se repite; duplicar el mapa de prioridades acá crearía exactamente la divergencia
 * que esa convención previene, y la sutileza que se perdería al copiar tiene nombre: el 5 se lee
 * `urgente` (la api aceptaba 0-5 y el enum tiene cinco valores). Cuando la web hable en nombres,
 * `priorityValue` desaparece y este import se achica solo.
 */

/**
 * Los enteros de la columna que se leen con cada nombre del enum.
 *
 * SE DERIVA de `priorityFromNumber`, no se escribe: es lo que hace que `urgente` matchee el 4 Y
 * el 5 sin que nadie tenga que acordarse del alias. Filtrar por nombre tiene que devolver todo lo
 * que se LEE con ese nombre, o el filtro mentiría respecto de lo que la proyección muestra.
 */
const PRIORITY_COLUMN_VALUES: Record<string, number[]> = (() => {
  const map: Record<string, number[]> = {};
  for (const name of TASK_PRIORITY_VALUES) {
    map[name] = [];
  }
  // 0-5: el rango que la columna aceptó históricamente (`joi.number().min(0).max(5)` de la api).
  for (let value = 0; value <= 5; value += 1) {
    map[priorityFromNumber(value)].push(value);
  }
  return map;
})();

/** Los enums del contrato. Los tres de la base van literales, con los valores EXACTOS del DBML. */
const ENUMS = {
  state: ['backlog', 'activo', 'en_revision', 'finalizado', 'cancelado'],
  // Con la `ñ` y los acentos del DBML: son los valores reales del tipo enum de PostgreSQL.
  area: ['diseño', 'desarrollo', 'gestion', 'investigacion'],
  // DERIVADO de `TASK_PRIORITY_VALUES` y no escrito literal: un enum literal se desincroniza en
  // silencio (convención `validation`).
  priority: TASK_PRIORITY_VALUES,
  visibilityLevel: ['public', 'internal'],
} as const;

/**
 * El conjunto BASE: lo que devuelve un `get` o un `list` cuando no se pide nada.
 *
 * `description` NO está acá y es incluible: es TEXTO SIN COTA (RF-17), y una página de 200 items
 * con descripciones completas revienta el presupuesto de bytes por construcción.
 */
const BASE: Record<string, BaseFieldSpec> = {
  id: { column: 'id' },
  title: { column: 'title' },
  state: { column: 'state' },
  area: { column: 'area' },
  // `priority` y `priorityValue` son LA MISMA COLUMNA leída de dos formas. La doble exposición es
  // del contrato (CA-21), no una redundancia: sin `priorityValue` el 5 se colapsaría en 4 al
  // traducirlo a nombre, y sin `priority` el caller tendría que conocer el mapa.
  priority: { column: 'priority', transform: (raw) => priorityFromNumber(raw) },
  priorityValue: { column: 'priority' },
  // La columna es VARCHAR (`YYYY-MM-DD` como texto), no DATE. Ver `sortable`.
  estimatedFinishDate: { column: 'estimated_finish_date' },
  finishedAt: { column: 'finished_at' },
  visibilityLevel: { column: 'visibility_level' },
  projectId: { column: 'project_id' },
  requirementId: { column: 'requirement_id' },
  createdBy: { column: 'created_by' },
  createdAt: { column: 'created_at' },
  updatedAt: { column: 'updated_at' },
};

/**
 * Lo que se puede pedir de más con `include`.
 *
 * El ORDEN de estas claves es el que viaja en `errorDetails.allowed` cuando alguien pide un
 * `include` que no existe, así que es parte de la respuesta del contrato.
 */
const INCLUDABLE: Record<string, IncludableSpec> = {
  // Incluible y no base POR SER TEXTO SIN COTA (RF-17). Es también el campo que el presupuesto de
  // bytes trunca cuando un item por sí solo no entra (ver `truncatable`).
  description: { kind: 'field', column: 'description' },

  project: {
    kind: 'relation',
    cardinality: 'one',
    table: 'projects',
    localKey: 'project_id',
    targetKey: 'id',
    optional: false,
    fields: { id: 'id', name: 'name', code: 'code', status: 'status' },
  },

  requirement: {
    kind: 'relation',
    cardinality: 'one',
    table: 'requirements',
    localKey: 'requirement_id',
    targetKey: 'id',
    // LEFT JOIN: `requirement_id` es NULL-able y ADEMÁS no tiene constraint. Con INNER JOIN una
    // tarea sin requisito desaparecería de la colección, que es el peor modo de falla posible:
    // datos de MENOS, en silencio.
    optional: true,
    fields: { id: 'id', title: 'title', state: 'state' },
  },

  responsiblePersons: {
    kind: 'relation',
    cardinality: 'many',
    table: 'people_objectives',
    parentKey: 'objective_id',
    join: { table: 'people', on: 'j.id = r.person_id' },
    // SOLO LOS ACTIVOS, y la asimetría con el filtro `responsiblePersonId` —que IGNORA `active`—
    // PARECE UN BUG Y NO LO ES: buscar "las tareas de fulano" tiene que encontrar también las que
    // ya no tiene asignadas, mientras que mostrar "los responsables de esta tarea" tiene que
    // mostrar a los de hoy. Las dos reglas son distintas a propósito.
    where: 'r.active = true',
    order: [{ expr: 'j.id', dir: 'ASC' }],
    fields: {
      id: 'j.id',
      firstName: 'j.first_name',
      lastName: 'j.last_name',
      isLeader: 'r.is_leader',
    },
  },

  comments: {
    kind: 'relation',
    cardinality: 'many',
    table: 'objective_activity',
    parentKey: 'objective_id',
    // La tabla guarda TODA la actividad de la tarea; solo las filas de tipo `comment` son
    // comentarios. La condición sale de la ficha, nunca del payload.
    where: 'r.type_of_activity = \'comment\'',
    order: [
      { expr: 'r.created_at', dir: 'DESC' },
      { expr: 'r.id', dir: 'DESC' },
    ],
    // Relación de colección ACOTADA (RF-16): los 10 más recientes por tarea. Sin el tope, un
    // `include: ['comments']` sobre una página de 200 tareas es una respuesta sin techo.
    cap: 10,
    truncatedFlag: 'commentsTruncated',
    fields: {
      id: 'r.id',
      // Traducción de vocabulario: la columna se llama `new_value` porque la tabla es de
      // actividad; en el contrato un comentario tiene `body` y `authorId`.
      body: 'r.new_value',
      authorId: 'r.changed_by',
      createdAt: 'r.created_at',
    },
  },

  subscriptors: {
    kind: 'relation',
    cardinality: 'many',
    table: 'objectives_subscriptors',
    parentKey: 'objective_id',
    order: [{ expr: 'r.id', dir: 'ASC' }],
    fields: { userId: 'r.user_id' },
    // Lista de escalares, no de objetos: el contrato dice `[userId]`.
    scalar: 'userId',
  },
};

/**
 * Los filtros declarados.
 *
 * `estimatedFinishDate` ESTÁ ACÁ y NO en `sortable`, y las dos listas son independientes a
 * propósito (CA-7): la columna es VARCHAR, así que se puede comparar por igualdad y por rango
 * lexicográfico —que sobre `YYYY-MM-DD` coincide con el cronológico— pero declararla ordenable
 * prometería un orden que la columna no garantiza y que ningún índice del keyset sostiene.
 *
 * `ticketSlug` NO APARECE, ni acá ni en ninguna otra lista (RF-26). En `tasks` la columna ni
 * siquiera existe; la regla se fija igual porque la ficha es el lugar donde algo se declara o no
 * existe, y "no está declarado" es la única forma de "no se puede pedir".
 */
const FILTERABLE: Record<string, FilterableSpec> = {
  id: { column: 'id', kind: 'integer' },
  projectId: { column: 'project_id', kind: 'integer' },
  requirementId: { column: 'requirement_id', kind: 'integer' },
  state: { column: 'state', kind: 'enum', enum: 'state' },
  area: { column: 'area', kind: 'enum', enum: 'area' },
  // Por NOMBRE. Se traduce a los enteros que se leen con ese nombre: `urgente` -> 4 y 5.
  priority: { column: 'priority', kind: 'enum', enum: 'priority', values: PRIORITY_COLUMN_VALUES },
  // Por ENTERO CRUDO, la misma columna. Las dos formas conviven porque el contrato las pide.
  priorityValue: { column: 'priority', kind: 'integer' },
  visibilityLevel: { column: 'visibility_level', kind: 'enum', enum: 'visibilityLevel' },
  createdBy: { column: 'created_by', kind: 'string' },
  // Filtrable y NO ordenable: la columna es VARCHAR (`docs/db-schemas/jiku.md`, inconsistencia 1).
  estimatedFinishDate: { column: 'estimated_finish_date', kind: 'string' },
  // No vive en `objectives`: se resuelve con una subconsulta sobre `people_objectives`, IGNORANDO
  // `active` (ver el comentario de `responsiblePersons`).
  responsiblePersonId: {
    kind: 'integer',
    via: { table: 'people_objectives', parentKey: 'objective_id', column: 'person_id' },
  },
  finishedAt: { column: 'finished_at', kind: 'date' },
  createdAt: { column: 'created_at', kind: 'date' },
  updatedAt: { column: 'updated_at', kind: 'date' },
  // Búsqueda libre SOBRE LOS CAMPOS QUE DECLARA EL RECURSO, no sobre "todo": qué se busca es
  // parte del contrato y tiene que poder leerse de la ficha.
  q: { kind: 'string', search: ['title', 'description'] },
};

/**
 * Lo ordenable.
 *
 * ⚠️ DISCREPANCIA REGISTRADA, NO RESUELTA ACÁ: `docs/db-schemas/jiku.md` fija que un campo se
 * declara ordenable SOLO si tiene índice compuesto terminado en `id`, y S-021 entregó tres
 * —`(project_id, created_at, id)`, `(priority, created_at, id)` y `(state, created_at, id)`—, así
 * que `title`, `finishedAt` y `updatedAt` quedan declarados ordenables SIN índice propio. La
 * story S-022 los declara así explícitamente y la tensión no se resuelve en la implementación:
 * las dos salidas —agregar índices (otra story, toca `api/`) o recortar esta lista— son
 * decisiones de producto. La CORRECCIÓN del keyset no depende del índice; la PERFORMANCE sí.
 */
const SORTABLE: Record<string, SortableSpec> = {
  title: { column: 'title' },
  state: { column: 'state' },
  // POR LA COLUMNA NUMÉRICA, no por el nombre del enum: `-priority` tiene que dar
  // `[urgente, alta, media, baja, sin_prioridad]` y no el orden alfabético de esos nombres.
  priority: { column: 'priority' },
  // NULL-able: una tarea que no terminó no tiene fecha de fin. El motor necesita saberlo para
  // paginar sin cortar el recorrido en el primer NULL.
  finishedAt: { column: 'finished_at', nullable: true },
  createdAt: { column: 'created_at' },
  updatedAt: { column: 'updated_at' },
};

/**
 * EL RECORTE DEL MODO EXTERNO de `tasks`: proyectos permitidos Y `visibility_level = 'public'`.
 *
 * DECLARARLO ES APLICARLO (S-023): el motor lo antepone al `WHERE` de los tres SQL —filas, COUNT
 * y get— cuando `ctx.callerClass === 'external'`, y no hay ningún interruptor en la ficha para
 * desactivarlo. Los dos nombres son COLUMNAS DE LA BASE, que es lo único que puede llegar al SQL.
 */
const EXTERNAL_SCOPE: ExternalScopeSpec = {
  projectColumn: 'project_id',
  visibility: { column: 'visibility_level', value: 'public' },
};

export const tasksSpec: ResourceSpec = {
  name: 'tasks',
  // LA TRADUCCIÓN, en una línea y en un solo lugar.
  table: 'objectives',

  base: BASE,
  includable: INCLUDABLE,
  filterable: FILTERABLE,
  sortable: SORTABLE,

  // Las listas blancas que viajan en `errorDetails.allowed` se DERIVAN de los mapas de arriba con
  // `Object.keys` —que conserva el orden de inserción de las claves string— y no se escriben a
  // mano. Es lo que hace que sean LA MISMA lista que el validador consulta y no una copia que se
  // desincroniza: el validador devuelve ESTOS arrays por referencia.
  baseNames: Object.keys(BASE),
  includableNames: Object.keys(INCLUDABLE),
  fieldNames: [...Object.keys(BASE), ...Object.keys(INCLUDABLE)],
  filterableNames: Object.keys(FILTERABLE),
  sortableNames: Object.keys(SORTABLE),

  defaults: { sort: ['-createdAt'] },
  enums: ENUMS,

  // El campo de texto sin cota que el presupuesto de bytes trunca cuando un item por sí solo no
  // entra. Nunca una página vacía con cursor (RF-14).
  truncatable: ['description'],

  externalScope: EXTERNAL_SCOPE,

  // LA CONSTANTE, nunca el literal (convención `error-handling`). `task_not_found` y NO
  // `objective_not_found`: el recurso del bus se llama `tasks` (ADR-004), y `objective_not_found`
  // se queda donde está, emitido por los comandos que REQ-006 declara intactos.
  notFoundCode: ErrorCode.TASK_NOT_FOUND,
  notFoundMessage: 'No existe una tarea con ese id',
};

export default tasksSpec;
