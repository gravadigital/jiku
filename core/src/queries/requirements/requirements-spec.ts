import { ErrorCode } from '@jiku/nats-protocol';
import {
  BaseFieldSpec,
  ExternalScopeSpec,
  FilterableSpec,
  IncludableSpec,
  ResourceSpec,
  SortableSpec,
} from '../types';

/**
 * LA FICHA DE `requirements` — un DATO, no código.
 *
 * `requirements.priority` SÍ ES UN ENUM EN LA BASE, y esa diferencia con `tasks` gobierna dos
 * decisiones de esta ficha (CA-8). El instinto es copiar la ficha de `tasks`, y copiarla produce
 * DOS EQUIVOCACIONES A LA VEZ:
 *
 *   1. agregar un `priorityValue` que en ESTE recurso NO EXISTE — allá la columna es `INTEGER` y
 *      el doble de exposición es lo que evita que el 5 se colapse en 4; acá la columna guarda el
 *      NOMBRE y no hay nada que traducir;
 *   2. dejar `estimatedFinishDate` fuera de `sortable` — allá la columna es `VARCHAR` y por eso
 *      no se declara ordenable; acá es `DATE` y SÍ lo es.
 *
 * El doble de `tasks` es consecuencia del TIPO DE LA COLUMNA, no una decisión de estilo del
 * contrato.
 */

/**
 * LAS HORAS DEL REQUISITO MÁS LAS DE SUS TAREAS, en una expresión.
 *
 * SON DOS SUBCONSULTAS CORRELACIONADAS POR FILA, y por eso el campo es INCLUIBLE y no base: con
 * `limit: 200` son 400 subconsultas. RF-17 hace incluible lo calculado, lo textual sin cota y lo
 * personal, y este es los tres géneros de calculado a la vez. Los índices
 * `idx_worked_times_requirement_id` e `idx_worked_times_objective_id` de S-021 lo hacen VIABLE, no
 * gratuito: subirlo al conjunto base lo pagarían todas las consultas, incluidas las que no lo
 * miran.
 *
 * `COALESCE(..., 0)` EN LAS DOS: `SUM` sobre cero filas devuelve NULL, y `null + 120` en SQL es
 * `null`, así que sin el COALESCE un requisito con horas propias y sin tareas devolvería `null`.
 *
 * LOS ALIAS `wtr`, `wto` Y `obj` NO COLISIONAN con los del motor (`t`, `rel_*`, `scope_`, `r`,
 * `j`): la expresión sale de la ficha y tiene que convivir con el SQL que arma el motor.
 */
const TOTAL_MINUTES_EXPR =
  'COALESCE((SELECT SUM(wtr.minutes) FROM worked_times wtr WHERE wtr.requirement_id = t.id), 0)' +
  ' + COALESCE((SELECT SUM(wto.minutes) FROM worked_times wto' +
  ' WHERE wto.objective_id IN (SELECT obj.id FROM objectives obj WHERE obj.requirement_id = t.id)), 0)';

/** Los cinco enums de la base, con los valores EXACTOS del DBML. */
const ENUMS = {
  type: ['funcionalidad', 'mejora', 'incidencia', 'otro'],
  priority: ['sin_prioridad', 'baja', 'media', 'alta', 'urgente'],
  state: ['analisis', 'planificacion', 'en_cola', 'desarrollo', 'revision', 'resuelto', 'cancelado'],
  visibilityLevel: ['public', 'internal'],
} as const;

/**
 * El conjunto BASE: doce campos.
 *
 * DEJA AFUERA SIETE CAMPOS DE TEXTO —`description`, `scope`, `technicalSolution`,
 * `acceptanceCriteria`, `resolutionComment`, `resolutionConclusion`, `resolutionType`— y es lo que
 * hace que una página de 200 requisitos tenga peso ACOTADO POR CONSTRUCCIÓN: el presupuesto de
 * bytes pasa a ser la red y no el mecanismo.
 */
const BASE: Record<string, BaseFieldSpec> = {
  id: { column: 'id' },
  title: { column: 'title' },
  type: { column: 'type' },
  // POR NOMBRE, sin traducción y SIN `priorityValue`: en esta tabla la columna ES el enum de
  // nombres (la migración `20260529_03_requirement_priority_enum`). Ver la cabecera del archivo.
  priority: { column: 'priority' },
  state: { column: 'state' },
  // La columna es `DATE` (no `VARCHAR` como en `tasks`) y vuelve como `'YYYY-MM-DD'`.
  estimatedFinishDate: { column: 'estimated_finish_date' },
  // `jsonb` NULL-able. La columna vacía tiene que viajar como `[]` y no como `null`: el contrato
  // declara `tags` como lista.
  tags: { column: 'tags', transform: (raw) => raw ?? [] },
  projectId: { column: 'project_id' },
  createdBy: { column: 'created_by' },
  visibilityLevel: { column: 'visibility_level' },
  createdAt: { column: 'created_at' },
  updatedAt: { column: 'updated_at' },
};

/**
 * Lo que se puede pedir de más.
 *
 * El ORDEN de estas claves es el que viaja en `errorDetails.allowed` cuando alguien pide un
 * `include` que no existe, así que es parte de la respuesta del contrato.
 */
const INCLUDABLE: Record<string, IncludableSpec> = {
  // Los SIETE campos de texto sin cota, el enum de resolución y los cuatro de fecha del ciclo de
  // vida. Ninguno es base: los textos por no tener cota, las fechas por ser detalle de resolución.
  // `resolutionType` es un enum corto y por eso no está en `truncatable`, aunque sí acá.
  description: { kind: 'field', column: 'description' },
  scope: { kind: 'field', column: 'scope' },
  technicalSolution: { kind: 'field', column: 'technical_solution' },
  acceptanceCriteria: { kind: 'field', column: 'acceptance_criteria' },
  resolutionComment: { kind: 'field', column: 'resolution_comment' },
  resolutionType: { kind: 'field', column: 'resolution_type' },
  resolutionConclusion: { kind: 'field', column: 'resolution_conclusion' },
  scheduledAt: { kind: 'field', column: 'scheduled_at' },
  inProgressAt: { kind: 'field', column: 'in_progress_at' },
  inReviewAt: { kind: 'field', column: 'in_review_at' },
  // Incluible Y filtrable Y ordenable, las tres listas son independientes: se puede filtrar por él
  // sin pedirlo, y entonces la respuesta no lo trae y el filtro se aplica igual.
  finishedAt: { kind: 'field', column: 'finished_at' },

  /**
   * EL CAMPO CALCULADO. Ver `TOTAL_MINUTES_EXPR`.
   *
   * `transform: Number` NO ES OPCIONAL: `SUM(integer)` devuelve `bigint` y el driver `pg` lo
   * entrega como STRING. Sin él, `totalMinutes` viaja como `"180"` en vez de `180`.
   */
  totalMinutes: { kind: 'computed', expr: TOTAL_MINUTES_EXPR, transform: Number },

  project: {
    kind: 'relation',
    cardinality: 'one',
    table: 'projects',
    localKey: 'project_id',
    targetKey: 'id',
    // INNER JOIN: `requirements.project_id` es `NOT NULL` y tiene FK. No hay fila sin proyecto.
    optional: false,
    fields: { id: 'id', name: 'name', code: 'code', status: 'status' },
  },

  responsiblePersons: {
    kind: 'relation',
    cardinality: 'many',
    table: 'people_requirements',
    parentKey: 'requirement_id',
    join: { table: 'people', on: 'j.id = r.person_id' },
    // SIN `where: 'r.active = true'`, y NO ES UN OLVIDO: `people_requirements` NO TIENE columna
    // `active`. La tiene `people_objectives`, y copiar la ficha de `tasks` acá ROMPE EL SQL.
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
    table: 'requirement_activity',
    parentKey: 'requirement_id',
    // La tabla guarda TODA la actividad del requisito; solo las filas de tipo `comment` son
    // comentarios. La condición sale de la ficha, nunca del payload.
    where: 'r.type_of_activity = \'comment\'',
    order: [
      { expr: 'r.created_at', dir: 'DESC' },
      { expr: 'r.id', dir: 'DESC' },
    ],
    // ACOTADA (RF-16): los 10 más recientes por requisito. Sin el tope, un `include: ['comments']`
    // sobre una página de 200 requisitos es una respuesta sin techo.
    cap: 10,
    truncatedFlag: 'commentsTruncated',
    fields: {
      id: 'r.id',
      // `new_value` ES el cuerpo: la columna se llama así porque la tabla es de ACTIVIDAD.
      body: 'r.new_value',
      authorId: 'r.changed_by',
      createdAt: 'r.created_at',
    },
  },

  subscriptors: {
    kind: 'relation',
    cardinality: 'many',
    // SINGULAR `requirement_subscriptors`, no `requirements_`. La de tasks SÍ es plural
    // (`objectives_subscriptors`), y la asimetría es de la base, no del contrato.
    table: 'requirement_subscriptors',
    parentKey: 'requirement_id',
    order: [{ expr: 'r.id', dir: 'ASC' }],
    fields: { userId: 'r.user_id' },
    // Lista de escalares, no de objetos: el contrato dice `[userId]`.
    scalar: 'userId',
  },

  attachments: {
    kind: 'relation',
    cardinality: 'many',
    table: 'attachments',
    parentKey: 'entity_id',
    join: { table: 'files', on: 'j.id = r.file_id' },
    // EL `where` ES DE SEGURIDAD, NO DE PROLIJIDAD: `attachments` es POLIMÓRFICA y no tiene FK a
    // la entidad. Sin `entity_type = 'requirement'`, un requisito traería los adjuntos de la TAREA
    // con el mismo `entity_id`. Y sin `deleted_at IS NULL`, los vínculos borrados.
    where: 'r.entity_type = \'requirement\' AND r.deleted_at IS NULL',
    order: [{ expr: 'r.id', dir: 'ASC' }],
    fields: {
      id: 'r.id',
      fileId: 'r.file_id',
      fileName: 'j.file_name',
      mimeType: 'j.mime_type',
      fileSize: 'j.file_size',
    },
  },
};

/**
 * Los filtros declarados.
 *
 * `totalMinutes` NO ESTÁ, y no por olvido: filtrar por un calculado obligaría a evaluar las dos
 * subconsultas POR FILA DEL UNIVERSO y no de la página. Es incluible y nada más.
 */
const FILTERABLE: Record<string, FilterableSpec> = {
  id: { column: 'id', kind: 'integer' },
  projectId: { column: 'project_id', kind: 'integer' },
  type: { column: 'type', kind: 'enum', enum: 'type' },
  state: { column: 'state', kind: 'enum', enum: 'state' },
  // POR NOMBRE Y SIN MAPA `values`: en esta tabla el nombre del enum ES el valor de la columna, así
  // que no hay traducción que hacer. Es la diferencia con `tasks`, donde el nombre mapea a enteros.
  priority: { column: 'priority', kind: 'enum', enum: 'priority' },
  createdBy: { column: 'created_by', kind: 'string' },
  visibilityLevel: { column: 'visibility_level', kind: 'enum', enum: 'visibilityLevel' },
  // No vive en `requirements`: se resuelve con una subconsulta sobre `people_requirements`.
  responsiblePersonId: {
    kind: 'integer',
    via: { table: 'people_requirements', parentKey: 'requirement_id', column: 'person_id' },
  },

  /**
   * EL FILTRO CON FORMA PROPIA: un par exacto `{key, value}`, o una LISTA de pares combinados con
   * AND (RF-7). Se resuelve con el contains de `jsonb` sobre el índice GIN de S-021:
   *
   *   tags @> '[{"key":"modulo","value":"facturacion"}]'::jsonb
   *
   * ES POR PAR EXACTO, no por clave: filtrar por `{key: 'modulo'}` a secas NO está en el contrato,
   * y el recurso que responde "qué valores tiene la clave X" es `requirements.tags`, de S-028.
   */
  tag: { contains: { column: 'tags', shape: ['key', 'value'] } },

  // La columna es `DATE`: se compara por fecha de verdad, no lexicográficamente.
  estimatedFinishDate: { column: 'estimated_finish_date', kind: 'date' },
  finishedAt: { column: 'finished_at', kind: 'date' },
  createdAt: { column: 'created_at', kind: 'date' },
  updatedAt: { column: 'updated_at', kind: 'date' },

  /**
   * `q` BUSCA POR `id` CUANDO EL TEXTO ES SOLO DÍGITOS, y va a sorprender: buscar "2026" devuelve
   * el requisito 2026 y ningún resultado de texto. Es la regla del contrato (CA-10) y viene de
   * cómo se usa la pantalla —pegar un número de requisito en el buscador es el caso más
   * frecuente—; queda declarada acá para que `meta.describe` la exponga en S-028.
   */
  q: { kind: 'string', search: ['title', 'description'], searchNumericColumn: 'id' },
};

/**
 * Lo ordenable.
 *
 * `id` ESTÁ DECLARADO, y es el primer recurso que lo hace: por eso S-024 corrigió el desempate del
 * motor, que hasta acá se agregaba incondicionalmente y con esta ficha se habría duplicado.
 *
 * `estimatedFinishDate` SÍ ES ORDENABLE ACÁ, a diferencia de `tasks`: allá la columna es `VARCHAR`
 * y declararla ordenable prometería un orden que la columna no garantiza; acá es `DATE`.
 */
const SORTABLE: Record<string, SortableSpec> = {
  id: { column: 'id' },
  title: { column: 'title' },
  state: { column: 'state' },
  // POR LA COLUMNA: el orden de un `ENUM` de PostgreSQL es el de DECLARACIÓN DEL TIPO
  // (`sin_prioridad < baja < media < alta < urgente`), no el alfabético de sus nombres.
  priority: { column: 'priority' },
  estimatedFinishDate: { column: 'estimated_finish_date', nullable: true },
  createdAt: { column: 'created_at' },
  updatedAt: { column: 'updated_at' },
  // Un requisito que no terminó no tiene fecha de fin. Sin `nullable: true`, el keyset corta el
  // recorrido en el primer NULL, en silencio.
  finishedAt: { column: 'finished_at', nullable: true },
};

/**
 * EL RECORTE DEL MODO EXTERNO de `requirements`: proyectos permitidos Y `visibility_level =
 * 'public'`. Idéntico al de `tasks`, y es la mitad del aislamiento del portal de clientes.
 *
 * DECLARARLO ES APLICARLO: el motor lo antepone al WHERE de los tres SQL —filas, COUNT y get— y no
 * hay interruptor en la ficha para desactivarlo.
 */
const EXTERNAL_SCOPE: ExternalScopeSpec = {
  kind: 'column',
  projectColumn: 'project_id',
  visibility: { column: 'visibility_level', value: 'public' },
};

export const requirementsSpec: ResourceSpec = {
  name: 'requirements',
  table: 'requirements',

  base: BASE,
  includable: INCLUDABLE,
  filterable: FILTERABLE,
  sortable: SORTABLE,

  baseNames: Object.keys(BASE),
  includableNames: Object.keys(INCLUDABLE),
  fieldNames: [...Object.keys(BASE), ...Object.keys(INCLUDABLE)],
  filterableNames: Object.keys(FILTERABLE),
  sortableNames: Object.keys(SORTABLE),

  defaults: { sort: ['-createdAt'] },
  enums: ENUMS,

  // Los seis textos sin cota que el presupuesto de bytes puede truncar cuando un item por sí solo
  // no entra. `resolutionType` no está: es un enum corto, no texto libre.
  truncatable: [
    'description',
    'scope',
    'technicalSolution',
    'acceptanceCriteria',
    'resolutionComment',
    'resolutionConclusion',
  ],

  externalScope: EXTERNAL_SCOPE,

  notFoundCode: ErrorCode.REQUIREMENT_NOT_FOUND,
  notFoundMessage: 'No existe un requisito con ese id',
};

export default requirementsSpec;
