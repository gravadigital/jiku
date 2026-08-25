import { OneRelationSpec, QueryContext, ResourceSpec } from '../types';
import {
  FilterCondition,
  ParsedFilter,
  SortCriterion,
  SqlPlan,
  ValidatedGetQuery,
  ValidatedListQuery,
} from './types';

/**
 * El constructor de SQL explícito.
 *
 * DOS REGLAS DURAS, y son la mitigación de inyección de todo el motor (CA-29):
 *
 *   1. Los NOMBRES de tabla, columna y dirección de orden salen EXCLUSIVAMENTE de la ficha.
 *      Ningún fragmento del payload se concatena al SQL. Un nombre no declarado ya fue rechazado
 *      por el validador y NO LLEGA ACÁ.
 *   2. Los VALORES van SIEMPRE en `replacements`.
 *
 * Por eso este módulo NO TIENE escapes ni sanitización de strings del payload: si hiciera falta
 * alguno, sería la señal de que un nombre llegó desde el cuerpo del mensaje.
 */

/** Alias de la tabla del recurso. Fijo, y no derivado de nada del payload. */
const MAIN = 't';

/** Alias de una relación 1:1 en la consulta principal. `name` sale de la ficha. */
function relationAlias(name: string): string {
  return `rel_${name}`;
}

/** Acumula los valores y devuelve el nombre del parámetro. El contador es del builder. */
class Params {
  private index = 0;
  readonly values: Record<string, unknown> = {};

  add(value: unknown): string {
    const name = `p${this.index}`;
    this.index += 1;
    this.values[name] = value;
    return name;
  }

  /**
   * Un parámetro con NOMBRE FIJO, para los valores que no vienen del payload.
   *
   * NO TOCA EL CONTADOR, y por eso no puede colisionar con los del filtro: `add()` emite `p0`,
   * `p1`, … y los nombres que pasan por acá son literales del motor (`caller`,
   * `externalVisibility`). Los usa el recorte del modo externo, cuyos valores salen del contexto
   * y de la ficha, nunca del cuerpo del mensaje.
   */
  set(name: string, value: unknown): string {
    this.values[name] = value;
    return name;
  }
}

/**
 * Alias FIJO de la subconsulta del recorte indirecto. Del motor, nunca de la ficha ni del payload,
 * y elegido para no colisionar con `t`, `rel_*`, `r` ni `j`.
 */
const SCOPE = 'scope_';

/** La lista de proyectos permitidos del caller. Una sola vez, para las dos variantes del recorte. */
const PERMITTED_PROJECTS =
  '(SELECT project_id FROM user_project_permissions WHERE user_id = :caller)';

/** `t.created_at`. La columna ya viene de la ficha; acá solo se califica con el alias. */
function column(spec: { column: string }): string {
  return `${MAIN}.${spec.column}`;
}

/* ---------------------------------------------------------------------------------------------
 * EL RECORTE DEL MODO EXTERNO
 * ------------------------------------------------------------------------------------------- */

/**
 * EL RECORTE DEL MODO EXTERNO, sobre el SQL y NUNCA sobre el objeto `filter`.
 *
 * En el `filter` sería más corto y estaría MAL: cualquier clave del payload que colisione con
 * `visibilityLevel` o `projectId` lo pisaría, y el aislamiento del portal de clientes dependería
 * de que ninguna ficha futura declare un filtro con esos nombres.
 *
 * SE ANTEPONE AL RESTO DEL `WHERE` y se une con AND: el filtro del caller se aplica ENCIMA del
 * conjunto ya recortado, así que pedir algo restringido da CERO FILAS, no un error. Un
 * `filter.visibilityLevel = "internal"` se combina con AND contra `= 'public'` y no matchea nada.
 *
 * LOS NOMBRES DE PARÁMETRO SON FIJOS Y NO PASAN POR EL CONTADOR: ese emite `p0`, `p1`, …, así que
 * `caller` y `externalVisibility` no pueden colisionar con ninguno del filtro.
 *
 * LOS NOMBRES DE COLUMNA SALEN DE LA FICHA, como todo el resto del módulo: `projectColumn` y
 * `visibility.column` son columnas de la BASE, no campos del contrato, y por eso llegan al SQL sin
 * ninguna resolución en el medio.
 *
 * SE REAPLICA EN CADA PÁGINA porque el `WHERE` se vuelve a armar entero: el cursor transporta la
 * clave de orden y NO un conjunto congelado.
 */
function externalScopeSql(
  resource: ResourceSpec,
  ctx: QueryContext,
  params: Params
): string | null {
  if (ctx.callerClass !== 'external') {
    return null;
  }

  const scope = resource.externalScope;
  params.set('caller', ctx.caller);

  if (scope.kind === 'exists') {
    // EL RECORTE INDIRECTO: la fila NO LLEVA el proyecto. Un actor no tiene `project_id`; su
    // visibilidad depende de TENER AL MENOS UN PROYECTO PERMITIDO. Es un EXISTS sobre la tabla que
    // sí lo lleva, y NO un `IN` sobre una columna del propio recurso — que es el error que la
    // simetría con los otros recortes invita a cometer.
    return (
      `EXISTS (SELECT 1 FROM ${scope.table} ${SCOPE} ` +
      `WHERE ${SCOPE}.${scope.foreignKey} = ${MAIN}.${scope.localKey} ` +
      `AND ${SCOPE}.${scope.projectColumn} IN ${PERMITTED_PROJECTS})`
    );
  }

  const parts = [`${MAIN}.${scope.projectColumn} IN ${PERMITTED_PROJECTS}`];
  if (scope.visibility) {
    // LA AUSENCIA DE `visibility` SIGNIFICA "este recurso no tiene columna de visibilidad", NO
    // "no recortes": el predicado de proyectos permitidos se emite siempre. `projects` es el
    // caso — un proyecto no tiene `visibility_level`, y su recorte es su propia `id`.
    params.set('externalVisibility', scope.visibility.value);
    parts.push(`${MAIN}.${scope.visibility.column} = :externalVisibility`);
  }
  return parts.join(' AND ');
}

/* ---------------------------------------------------------------------------------------------
 * WHERE
 * ------------------------------------------------------------------------------------------- */

function conditionSql(condition: FilterCondition, params: Params): string {
  const { spec, operator } = condition;

  // El filtro que NO vive en la tabla del recurso se resuelve con una subconsulta sobre la tabla
  // que lo declara. `responsiblePersonId` es el caso: filtra por `people_objectives` IGNORANDO
  // `active`, a diferencia de la relación `responsiblePersons`, que solo devuelve los activos.
  if (spec.via) {
    const inner = `SELECT ${spec.via.parentKey} FROM ${spec.via.table}`;
    switch (operator.op) {
    case 'isNull':
      return `${MAIN}.id NOT IN (${inner})`;
    case 'not': {
      const name = params.add([...operator.values]);
      return `${MAIN}.id NOT IN (${inner} WHERE ${spec.via.column} IN (:${name}))`;
    }
    default: {
      const values = operator.op === 'eq' ? operator.values : [];
      if (values.length === 0) {
        return 'FALSE';
      }
      const name = params.add([...values]);
      return `${MAIN}.id IN (${inner} WHERE ${spec.via.column} IN (:${name}))`;
    }
    }
  }

  // CONTENCIÓN SOBRE `jsonb`: un predicado POR PAR, unidos con AND (RF-7). Es lo que usa el
  // índice GIN de la columna.
  if (spec.contains) {
    const contains = spec.contains;
    if (operator.op !== 'contains') {
      return 'FALSE';
    }
    const parts = operator.values.map((value) => {
      // `CAST(... AS jsonb)` Y NUNCA `:pN::jsonb`: Sequelize parsea `:nombre` como reemplazo, y
      // `:p0::jsonb` le es ambiguo. El `::` de PostgreSQL y el `:` de los reemplazos no conviven
      // en el mismo token.
      //
      // `JSON.stringify([value])` Y NO `JSON.stringify(value)`: la columna guarda un ARRAY de
      // pares, y `tags @> '{"key":"m"}'` compara un objeto contra un array y no matchea nunca.
      const name = params.add(JSON.stringify([value]));
      return `${MAIN}.${contains.column} @> CAST(:${name} AS jsonb)`;
    });
    // AND, NO OR: "los que tienen ESTE par Y ESTE OTRO", no "cualquiera de los dos".
    return `(${parts.join(' AND ')})`;
  }

  // Búsqueda libre: `ILIKE` sobre las columnas que declara la ficha, unidas con OR entre ellas.
  // Los `%` van EN EL SQL y el texto en el parámetro: concatenarlo acá sería la inyección que
  // este módulo entero existe para no tener.
  if (spec.search) {
    if (operator.op !== 'search') {
      return 'FALSE';
    }

    // EL DESVÍO NUMÉRICO: si la ficha lo declara y el texto es SOLO DÍGITOS, el predicado es una
    // igualdad sobre esa columna y no un `ILIKE`. Viene de cómo se usa la pantalla: pegar un
    // número de requisito en el buscador es el caso más frecuente.
    //
    // LA COTA DE NUEVE DÍGITOS NO ES ARBITRARIA: la columna es INTEGER (int4). Un texto de veinte
    // dígitos por esta rama hace que PostgreSQL falle con "value out of range" -> internal_error.
    // Nueve dígitos entran siempre; con más, cae en el `ILIKE`, que además es la lectura correcta
    // ("eso no es un id").
    if (spec.searchNumericColumn && /^\d{1,9}$/.test(operator.text)) {
      return `${MAIN}.${spec.searchNumericColumn} = :${params.add(Number(operator.text))}`;
    }

    const name = params.add(operator.text);
    const parts = spec.search.map(
      (col) => `${MAIN}.${col} ILIKE '%' || :${name} || '%'`
    );
    return `(${parts.join(' OR ')})`;
  }

  const col = column({ column: spec.column as string });

  switch (operator.op) {
  case 'isNull':
    return `${col} IS NULL`;
  case 'eq': {
    if (operator.values.length === 0) {
      // Un `IN ()` es un error de sintaxis en PostgreSQL, y "ninguno de estos" es FALSE.
      return 'FALSE';
    }
    if (operator.values.length === 1) {
      return `${col} = :${params.add(operator.values[0])}`;
    }
    return `${col} IN (:${params.add([...operator.values])})`;
  }
  case 'not': {
    if (operator.values.length === 0) {
      return 'TRUE';
    }
    if (operator.values.length === 1) {
      return `${col} <> :${params.add(operator.values[0])}`;
    }
    return `${col} NOT IN (:${params.add([...operator.values])})`;
  }
  case 'range': {
    const operators: Record<string, string> = { gt: '>', gte: '>=', lt: '<', lte: '<=' };
    const parts: string[] = [];
    for (const key of Object.keys(operator.bounds)) {
      const value = operator.bounds[key as keyof typeof operator.bounds];
      parts.push(`${col} ${operators[key]} :${params.add(value)}`);
    }
    return `(${parts.join(' AND ')})`;
  }
  default:
    return 'FALSE';
  }
}

function groupSql(conditions: readonly FilterCondition[], params: Params): string {
  if (conditions.length === 0) {
    return 'TRUE';
  }
  return conditions.map((condition) => conditionSql(condition, params)).join(' AND ');
}

/** El `WHERE` completo: las claves con AND, y el `or` como UN grupo parentizado más. */
function whereSql(filter: ParsedFilter, params: Params): string[] {
  const parts: string[] = [];
  for (const condition of filter.conditions) {
    parts.push(conditionSql(condition, params));
  }
  if (filter.or && filter.or.length > 0) {
    const branches = filter.or.map((group) => `(${groupSql(group.conditions, params)})`);
    parts.push(`(${branches.join(' OR ')})`);
  }
  return parts;
}

/* ---------------------------------------------------------------------------------------------
 * ORDER BY y keyset
 * ------------------------------------------------------------------------------------------- */

function orderBySql(sort: readonly SortCriterion[]): string {
  return sort.map((criterion) => `${MAIN}.${criterion.column} ${criterion.dir}`).join(', ');
}

/**
 * El predicado de la página siguiente: KEYSET, NUNCA `OFFSET`.
 *
 * Con `OFFSET` la página N cuesta O(N) y, lo que importa más, una inserción concurrente hace que
 * se saltee o se repita una fila. El keyset resuelve la página siguiente comparando contra la
 * última clave devuelta, que es estable frente a escrituras.
 *
 * DOS RAMAS, y cuál se usa depende del orden:
 *
 *   - TODAS LAS DIRECCIONES IGUALES Y NINGUNA COLUMNA NULL-ABLE -> comparación de TUPLAS,
 *     `(a, b, id) < (:k0, :k1, :k2)`. PostgreSQL la soporta nativamente y es la forma que USA EL
 *     ÍNDICE compuesto de S-021. Es el camino del orden por defecto.
 *   - CUALQUIER OTRO CASO -> expansión disyuntiva, `(a < k0) OR (a = k0 AND b > k1) OR …`, con las
 *     comparaciones conscientes de los NULL. La tupla no sirve acá por dos razones distintas: con
 *     direcciones mixtas compara todas las columnas con el mismo operador, y con un NULL adentro
 *     devuelve NULL —o sea, NINGUNA FILA—, que es cortar el recorrido en silencio.
 */
function keysetSql(sort: readonly SortCriterion[], keys: readonly unknown[], params: Params): string {
  const uniform = sort.every((criterion) => criterion.dir === sort[0].dir);
  const anyNullable = sort.some((criterion) => criterion.nullable);

  if (uniform && !anyNullable) {
    const names = keys.map((key) => params.add(key));
    const operator = sort[0].dir === 'DESC' ? '<' : '>';
    const columns = sort.map((criterion) => `${MAIN}.${criterion.column}`).join(', ');
    const placeholders = names.map((name) => `:${name}`).join(', ');
    return `(${columns}) ${operator} (${placeholders})`;
  }

  /**
   * "Estrictamente después de la clave" y "el mismo valor que la clave", por columna.
   *
   * SE DECIDE ACÁ, EN EL BUILDER, Y NO EN SQL: el valor de la clave viene del cursor ya decodificado,
   * así que se sabe si es NULL antes de generar una sola letra. Eso convierte cuatro casos que en
   * SQL serían un `CASE` ilegible en cuatro fragmentos simples.
   *
   * El orden de los NULL es EL DE POSTGRESQL POR DEFECTO —`DESC` los pone primero, `ASC` últimos—
   * y no uno propio: forzar `NULLS LAST` sobre un índice `DESC` obligaría a un `Sort`, que es
   * exactamente lo que el keyset existe para evitar.
   */
  const fragments = sort.map((criterion, index) => {
    const col = `${MAIN}.${criterion.column}`;
    const key = keys[index];
    const isNullKey = key === null || key === undefined;

    if (!criterion.nullable) {
      const name = params.add(key);
      return {
        after: `${col} ${criterion.dir === 'DESC' ? '<' : '>'} :${name}`,
        equal: `${col} = :${name}`,
      };
    }

    if (isNullKey) {
      return criterion.dir === 'DESC'
        // NULLS FIRST: después de un NULL viene todo lo que no es NULL.
        ? { after: `${col} IS NOT NULL`, equal: `${col} IS NULL` }
        // NULLS LAST: después de un NULL no viene nada más en esta columna.
        : { after: 'FALSE', equal: `${col} IS NULL` };
    }

    const name = params.add(key);
    return criterion.dir === 'DESC'
      // NULLS FIRST: los NULL ya quedaron atrás, y `col < :k` los excluye solo.
      ? { after: `${col} < :${name}`, equal: `${col} = :${name}` }
      // NULLS LAST: los NULL vienen DESPUÉS de cualquier valor, así que entran en "after".
      : { after: `(${col} > :${name} OR ${col} IS NULL)`, equal: `${col} = :${name}` };
  });

  const build = (index: number): string => {
    const { after, equal } = fragments[index];
    if (index === sort.length - 1) {
      return after;
    }
    return `(${after} OR (${equal} AND ${build(index + 1)}))`;
  };

  return build(0);
}

/* ---------------------------------------------------------------------------------------------
 * SELECT
 * ------------------------------------------------------------------------------------------- */

/** Alias interno de la clave de orden `i`. Va en el SELECT para poder emitir el cursor. */
export function sortKeyAlias(index: number): string {
  return `__k${index}`;
}

/** Alias de un campo de una relación 1:1 en la fila cruda: `project__name`. */
export function relationFieldAlias(relation: string, field: string): string {
  return `${relation}__${field}`;
}

interface SelectParts {
  columns: string[];
  joins: string[];
}

function selectParts(
  resource: ResourceSpec,
  fields: readonly string[],
  sort: readonly SortCriterion[]
): SelectParts {
  const columns: string[] = [];
  const joins: string[] = [];

  for (const name of fields) {
    const base = resource.base[name];
    if (base) {
      columns.push(`${MAIN}.${base.column} AS "${name}"`);
      continue;
    }
    const includable = resource.includable[name];
    if (!includable) {
      continue;
    }
    if (includable.kind === 'field') {
      columns.push(`${MAIN}.${includable.column} AS "${name}"`);
      continue;
    }
    // EL CAMPO CALCULADO: una expresión por fila, con el alias del campo del contrato. NO GENERA
    // JOIN —no hay tabla que unir— y la expresión sale de la ficha, nunca del payload: es la
    // misma regla que gobierna `ManyRelationSpec.where`.
    if (includable.kind === 'computed') {
      columns.push(`(${includable.expr}) AS "${name}"`);
      continue;
    }
    if (includable.cardinality === 'one') {
      const relation = includable as OneRelationSpec;
      const alias = relationAlias(name);
      // LEFT JOIN cuando la FK es NULL-able: con INNER, una tarea sin requisito DESAPARECERÍA de
      // la colección. Datos de menos, en silencio.
      const kind = relation.optional ? 'LEFT JOIN' : 'INNER JOIN';
      joins.push(
        `${kind} ${relation.table} ${alias} ON ${alias}.${relation.targetKey} = ${MAIN}.${relation.localKey}`
      );
      for (const [field, col] of Object.entries(relation.fields)) {
        columns.push(`${alias}.${col} AS "${relationFieldAlias(name, field)}"`);
      }
    }
    // Las relaciones de colección NO van en la consulta principal: se resuelven POR LOTE de la
    // página, en `include.ts` (RF-36).
  }

  // Las claves de orden, siempre: son lo que el cursor transporta, y el conjunto devuelto puede
  // no incluirlas (`sort: ['-createdAt']` con `fields: ['title']`).
  sort.forEach((criterion, index) => {
    columns.push(`${MAIN}.${criterion.column} AS "${sortKeyAlias(index)}"`);
  });

  return { columns, joins };
}

/* ---------------------------------------------------------------------------------------------
 * Los tres SQL que arma el motor
 * ------------------------------------------------------------------------------------------- */

/**
 * La consulta de filas de un `list`.
 *
 * Pide `LIMIT limit + 1`: la fila extra NO SE DEVUELVE, solo dice si hay página siguiente. Es lo
 * que reemplaza al `COUNT` de "¿hay más?", que costaría un scan entero por página.
 */
export function buildRowsSql(
  resource: ResourceSpec,
  query: ValidatedListQuery,
  ctx: QueryContext,
  keys?: readonly unknown[]
): SqlPlan {
  const params = new Params();
  const { columns, joins } = selectParts(resource, query.fields, query.sort);
  const where = whereSql(query.filter, params);

  if (keys && keys.length > 0) {
    where.push(keysetSql(query.sort, keys, params));
  }

  // AL FRENTE DEL `WHERE`, siempre: el filtro y el keyset del caller se aplican ENCIMA.
  const scope = externalScopeSql(resource, ctx, params);
  if (scope) {
    where.unshift(scope);
  }

  const sql = [
    `SELECT ${columns.join(', ')}`,
    `FROM ${resource.table} ${MAIN}`,
    ...joins,
    where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
    `ORDER BY ${orderBySql(query.sort)}`,
    `LIMIT ${query.limit + 1}`,
  ]
    .filter((line) => line !== '')
    .join('\n');

  return { sql, replacements: params.values };
}

/**
 * El `COUNT` de `count: true` y `count: 'only'`.
 *
 * MISMO filtro y MISMOS joins que la consulta de filas: un total que no cuenta lo mismo que la
 * colección es peor que no tener total. Es exacto, no estimado, y por eso es opt-in.
 */
export function buildCountSql(
  resource: ResourceSpec,
  query: ValidatedListQuery,
  ctx: QueryContext
): SqlPlan {
  const params = new Params();
  const { joins } = selectParts(resource, query.fields, query.sort);
  const where = whereSql(query.filter, params);

  // EL COUNT NO SE PUEDE OLVIDAR: sin el recorte devolvería el total REAL y filtraría exactamente
  // la información que el recorte esconde. Un total que no cuenta lo mismo que la colección es
  // peor que no tener total, y acá además es una fuga.
  const scope = externalScopeSql(resource, ctx, params);
  if (scope) {
    where.unshift(scope);
  }

  const sql = [
    'SELECT COUNT(*) AS total',
    `FROM ${resource.table} ${MAIN}`,
    ...joins,
    where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
  ]
    .filter((line) => line !== '')
    .join('\n');

  return { sql, replacements: params.values };
}

/**
 * La consulta de un `get`: la misma maquinaria, resuelta por PK.
 *
 * No lleva keyset ni cursor —no hay página que continuar— y su `LIMIT` es 1: un id identifica una
 * fila. Lo que cambia respecto de un `list` es la RESPUESTA, no el SQL: `data` es el recurso.
 */
export function buildGetSql(
  resource: ResourceSpec,
  query: ValidatedGetQuery,
  ctx: QueryContext
): SqlPlan {
  const params = new Params();
  const { columns, joins } = selectParts(resource, query.fields, []);

  // EL `WHERE` SE ARMA COMO ARRAY, igual que en los otros dos, para que el recorte pueda ir al
  // frente. Un `get` recortado que no matchea devuelve CERO FILAS, y `runGet` traduce eso al
  // `{recurso}_not_found` de la ficha: "no existe" y "no lo podés ver" son INDISTINGUIBLES, porque
  // distinguirlos le confirmaría a un caller externo que el recurso existe.
  const where = [`${MAIN}.id = :${params.add(query.id)}`];
  const scope = externalScopeSql(resource, ctx, params);
  if (scope) {
    where.unshift(scope);
  }

  const sql = [
    `SELECT ${columns.join(', ')}`,
    `FROM ${resource.table} ${MAIN}`,
    ...joins,
    `WHERE ${where.join(' AND ')}`,
    'LIMIT 1',
  ]
    .filter((line) => line !== '')
    .join('\n');

  return { sql, replacements: params.values };
}
