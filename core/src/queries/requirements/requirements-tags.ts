import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { Query, QueryContext } from '../types';
import { PERMITTED_PROJECTS } from '../engine/build-sql';
import { selectRows } from '../engine/execute-sql';
import { SqlPlan } from '../engine/types';
import { IDENTITY_PAYLOAD_FIELDS } from '../engine/validate-query';
import { requirementsSpec } from './requirements-spec';

/**
 * `requirements.tags` — LOS PARES `{key, values[]}` QUE YA EXISTEN EN UN PROYECTO.
 *
 * ES EL ÚNICO AGREGADO DEL CONTRATO y una excepción DECLARADA Y ACOTADA a "las agregaciones quedan
 * fuera de la v1" (RF-37). Existe porque el selector de tags de la pantalla de requisitos lo
 * necesita y porque no hay forma de derivarlo desde `requirements.list` sin traer TODOS los
 * requisitos del proyecto para agrupar en el cliente.
 *
 * LA FORMA RESERVADA PARA LA V2 —agregaciones generales, `*.summary` con `groupBy` y `metrics`
 * cerrados— SIGUE FUERA. Este endpoint no es un precedente para el próximo recurso agregado: tiene
 * nombre propio, una sola forma de respuesta y `filter.projectId` OBLIGATORIO, que es lo que lo
 * mantiene acotado.
 *
 * NO ENTRA EN EL MOLDE DEL MOTOR y por eso arma su propio SQL: `runList` devuelve filas proyectadas
 * con keyset y cursor, y esto COLAPSA FILAS y devuelve una lista sin paginar. Pero se arma SOBRE LAS
 * MISMAS PIEZAS —el recorte de la ficha de `requirements`, la constante `PERMITTED_PROJECTS` y
 * `selectRows`—, que es lo que evita que sea un segundo motor con sus propios bugs.
 *
 * LA RESPUESTA NO LLEVA `page`, y la ausencia es el contrato: no es una colección paginada, y
 * agregar `page` "por simetría" prometería un cursor que no existe.
 */

/** El payload de `requirements.tags` DESPUÉS de validar. */
export interface RequirementsTagsPayload {
  readonly projectId: number;
  /** Ausente = todas las claves del proyecto. */
  readonly key?: string;
}

/** Los dos únicos nombres que acepta `filter`. Es la lista de `errorDetails.allowed`. */
const FILTER_KEYS = ['projectId', 'key'];

/** La única palanca de primer nivel. `sort`, `page`, `fields`, `include` y `count` NO aplican. */
const TOP_LEVEL_KEYS = ['filter'];

function invalid(message: string, details: Record<string, unknown>): { error: Reply<never> } {
  return { error: failure(ErrorCode.INVALID_FIELDS, message, details) };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * LA VALIDACIÓN, ANTES DE TOCAR LA BASE (convención `validation`).
 *
 * `filter.projectId` OBLIGATORIO es lo que evita el barrido de toda la tabla: sin él, el agregado
 * desanidaría el `jsonb` de todos los requisitos del producto. Es el mismo criterio con que el resto
 * del contrato acota, solo que acá no es una recomendación de performance sino parte del contrato
 * (CA-4).
 */
export function validateTags(
  payload: unknown
): { value: RequirementsTagsPayload } | { error: Reply<never> } {
  const raw = payload === undefined || payload === null ? {} : payload;
  if (!isPlainObject(raw)) {
    return invalid('La consulta espera un objeto', { field: 'payload', value: raw });
  }

  // LA MISMA LISTA CERRADA QUE EL MOTOR, importada y no reescrita: quién pregunta sale del SEGUNDO
  // TOKEN DEL SUBJECT y solo de ahí (RF-19).
  for (const key of Object.keys(raw)) {
    if (IDENTITY_PAYLOAD_FIELDS.includes(key)) {
      return invalid(
        `El campo "${key}" no se acepta: quién pregunta sale del subject, no del cuerpo`,
        { field: 'payload', value: key }
      );
    }
  }

  for (const key of Object.keys(raw)) {
    if (!TOP_LEVEL_KEYS.includes(key)) {
      return invalid(`El campo "${key}" no existe en esta consulta`, {
        field: 'payload',
        value: key,
        allowed: TOP_LEVEL_KEYS,
      });
    }
  }

  const filter = raw.filter === undefined || raw.filter === null ? {} : raw.filter;
  if (!isPlainObject(filter)) {
    return invalid('El filtro espera un objeto', { field: 'filter', value: filter });
  }

  for (const key of Object.keys(filter)) {
    if (!FILTER_KEYS.includes(key)) {
      return invalid(`El filtro "${key}" no existe en esta consulta`, {
        field: 'filter',
        value: key,
        allowed: FILTER_KEYS,
      });
    }
  }

  // EL MENSAJE DE LA AUSENCIA Y EL DEL TIPO EQUIVOCADO APUNTAN AL MISMO `field`, y es deliberado:
  // el caller tiene que corregir el mismo lugar del payload en los dos casos.
  const rawProjectId = filter.projectId;
  if (rawProjectId === undefined || rawProjectId === null) {
    return invalid('El filtro "projectId" es obligatorio en esta consulta', {
      field: 'filter.projectId',
      value: rawProjectId,
    });
  }
  const projectId =
    typeof rawProjectId === 'string' && rawProjectId.trim() !== ''
      ? Number(rawProjectId)
      : rawProjectId;
  if (typeof projectId !== 'number' || !Number.isInteger(projectId)) {
    return invalid('El filtro "projectId" espera un número entero', {
      field: 'filter.projectId',
      value: rawProjectId,
    });
  }

  if (filter.key === undefined || filter.key === null) {
    return { value: { projectId } };
  }
  if (typeof filter.key !== 'string') {
    return invalid('El filtro "key" espera texto', { field: 'filter.key', value: filter.key });
  }

  return { value: { projectId, key: filter.key } };
}

/**
 * Escapa los comodines de `LIKE` para que el texto del caller sea LITERAL.
 *
 * SE ELIGIÓ ESCAPARLOS y no dejarlos pasar: `filter.key` es un selector de claves de tag, no un
 * lenguaje de patrones, y un `%` escrito por un usuario tiene que buscar un `%`. Dejarlos pasar
 * habría dado un comodín no documentado que después no se puede sacar sin romper a alguien.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * Las tres expresiones del desanidado, con nombre.
 *
 * `TAGS_AS_ARRAY` ES LA GUARDA Y VA DENTRO DEL `LATERAL`, no en el `WHERE`: `jsonb_array_elements`
 * LANZA sobre un `jsonb` que no sea array, la columna no tiene CHECK, y el planificador no garantiza
 * evaluar un predicado del `WHERE` antes de la función. Un `{}` escrito a mano por SQL —el mismo
 * camino por el que se administran los `system_settings`— haría fallar el endpoint entero con
 * `internal_error` para TODO el proyecto. `NULL` cae en la misma rama y no produce filas, que es lo
 * correcto: un requisito sin tags no aporta pares.
 */
const TAG_KEY = 'tag->>\'key\'';
const TAG_VALUE = 'tag->>\'value\'';
const TAGS_AS_ARRAY =
  'CASE WHEN jsonb_typeof(t.tags) = \'array\' THEN t.tags ELSE \'[]\'::jsonb END';

/**
 * EL SQL: desanida el `jsonb` y agrupa por clave.
 *
 * EL RECORTE Y EL FILTRO VAN LOS DOS EN EL MISMO `WHERE`, unidos con `AND`: el del payload NO PUEDE
 * DESACTIVAR al del recorte, que es lo que "el recorte se aplica antes del filtro" significa acá.
 *
 * NINGÚN NOMBRE DEL PAYLOAD SE CONCATENA: `projectId`, el caller y el patrón de `key` viajan por
 * `replacements`. Los únicos literales del SQL salen de LA FICHA (`projectColumn`, la columna y el
 * valor de visibilidad), que es la misma regla que gobierna a `resource.where` en el motor.
 */
export function buildTagsSql(payload: RequirementsTagsPayload, ctx: QueryContext): SqlPlan {
  const replacements: Record<string, unknown> = { projectId: payload.projectId };
  const where: string[] = ['t.project_id = :projectId'];

  const scope = requirementsSpec.externalScope;
  if (ctx.callerClass === 'external') {
    // EL RECORTE SALE DE LA FICHA DE `requirements`, no escrito a mano: este endpoint LEE FILAS DE
    // `requirements`, así que tiene que recortar exactamente igual que `requirements.list`.
    //
    // Y SI LA FICHA CAMBIARA DE FORMA, ESTO TIENE QUE FALLAR RUIDOSAMENTE. Un `if` sobre el `kind`
    // que simplemente no emitiera nada dejaría al agregado SIN RECORTE en silencio: sin error, sin
    // test que lo delate, y con los tags de los requisitos internos saliendo por un endpoint que
    // "solo devuelve claves y valores". El despachador traduce este throw a `internal_error`, que es
    // el modo de falla correcto: es preferible un 500 evidente a una fuga muda.
    if (scope.kind !== 'column') {
      throw new Error(
        `[query] requirements.tags no sabe recortar un externalScope "${scope.kind}": ` +
          'la ficha de requirements cambió de forma y este agregado tiene que seguirla'
      );
    }

    where.push(`t.${scope.projectColumn} IN ${PERMITTED_PROJECTS}`);
    replacements.caller = ctx.caller;

    if (scope.visibility) {
      // LA VISIBILIDAD VA AUNQUE CA-6 SOLO NOMBRE "proyectos permitidos": sin ella, los tags de un
      // requisito `internal` se filtrarían por un endpoint que "solo devuelve claves y valores".
      // Es un canal lateral, y de los peores: nadie lo busca en un agregado.
      where.push(`t.${scope.visibility.column} = :visibility`);
      replacements.visibility = scope.visibility.value;
    }
  }

  // Un par sin `key` o sin `value` no es un par: `->>` sobre un jsonb que no es objeto devuelve
  // NULL, así que esto descarta también la entrada mal formada sin una rama propia.
  where.push(`${TAG_KEY} IS NOT NULL`, `${TAG_VALUE} IS NOT NULL`);

  if (payload.key !== undefined) {
    // COINCIDENCIA PARCIAL E INSENSIBLE A MAYÚSCULAS, coherente con el `q` del resto del contrato.
    // El `%` se arma en JS y viaja por `replacements`; el SQL no lo ve.
    where.push(`${TAG_KEY} ILIKE :keyPattern`);
    replacements.keyPattern = `%${escapeLike(payload.key)}%`;
  }

  const sql =
    `SELECT ${TAG_KEY} AS tag_key,` +
    // `DISTINCT` resuelve la deduplicación sin código, y el `ORDER BY` dentro del agregado hace que
    // el orden de `values` sea determinista en vez de depender del plan.
    ` ARRAY_AGG(DISTINCT ${TAG_VALUE} ORDER BY ${TAG_VALUE}) AS tag_values` +
    ` FROM ${requirementsSpec.table} t` +
    ` CROSS JOIN LATERAL jsonb_array_elements(${TAGS_AS_ARRAY}) AS tag` +
    ` WHERE ${where.join(' AND ')}` +
    ` GROUP BY ${TAG_KEY}` +
    ` ORDER BY ${TAG_KEY}`;

  return { sql, replacements };
}

interface TagRow extends Record<string, unknown> {
  tag_key: string;
  tag_values: string[];
}

export const requirementsTags: Query<RequirementsTagsPayload> = {
  pattern: 'requirements.tags',

  validate: validateTags,

  execute: async (payload, ctx) => {
    const plan = buildTagsSql(payload, ctx);

    // `selectRows` Y NO `ctx.db.query` DIRECTO: es lo que traduce el código PG `57014` a
    // `query_timeout`. Con la llamada cruda, un `statement_timeout` saldría como `internal_error` y
    // se rompería la única invariante que
    // `POSTGRESQL_STATEMENT_TIMEOUT_MS (8000) < NATS_QUERY_TIMEOUT_MS (10000)` existe para sostener.
    const result = await selectRows<TagRow>(ctx, plan, 'requirements.tags');
    if ('error' in result) {
      return result.error;
    }

    return success({
      items: result.rows.map((row) => ({ key: row.tag_key, values: row.tag_values })),
    });
  },
};

export default requirementsTags;
