import {
  BaseFieldSpec,
  ExternalScopeSpec,
  FilterableSpec,
  IncludableSpec,
  ResourceSpec,
  SortableSpec,
} from '../types';

/**
 * LA FICHA DE `unworked-times` — un DATO, no código.
 *
 * ES EL HERMANO QUE NO HAY QUE COPIAR DE `worked-times`, y hay tres diferencias reales:
 *
 *   1. ORDENA ASCENDENTE por default (`['date']`), no descendente. Invertido, el resultado SIGUE
 *      ESTANDO ORDENADO, así que una aserción del estilo "está ordenado por fecha" pasaría con el
 *      bug adentro.
 *   2. Es el ÚNICO de los seis recursos de esta story CON UN ENUM (`reason`).
 *   3. `unworked_times.date` es `DATE` y no `TIMESTAMP`, así que `nullable` NO hace falta y el
 *      rango se comporta distinto que en `worked-times` (inconsistencia 4 del esquema).
 */

/**
 * Los nueve valores EXACTOS del DBML (`Enum unworked_reason`), en el orden que viaja en
 * `errorDetails.allowed`.
 *
 * `medico` Y `enfermedad` SON DATO DE SALUD. Además de que el recurso NO TIENE ACCESO EXTERNO
 * —que es la mitigación principal—, es la razón por la que esta ficha no crece en superficie: no
 * hay `q` sobre ningún texto, no hay incluibles más allá de la persona, y no hay `get`.
 */
const ENUMS = {
  reason: [
    'tramite',
    'corte_servicios',
    'vacaciones',
    'dia_no_laborable',
    'personal',
    'medico',
    'estudio',
    'enfermedad',
    'otro',
  ],
} as const;

/** El conjunto BASE: siete campos. */
const BASE: Record<string, BaseFieldSpec> = {
  id: { column: 'id' },
  date: { column: 'date' },
  minutes: { column: 'minutes' },
  reason: { column: 'reason' },
  personId: { column: 'person_id' },
  createdAt: { column: 'created_at' },
  updatedAt: { column: 'updated_at' },
};

const INCLUDABLE: Record<string, IncludableSpec> = {
  /**
   * LA ÚNICA RELACIÓN DE ESTA STORY CON `INNER JOIN`, y lo justifica el esquema:
   * `unworked_times.person_id` es `NOT NULL` con FK a `people.id`, así que la fila del otro lado
   * SIEMPRE existe. Declararla `optional: true` no sería un bug, pero prometería un `null` que la
   * base no puede producir.
   */
  person: {
    kind: 'relation',
    cardinality: 'one',
    table: 'people',
    localKey: 'person_id',
    targetKey: 'id',
    optional: false,
    fields: { id: 'id', firstName: 'first_name', lastName: 'last_name' },
  },
};

/** Los cuatro filtros declarados. `reason` es el único enum de los seis recursos de esta story. */
const FILTERABLE: Record<string, FilterableSpec> = {
  id: { column: 'id', kind: 'integer' },
  personId: { column: 'person_id', kind: 'integer' },
  reason: { column: 'reason', kind: 'enum', enum: 'reason' },
  date: { column: 'date', kind: 'date' },
};

/**
 * Lo ordenable: dos nombres.
 *
 * NINGUNA ES `nullable`, y es una diferencia REAL con `worked-times`: `unworked_times.date` SÍ es
 * `NOT NULL` en el esquema. Declararla `nullable: true` "por simetría con el hermano" haría que el
 * motor use la rama disyuntiva sin necesidad, y esa rama no usa el índice compuesto de forma
 * óptima.
 *
 * `idx_unworked_times_person_date_id` empieza por `person_id`, así que sirve al orden CUANDO
 * `filter.personId` está presente — que es exactamente el uso de la pantalla.
 *
 * `minutes` NO SE DECLARA ordenable: no hay caso de uso y no hay índice.
 */
const SORTABLE: Record<string, SortableSpec> = {
  date: { column: 'date' },
  id: { column: 'id' },
};

/**
 * SIN ACCESO EXTERNO (CA-9). Además de que el portal de clientes no tiene por qué saber quién faltó,
 * `reason` incluye `medico` y `enfermedad`, que son DATO DE SALUD.
 *
 * El motor CORTA ANTES DE CONSULTAR: cero SQL, cero filas, cero error.
 */
const EXTERNAL_SCOPE: ExternalScopeSpec = { kind: 'none' };

export const unworkedTimesSpec: ResourceSpec = {
  name: 'unworked-times',
  table: 'unworked_times',

  base: BASE,
  includable: INCLUDABLE,
  filterable: FILTERABLE,
  sortable: SORTABLE,

  baseNames: Object.keys(BASE),
  includableNames: Object.keys(INCLUDABLE),
  fieldNames: [...Object.keys(BASE), ...Object.keys(INCLUDABLE)],
  filterableNames: Object.keys(FILTERABLE),
  sortableNames: Object.keys(SORTABLE),

  // ASCENDENTE, y no es un descuido: una ausencia se lee de la más vieja a la más nueva. Los otros
  // dos recursos de tiempo y casi todo el contrato ordenan al revés.
  defaults: { sort: ['date'] },
  enums: ENUMS,

  // Ningún texto sin cota que truncar: `reason` es un enum, no texto libre.
  truncatable: [],

  externalScope: EXTERNAL_SCOPE,

  // SIN `notFoundCode` NI `notFoundMessage`: `unworked-times` no tiene `get`.
};

export default unworkedTimesSpec;
