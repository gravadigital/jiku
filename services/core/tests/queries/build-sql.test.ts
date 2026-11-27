import 'mocha';
import 'should';
import { Sequelize } from 'sequelize-typescript';
import { tasksSpec } from '../../src/queries/tasks/tasks-spec';
import { buildCountSql, buildGetSql, buildRowsSql } from '../../src/queries/engine/build-sql';
import { validateGet, validateList } from '../../src/queries/engine/validate-query';
import { SqlPlan, ValidatedGetQuery, ValidatedListQuery } from '../../src/queries/engine/types';
import {
  AttachmentOwner,
  BaseSpec,
  CallerClass,
  FilterableSpec,
  PolymorphicExternalScope,
  QueryContext,
  ResourceSpec,
} from '../../src/queries/types';

/**
 * El SQL generado, leído como texto.
 *
 * Se lee el SQL y no solo el resultado a propósito (CA-29): un test que solo mire las filas
 * pasaría igual con una implementación que concatene valores del payload, que es exactamente el
 * bug que este motor no puede tener. Acá se verifica la propiedad estructural: los NOMBRES salen
 * de la ficha y los VALORES nunca aparecen en el string.
 */

const EXTERNAL_CALLER = 'sub-q-external';

/**
 * El contexto que los builders necesitan desde S-023, para saber si recortan.
 *
 * `db` va como objeto vacío a propósito: `build-sql.ts` NO EJECUTA NADA, solo arma texto. Si
 * alguna vez tocara la conexión, este doble lo haría estallar.
 */
function ctxWith(callerClass: CallerClass, caller = 'sub-q-user'): QueryContext {
  return { caller, callerClass, db: {} as unknown as Sequelize };
}

/** El contexto por defecto de los tests de forma: INTERNO, o sea SIN recorte. */
const INTERNAL = ctxWith('internal');

function plan(payload: unknown, keys?: unknown[], ctx: QueryContext = INTERNAL): SqlPlan {
  const validated = validateList(tasksSpec, payload) as { value: ValidatedListQuery };
  return buildRowsSql(tasksSpec, validated.value, ctx, keys);
}

/** Un `replacements` es `Record<string, unknown>`: este helper le pone tipo a la aserción. */
function param(replacements: Record<string, unknown>, name: string): any {
  return replacements[name];
}

function countPlan(payload: unknown, ctx: QueryContext = INTERNAL): SqlPlan {
  const validated = validateList(tasksSpec, payload) as { value: ValidatedListQuery };
  return buildCountSql(tasksSpec, validated.value, ctx);
}

function getPlan(payload: unknown, ctx: QueryContext = INTERNAL): SqlPlan {
  const validated = validateGet(tasksSpec, payload) as { value: ValidatedGetQuery };
  return buildGetSql(tasksSpec, validated.value, ctx);
}

describe('queries/engine/build-sql — la traducción y las dos reglas duras', () => {
  it('TS-37 · consulta `FROM objectives` y el SQL NO contiene la palabra `tasks`', () => {
    const { sql } = plan({ filter: { projectId: 12 } });

    sql.should.containEql('FROM objectives');
    // ADR-004: el recurso se llama `tasks` en el contrato y en ningún lado más.
    sql.should.not.containEql('tasks');
  });

  it('TS-52 · un valor con comillas viaja en `replacements` y NO en el SQL', () => {
    const hostile = "O'Brien; DROP TABLE objectives;--";

    const { sql, replacements } = plan({ filter: { q: hostile } });

    sql.should.not.containEql(hostile);
    sql.should.not.containEql('DROP');
    Object.values(replacements).should.containEql(hostile);
  });

  it('CA-29 · ningún nombre de parámetro se deriva del payload', () => {
    const { replacements } = plan({
      filter: { projectId: 12, state: ['activo'], createdAt: { gte: '2026-08-01' } },
    });

    // Contador del builder, no claves del caller: `p0`, `p1`, `p2`…
    Object.keys(replacements).forEach((name) => name.should.match(/^p\d+$/));
  });

  it('los campos del contrato salen con SU NOMBRE como alias', () => {
    const { sql } = plan({ fields: ['createdAt', 'projectId'] });

    sql.should.containEql('t.created_at AS "createdAt"');
    sql.should.containEql('t.project_id AS "projectId"');
  });

  it('CA-21 · `priority` y `priorityValue` salen de la MISMA columna', () => {
    const { sql } = plan({});

    sql.should.containEql('t.priority AS "priority"');
    sql.should.containEql('t.priority AS "priorityValue"');
  });
});

describe('queries/engine/build-sql — los seis operadores (CA-3)', () => {
  it('igualdad, IN, IS NULL, distinto y rango', () => {
    plan({ filter: { projectId: 12 } }).sql.should.containEql('t.project_id = :p0');
    plan({ filter: { state: ['backlog', 'activo'] } }).sql.should.containEql('t.state IN (:p0)');
    plan({ filter: { requirementId: null } }).sql.should.containEql('t.requirement_id IS NULL');
    plan({ filter: { state: { not: 'cancelado' } } }).sql.should.containEql('t.state <> :p0');

    const range = plan({ filter: { createdAt: { gt: '2026-08-01', lt: '2026-08-10' } } });
    range.sql.should.containEql('t.created_at > :p0');
    range.sql.should.containEql('t.created_at < :p1');
  });

  it('`q` es ILIKE sobre las columnas declaradas, con los `%` EN EL SQL', () => {
    const { sql, replacements } = plan({ filter: { q: 'motor' } });

    // El texto del caller va en el parámetro; concatenarlo acá sería la inyección.
    sql.should.containEql("t.title ILIKE '%' || :p0 || '%'");
    sql.should.containEql("t.description ILIKE '%' || :p0 || '%'");
    sql.should.containEql(' OR ');
    param(replacements, 'p0').should.equal('motor');
  });

  it('TS-9 · el `or` queda PARENTIZADO y combinado con AND contra el resto', () => {
    const { sql } = plan({
      filter: {
        responsiblePersonId: 77,
        or: [{ state: 'activo' }, { state: 'finalizado', finishedAt: { gt: '2026-08-16' } }],
      },
    });

    const where = sql.slice(sql.indexOf('WHERE'));
    where.should.containEql('((t.state = ');
    where.should.containEql(' OR ');
    where.should.containEql(' AND ');
    // Y el filtro de fuera del `or` sigue ahí, por subconsulta.
    where.should.containEql('people_objectives');
  });

  it('CA-11 · `responsiblePersonId` filtra por subconsulta SIN mirar `active`', () => {
    const { sql } = plan({ filter: { responsiblePersonId: 77 } });

    sql.should.containEql('t.id IN (SELECT objective_id FROM people_objectives WHERE person_id IN (:p0))');
    // La asimetría con la relación es deliberada: acá NO se filtra por `active`.
    sql.slice(sql.indexOf('WHERE')).should.not.containEql('active');
  });

  it('CA-21 · filtrar por `priority` con nombre manda los DOS enteros', () => {
    const urgent = plan({ filter: { priority: 'urgente' } });

    urgent.sql.should.containEql('t.priority IN (:p0)');
    param(urgent.replacements, 'p0').should.deepEqual([4, 5]);

    const byValue = plan({ filter: { priorityValue: 5 } });
    byValue.sql.should.containEql('t.priority = :p0');
    param(byValue.replacements, 'p0').should.equal(5);
  });
});

describe('queries/engine/build-sql — los bordes de cada operador', () => {
  it('una lista VACÍA es `FALSE`, no un `IN ()` que PostgreSQL rechaza', () => {
    // "ninguno de estos" tiene una respuesta: cero filas. Un `IN ()` sería un error de sintaxis, y
    // el caller recibiría `internal_error` por un filtro perfectamente legítimo.
    plan({ filter: { state: [] } }).sql.should.containEql('FALSE');
  });

  it('`{not: [...]}` con varios valores es `NOT IN`', () => {
    const { sql, replacements } = plan({ filter: { state: { not: ['cancelado', 'backlog'] } } });

    sql.should.containEql('t.state NOT IN (:p0)');
    param(replacements, 'p0').should.deepEqual(['cancelado', 'backlog']);
  });

  it('`{not}` sobre un filtro por subconsulta es `NOT IN (SELECT …)`', () => {
    const { sql } = plan({ filter: { responsiblePersonId: { not: 77 } } });

    sql.should.containEql('t.id NOT IN (SELECT objective_id FROM people_objectives');
  });

  it('`null` sobre un filtro por subconsulta significa "sin ninguno"', () => {
    const { sql } = plan({ filter: { responsiblePersonId: null } });

    sql.should.containEql('t.id NOT IN (SELECT objective_id FROM people_objectives)');
  });

  it('el rango acepta los cuatro comparadores a la vez', () => {
    const { sql } = plan({
      filter: { createdAt: { gt: '2026-01-01', gte: '2026-01-02', lt: '2026-02-01', lte: '2026-02-02' } },
    });

    for (const fragment of ['t.created_at > :', 't.created_at >= :', 't.created_at < :', 't.created_at <= :']) {
      sql.should.containEql(fragment);
    }
  });

  it('sin filtro no hay WHERE', () => {
    plan({}).sql.should.not.containEql('WHERE');
  });
});

describe('queries/engine/build-sql — orden, keyset y límite', () => {
  it('TS-11 · el ORDER BY por defecto termina en `id`, con la misma dirección', () => {
    plan({}).sql.should.containEql('ORDER BY t.created_at DESC, t.id DESC');
  });

  it('TS-12, TS-40 · `-priority` ordena por la COLUMNA NUMÉRICA', () => {
    // No por el nombre del enum: el orden alfabético de los nombres no es el de la prioridad.
    plan({ sort: ['-priority', 'title'] }).sql.should.containEql(
      'ORDER BY t.priority DESC, t.title ASC, t.id ASC'
    );
  });

  it('TS-18 · la página siguiente es una COMPARACIÓN DE TUPLAS, nunca OFFSET', () => {
    const { sql, replacements } = plan({}, ['2026-08-01T00:00:00.000Z', 8140]);

    sql.should.containEql('(t.created_at, t.id) < (:p0, :p1)');
    sql.should.not.containEql('OFFSET');
    param(replacements, 'p0').should.equal('2026-08-01T00:00:00.000Z');
    param(replacements, 'p1').should.equal(8140);
  });

  it('con direcciones MIXTAS el keyset se expande a la forma disyuntiva', () => {
    // La tupla compara todas las columnas con el mismo operador: con direcciones mixtas no sirve.
    const { sql } = plan({ sort: ['title', '-createdAt'] }, ['A', '2026-08-01', 5]);

    sql.should.not.containEql('(t.title, t.created_at, t.id)');
    sql.should.containEql('t.title > :p0');
    sql.should.containEql('t.title = :p0 AND');
    sql.should.containEql('t.created_at < :p1');
  });

  it('ordenar por una columna NULL-able usa la rama CONSCIENTE DE LOS NULL, no la tupla', () => {
    // Una comparación de tuplas con un NULL adentro da NULL —o sea, NINGUNA fila—: el recorrido se
    // cortaría en el primer NULL y devolvería datos de menos, en silencio.
    const { sql } = plan({ sort: ['-finishedAt'] }, ['2026-08-20T00:00:00.000Z', 8144]);

    sql.should.not.containEql('(t.finished_at, t.id) <');
    sql.should.containEql('t.finished_at < :p0');
    sql.should.containEql('t.finished_at = :p0 AND t.id < :p1');
  });

  it('con la clave en NULL y orden DESC, después de un NULL viene todo lo que NO es NULL', () => {
    // `DESC` en PostgreSQL pone los NULL PRIMERO: la parte ya recorrida son los NULL.
    const { sql } = plan({ sort: ['-finishedAt'] }, [null, 8145]);

    sql.should.containEql('t.finished_at IS NOT NULL');
    sql.should.containEql('t.finished_at IS NULL AND t.id < :');
  });

  it('con la clave en NULL y orden ASC, no viene nada más en esa columna', () => {
    // `ASC` los pone ÚLTIMOS: si la clave es NULL, ya se recorrió todo lo demás.
    const { sql } = plan({ sort: ['finishedAt'] }, [null, 8145]);

    sql.should.containEql('FALSE OR (t.finished_at IS NULL AND t.id > :');
  });

  it('con orden ASC y clave no nula, los NULL entran en "lo que falta"', () => {
    const { sql } = plan({ sort: ['finishedAt'] }, ['2026-08-10T00:00:00.000Z', 8143]);

    sql.should.containEql('(t.finished_at > :p0 OR t.finished_at IS NULL)');
  });

  it('el orden por defecto SIGUE usando la tupla: es el camino del índice de S-021', () => {
    // `createdAt` e `id` son NOT NULL, así que la rama rápida se conserva donde importa.
    plan({}, ['2026-08-01T00:00:00.000Z', 8140]).sql.should.containEql(
      '(t.created_at, t.id) < (:p0, :p1)'
    );
  });

  it('CA-13 · se pide `LIMIT limit + 1`, que es lo que reemplaza al COUNT de "¿hay más?"', () => {
    plan({ page: { limit: 200 } }).sql.should.containEql('LIMIT 201');
    plan({}).sql.should.containEql('LIMIT 51');
  });
});

describe('queries/engine/build-sql — include, count y get', () => {
  it('las relaciones 1:1 van por JOIN, y la NULL-able por LEFT JOIN', () => {
    const { sql } = plan({ include: ['project', 'requirement'] });

    sql.should.containEql('INNER JOIN projects rel_project ON rel_project.id = t.project_id');
    sql.should.containEql(
      'LEFT JOIN requirements rel_requirement ON rel_requirement.id = t.requirement_id'
    );
    sql.should.containEql('rel_project.name AS "project__name"');
  });

  it('las relaciones de COLECCIÓN no van en la consulta principal', () => {
    const { sql } = plan({ include: ['comments', 'responsiblePersons', 'subscriptors'] });

    sql.should.not.containEql('objective_activity');
    sql.should.not.containEql('people_objectives');
    sql.should.not.containEql('objectives_subscriptors');
  });

  it('CA-14 · el COUNT usa el MISMO filtro y los mismos joins, y no lleva LIMIT', () => {
    const rows = plan({ filter: { projectId: 12 }, include: ['project'] });
    const counted = countPlan({ filter: { projectId: 12 }, include: ['project'] });

    counted.sql.should.containEql('SELECT COUNT(*) AS total');
    counted.sql.should.containEql('INNER JOIN projects rel_project');
    counted.sql.should.not.containEql('LIMIT');
    // Mismo WHERE que la consulta de filas.
    counted.sql.slice(counted.sql.indexOf('WHERE')).should.equal(
      rows.sql.slice(rows.sql.indexOf('WHERE'), rows.sql.indexOf('ORDER BY')).trim()
    );
  });

  it('un `get` resuelve por PK, con LIMIT 1 y sin keyset', () => {
    const { sql, replacements } = getPlan({ id: 8140, include: ['project'] });

    sql.should.containEql('WHERE t.id = :p0');
    sql.should.containEql('LIMIT 1');
    sql.should.not.containEql('ORDER BY');
    param(replacements, 'p0').should.equal(8140);
  });

  it('CA-18 · el SQL no lleva NINGÚN recorte por clase de caller: eso es S-023', () => {
    const { sql } = plan({ filter: { projectId: 12 } });
    const where = sql.slice(sql.indexOf('WHERE'), sql.indexOf('ORDER BY'));

    // `visibility_level` está en el SELECT porque es un campo base del contrato; lo que NO puede
    // estar es en el WHERE, que es donde S-023 va a agregar el recorte.
    where.should.not.containEql('visibility_level');
    where.should.equal('WHERE t.project_id = :p0\n');
  });
});


/**
 * EL RECORTE DEL MODO EXTERNO, leído en el SQL (S-023).
 *
 * Se lee el TEXTO y no solo las filas, por la misma razón que el resto del archivo: una
 * implementación que agregara el recorte al objeto `filter` en vez de al SQL devolvería las mismas
 * filas en el caso feliz y sería pisable por una clave del payload. La verificación desde el
 * COMPORTAMIENTO —que es la que atrapa el recorte puesto en el lugar equivocado— está en
 * `tasks-external-scope.test.ts`.
 */
describe('queries/engine/build-sql — el recorte del modo externo (S-023)', () => {
  const EXTERNAL = ctxWith('external', EXTERNAL_CALLER);
  const SCOPE_PROJECTS =
    't.project_id IN (SELECT project_id FROM user_project_permissions WHERE user_id = :caller)';
  const SCOPE_VISIBILITY = 't.visibility_level = :externalVisibility';

  it('TS-22 · modo INTERNO: el SQL no lleva recorte', () => {
    const { sql } = plan({ filter: { projectId: 12 } }, undefined, ctxWith('internal'));

    // El modo interno no recorta NADA a nivel de fila, y es una decisión explícita de la v1.
    sql.should.not.containEql('user_project_permissions');
    sql.should.not.containEql('visibility_level =');
  });

  it('TS-23 · modo CONECTOR: el SQL no lleva recorte', () => {
    const { sql } = plan({ filter: { projectId: 12 } }, undefined, ctxWith('connector'));

    // El conector autoriza por su cuenta, que es lo que hace la api con `validateProjectPermissions`.
    sql.should.not.containEql('user_project_permissions');
    sql.should.not.containEql('visibility_level =');
  });

  it('TS-24 · modo EXTERNO: el recorte está en el SQL y los valores en `replacements`', () => {
    const { sql, replacements } = plan({}, undefined, EXTERNAL);

    sql.should.containEql(SCOPE_PROJECTS);
    sql.should.containEql(SCOPE_VISIBILITY);
    // NI EL CALLER NI EL VALOR DE VISIBILIDAD SE CONCATENAN: las dos reglas duras del módulo
    // valen también para el recorte.
    sql.should.not.containEql(EXTERNAL_CALLER);
    sql.should.not.containEql("'public'");
    param(replacements, 'caller').should.equal(EXTERNAL_CALLER);
    param(replacements, 'externalVisibility').should.equal('public');
  });

  it('TS-25 · el recorte va ANTES del filtro del caller, y se unen con AND', () => {
    const { sql } = plan({ filter: { state: 'activo' } }, undefined, EXTERNAL);
    const where = sql.slice(sql.indexOf('WHERE'), sql.indexOf('ORDER BY'));

    // El filtro del caller se aplica ENCIMA del conjunto ya recortado: pedir algo restringido da
    // cero filas, no un error.
    where.indexOf(SCOPE_PROJECTS).should.be.below(where.indexOf('t.state = :p0'));
    where.should.equal(
      `WHERE ${SCOPE_PROJECTS} AND ${SCOPE_VISIBILITY} AND t.state = :p0\n`
    );
  });

  it('TS-25b · el keyset de la página siguiente NO desplaza al recorte', () => {
    const { sql } = plan({}, ['2026-08-01T00:00:00.000Z', 9001], EXTERNAL);
    const where = sql.slice(sql.indexOf('WHERE'), sql.indexOf('ORDER BY'));

    // El WHERE se vuelve a armar ENTERO en cada página, así que el recorte se REAPLICA: el cursor
    // no puede congelar un conjunto que ya no corresponde.
    where.indexOf(SCOPE_PROJECTS).should.be.below(where.indexOf('(t.created_at, t.id) <'));
  });

  it('TS-26 · el COUNT lleva el MISMO recorte', () => {
    // Sin esto, `count: true` devolvería el total real y filtraría exactamente la información que
    // el recorte esconde. Es el error más fácil de cometer de toda la tarea.
    const external = countPlan({}, EXTERNAL);
    const internal = countPlan({});

    external.sql.should.containEql(SCOPE_PROJECTS);
    external.sql.should.containEql(SCOPE_VISIBILITY);
    internal.sql.should.not.containEql('user_project_permissions');
  });

  it('TS-27 · el `get` lleva el recorte junto al `id`, unidos con AND', () => {
    const { sql, replacements } = getPlan({ id: 9002 }, EXTERNAL);
    const where = sql.slice(sql.indexOf('WHERE'), sql.indexOf('LIMIT'));

    where.should.equal(`WHERE ${SCOPE_PROJECTS} AND ${SCOPE_VISIBILITY} AND t.id = :p0\n`);
    // Los nombres del recorte son FIJOS y no pasan por el contador de `Params`, así que no pueden
    // colisionar con los `p0`, `p1`… del filtro.
    param(replacements, 'p0').should.equal(9002);
    param(replacements, 'caller').should.equal(EXTERNAL_CALLER);
  });

  it('el modo externo NO cambia el SQL de los otros dos: byte a byte el de S-022', () => {
    const connector = plan({ filter: { projectId: 12 } }, undefined, ctxWith('connector'));
    const internal = plan({ filter: { projectId: 12 } }, undefined, ctxWith('internal'));

    connector.sql.should.equal(internal.sql);
    connector.replacements.should.deepEqual(internal.replacements);
  });
});


/**
 * EL CAMPO CALCULADO: la tercera forma de incluible (S-024, Task 1).
 *
 * Se ejercita con una ficha de prueba local y NO con la de `requirements`: lo que se verifica acá
 * es una capacidad DEL MOTOR, y acoplar el test a una ficha concreta haría que un cambio del
 * contrato de un recurso rompiera el test de una capacidad genérica.
 */
describe('queries/engine/build-sql — el campo calculado (S-024)', () => {
  const COMPUTED_EXPR =
    'COALESCE((SELECT SUM(wt.minutes) FROM worked_times wt WHERE wt.objective_id = t.id), 0)';

  /** `tasksSpec` más UN incluible calculado. Lo demás es idéntico. */
  const SPEC: ResourceSpec = {
    ...tasksSpec,
    includable: {
      ...tasksSpec.includable,
      totalMinutes: { kind: 'computed', expr: COMPUTED_EXPR, transform: (raw) => Number(raw) },
    },
    includableNames: [...tasksSpec.includableNames, 'totalMinutes'],
    fieldNames: [...tasksSpec.fieldNames, 'totalMinutes'],
  };

  function computedPlan(payload: unknown): SqlPlan {
    const validated = validateList(SPEC, payload) as { value: ValidatedListQuery };
    return buildRowsSql(SPEC, validated.value, INTERNAL);
  }

  it('TS-65 · el calculado va en el SELECT con su alias y NO genera JOIN', () => {
    const validated = validateGet(SPEC, { id: 88, fields: ['id'], include: ['totalMinutes'] }) as {
      value: ValidatedGetQuery;
    };
    const { sql } = buildGetSql(SPEC, validated.value, INTERNAL);

    sql.should.containEql(`(${COMPUTED_EXPR}) AS "totalMinutes"`);
    // Un calculado es una EXPRESIÓN por fila, no una relación: no hay tabla que unir.
    sql.should.not.containEql('JOIN');
  });

  it('el calculado NO aparece en el SQL del COUNT: el conteo no proyecta campos', () => {
    const validated = validateList(SPEC, { include: ['totalMinutes'] }) as {
      value: ValidatedListQuery;
    };
    const { sql } = buildCountSql(SPEC, validated.value, INTERNAL);

    sql.should.not.containEql('totalMinutes');
    sql.should.not.containEql('worked_times');
  });

  it('un calculado sin pedir NO aparece en el SELECT', () => {
    const { sql } = computedPlan({});

    sql.should.not.containEql('totalMinutes');
  });

  it('el calculado convive con el resto del SELECT sin desplazar las claves de orden', () => {
    const { sql } = computedPlan({ fields: ['title'], include: ['totalMinutes'] });

    sql.should.containEql('t.title AS "title"');
    sql.should.containEql(`(${COMPUTED_EXPR}) AS "totalMinutes"`);
    sql.should.containEql('t.created_at AS "__k0"');
  });
});


/**
 * EL FILTRO DE CONTENCIÓN `jsonb` EN EL SQL (S-024, Task 2).
 *
 * Dos propiedades y las dos importan: el valor viaja SIEMPRE en `replacements` como JSON
 * serializado, y el cast se escribe `CAST(... AS jsonb)` y NUNCA `::jsonb` —el `::` colisiona con
 * el parser de reemplazos `:nombre` de Sequelize—.
 */
describe('queries/engine/build-sql — el filtro de contención (S-024)', () => {
  const SPEC: ResourceSpec = {
    ...tasksSpec,
    filterable: {
      ...tasksSpec.filterable,
      tag: { contains: { column: 'tags', shape: ['key', 'value'] } },
    },
    filterableNames: [...tasksSpec.filterableNames, 'tag'],
  };

  function tagPlan(raw: unknown): SqlPlan {
    const validated = validateList(SPEC, { filter: { tag: raw } }) as { value: ValidatedListQuery };
    return buildRowsSql(SPEC, validated.value, INTERNAL);
  }

  it('TS-66 · un par emite `@> CAST(:p0 AS jsonb)` con el ARRAY serializado', () => {
    const { sql, replacements } = tagPlan({ key: 'modulo', value: 'facturacion' });

    sql.should.containEql('t.tags @> CAST(:p0 AS jsonb)');
    // NUNCA `::jsonb`: Sequelize parsea `:nombre` como reemplazo y `:p0::jsonb` le es ambiguo.
    sql.should.not.containEql('::jsonb');
    // ARRAY de un elemento y no el objeto suelto: la columna guarda un array de pares, y
    // `tags @> '{"key":"m"}'` no matchea nunca.
    param(replacements, 'p0').should.equal('[{"key":"modulo","value":"facturacion"}]');
    (typeof param(replacements, 'p0')).should.equal('string');
  });

  it('TS-66 · dos pares emiten DOS predicados unidos con AND, no con OR', () => {
    const { sql, replacements } = tagPlan([
      { key: 'modulo', value: 'facturacion' },
      { key: 'cliente', value: 'acme' },
    ]);

    sql.should.containEql('(t.tags @> CAST(:p0 AS jsonb) AND t.tags @> CAST(:p1 AS jsonb))');
    sql.should.not.containEql('CAST(:p0 AS jsonb) OR');
    param(replacements, 'p0').should.equal('[{"key":"modulo","value":"facturacion"}]');
    param(replacements, 'p1').should.equal('[{"key":"cliente","value":"acme"}]');
  });

  it('el valor del par NUNCA se concatena al SQL', () => {
    const hostile = "'; DROP TABLE requirements;--";
    const { sql, replacements } = tagPlan({ key: 'modulo', value: hostile });

    sql.should.not.containEql('DROP');
    param(replacements, 'p0').should.containEql(hostile);
  });

  it('el mismo predicado se emite dentro de una rama de `or`', () => {
    const validated = validateList(SPEC, {
      filter: { or: [{ tag: { key: 'modulo', value: 'facturacion' } }, { state: 'activo' }] },
    }) as { value: ValidatedListQuery };
    const { sql } = buildRowsSql(SPEC, validated.value, INTERNAL);

    sql.should.containEql('t.tags @> CAST(:p0 AS jsonb)');
  });
});


/**
 * EL DESVÍO NUMÉRICO DE LA BÚSQUEDA LIBRE (S-024, Task 3).
 *
 * Viene de cómo se usa la pantalla: pegar un número de requisito en el buscador es el caso más
 * frecuente, y un `ILIKE '%8140%'` sobre `title`/`description` no encuentra el requisito 8140.
 */
describe('queries/engine/build-sql — la búsqueda con desvío numérico (S-024)', () => {
  const SPEC: ResourceSpec = {
    ...tasksSpec,
    filterable: {
      ...tasksSpec.filterable,
      q: { kind: 'string', search: ['title', 'description'], searchNumericColumn: 'id' },
    },
  };

  function searchPlan(spec: ResourceSpec, text: string): SqlPlan {
    const validated = validateList(spec, { filter: { q: text } }) as { value: ValidatedListQuery };
    return buildRowsSql(spec, validated.value, INTERNAL);
  }

  it('TS-67 · un texto de SOLO DÍGITOS emite igualdad sobre la columna declarada', () => {
    const { sql, replacements } = searchPlan(SPEC, '8140');

    sql.should.containEql('t.id = :p0');
    sql.should.not.containEql('ILIKE');
    // NÚMERO, no string: la columna es `INTEGER` y el parámetro tiene que llegar como tal.
    param(replacements, 'p0').should.equal(8140);
    (typeof param(replacements, 'p0')).should.equal('number');
  });

  it('TS-67 · un texto NO numérico sigue siendo el `ILIKE` de siempre', () => {
    const { sql, replacements } = searchPlan(SPEC, 'facturación');

    sql.should.containEql("t.title ILIKE '%' || :p0 || '%'");
    sql.should.containEql("t.description ILIKE '%' || :p0 || '%'");
    sql.should.not.containEql('t.id = :p0');
    param(replacements, 'p0').should.equal('facturación');
  });

  it('TS-32/TS-67 · con MÁS DE NUEVE DÍGITOS cae en el `ILIKE`, no en la rama numérica', () => {
    // La columna es `INTEGER` (int4): un texto de veinte dígitos por la rama numérica hace que
    // PostgreSQL falle con "value out of range" -> `internal_error`.
    const { sql, replacements } = searchPlan(SPEC, '99999999999999999999');

    sql.should.containEql('ILIKE');
    sql.should.not.containEql('t.id = :p0');
    param(replacements, 'p0').should.equal('99999999999999999999');
  });

  it('nueve dígitos SÍ entran en la rama numérica, diez NO', () => {
    searchPlan(SPEC, '999999999').sql.should.containEql('t.id = :p0');
    searchPlan(SPEC, '1000000000').sql.should.containEql('ILIKE');
  });

  it('una ficha SIN `searchNumericColumn` se comporta exactamente igual que antes', () => {
    // Regresión de `tasks`: su `q` no declara el desvío y tiene que seguir haciendo `ILIKE`.
    const { sql } = searchPlan(tasksSpec, '8140');

    sql.should.containEql('ILIKE');
    sql.should.not.containEql('t.id = :p0');
  });
});


/**
 * LAS TRES FORMAS DEL RECORTE DEL MODO EXTERNO (S-024, Task 4).
 *
 * `ExternalScopeSpec` dejó de tener una sola forma: `requirements` recorta como `tasks`,
 * `projects` recorta por su PROPIA `id` y sin columna de visibilidad, y `clients` no lleva el
 * proyecto en ninguna columna —su visibilidad es INDIRECTA— y se recorta con un `EXISTS`.
 *
 * La unión NO PUEDE tener una variante "sin recorte": el estado peligroso no es representable.
 */
describe('queries/engine/build-sql — las tres formas del recorte externo (S-024)', () => {
  const EXTERNAL = ctxWith('external', EXTERNAL_CALLER);
  const PERMITTED = '(SELECT project_id FROM user_project_permissions WHERE user_id = :caller)';

  /** Un recurso que lleva el proyecto en una columna y NO tiene visibilidad: `projects`. */
  const COLUMN_SPEC: ResourceSpec = {
    ...tasksSpec,
    externalScope: { kind: 'column', projectColumn: 'id' },
  };

  /** Un recurso cuya visibilidad es INDIRECTA: `clients`. */
  const EXISTS_SPEC: ResourceSpec = {
    ...tasksSpec,
    externalScope: {
      kind: 'exists',
      table: 'projects',
      foreignKey: 'client_id',
      localKey: 'id',
      projectColumn: 'id',
    },
  };

  function rowsFor(spec: ResourceSpec, ctx: QueryContext, payload: unknown = {}): SqlPlan {
    const validated = validateList(spec, payload) as { value: ValidatedListQuery };
    return buildRowsSql(spec, validated.value, ctx);
  }

  it('TS-63 · `kind: "column"` SIN visibilidad recorta igual, y no menciona visibilidad', () => {
    const { sql, replacements } = rowsFor(COLUMN_SPEC, EXTERNAL);
    const where = sql.slice(sql.indexOf('WHERE'), sql.indexOf('ORDER BY'));

    sql.should.containEql(`t.id IN ${PERMITTED}`);
    // La AUSENCIA de `visibility` significa "este recurso no tiene columna de visibilidad", NO
    // "no recortes": el predicado de proyectos permitidos se emite igual. Se mira el WHERE y no
    // el SQL entero porque la ficha de prueba es la de `tasks`, que SÍ proyecta esa columna.
    where.should.not.containEql('visibility_level');
    sql.should.not.containEql(':externalVisibility');
    param(replacements, 'caller').should.equal(EXTERNAL_CALLER);
    replacements.should.not.have.property('externalVisibility');
  });

  it('TS-64 · `kind: "exists"` emite el EXISTS con el alias fijo del motor', () => {
    const { sql, replacements } = rowsFor(EXISTS_SPEC, EXTERNAL);

    sql.should.containEql(
      `EXISTS (SELECT 1 FROM projects scope_ WHERE scope_.client_id = t.id AND scope_.id IN ${PERMITTED})`
    );
    // Un `IN` sobre una columna del propio recurso sería el error: el actor NO TIENE `project_id`.
    sql.should.not.containEql('t.client_id IN');
    param(replacements, 'caller').should.equal(EXTERNAL_CALLER);
  });

  it('las dos variantes se aplican en LOS TRES SQL: filas, COUNT y get', () => {
    for (const spec of [COLUMN_SPEC, EXISTS_SPEC]) {
      const rows = rowsFor(spec, EXTERNAL);
      const validatedList = validateList(spec, {}) as { value: ValidatedListQuery };
      const count = buildCountSql(spec, validatedList.value, EXTERNAL);
      const validatedGet = validateGet(spec, { id: 1 }) as { value: ValidatedGetQuery };
      const get = buildGetSql(spec, validatedGet.value, EXTERNAL);

      for (const { sql } of [rows, count, get]) {
        sql.should.containEql('user_project_permissions');
      }
    }
  });

  it('ninguna de las dos variantes emite recorte para `internal` ni `connector`', () => {
    for (const spec of [COLUMN_SPEC, EXISTS_SPEC]) {
      for (const callerClass of ['internal', 'connector'] as CallerClass[]) {
        rowsFor(spec, ctxWith(callerClass)).sql.should.not.containEql('user_project_permissions');
      }
    }
  });

  it('el recorte va PRIMERO en el WHERE y se une con AND al filtro del caller', () => {
    const { sql } = rowsFor(EXISTS_SPEC, EXTERNAL, { filter: { state: 'activo' } });
    const where = sql.slice(sql.indexOf('WHERE'), sql.indexOf('ORDER BY'));

    where.indexOf('EXISTS (SELECT 1 FROM projects').should.be.below(where.indexOf('t.state = :p0'));
  });
});

/**
 * EL PREDICADO FIJO DEL RECURSO Y EL CAMPO CONSTANTE (S-025, Task 2).
 *
 * `comments` es `objective_activity` CON `type_of_activity = 'comment'` y `activity` es esa misma
 * tabla SIN él: toda la diferencia entre los dos recursos es un campo de la ficha. Y `entityType`
 * no sale de ninguna columna: lo decide la variante y lo pega la proyección.
 */
describe('queries/engine/build-sql — el predicado fijo y el constante (S-025)', () => {
  const WITH_WHERE: ResourceSpec = { ...tasksSpec, where: "t.type_of_activity = 'comment'" };

  function all(spec: ResourceSpec, payload: unknown = {}, ctx: QueryContext = INTERNAL): SqlPlan[] {
    const validatedList = validateList(spec, payload) as { value: ValidatedListQuery };
    const validatedGet = validateGet(spec, { id: 1 }) as { value: ValidatedGetQuery };
    return [
      buildRowsSql(spec, validatedList.value, ctx),
      buildCountSql(spec, validatedList.value, ctx),
      buildGetSql(spec, validatedGet.value, ctx),
    ];
  }

  it('TS-88 · el predicado fijo llega a LOS TRES SQL: filas, COUNT y get', () => {
    for (const { sql } of all(WITH_WHERE)) {
      // Olvidarlo en el COUNT haría que el total incluya filas que la colección no devuelve, y
      // olvidarlo en el `get` haría que un `comments.get` resolviera una fila de `state`.
      sql.should.containEql("t.type_of_activity = 'comment'");
    }
  });

  it('TS-89 · una ficha SIN `where` no lo emite: la ausencia ES el contrato de `activity`', () => {
    for (const { sql } of all(tasksSpec)) {
      sql.should.not.containEql('type_of_activity');
    }
  });

  it('el predicado se une con AND al filtro del caller y no lo pisa', () => {
    const { sql } = all(WITH_WHERE, { filter: { state: 'activo' } })[0];
    const where = sql.slice(sql.indexOf('WHERE'), sql.indexOf('ORDER BY'));

    where.should.containEql("t.type_of_activity = 'comment'");
    where.should.containEql('t.state = :p0');
    where.should.containEql(' AND ');
  });

  it('TS-90 · el campo constante NO emite columna en el SELECT y sí valor en la proyección', () => {
    const spec: ResourceSpec = {
      ...tasksSpec,
      base: { ...tasksSpec.base, entityType: { constant: 'task' } },
      baseNames: [...tasksSpec.baseNames, 'entityType'],
      fieldNames: [...tasksSpec.fieldNames, 'entityType'],
    };
    const validated = validateGet(spec, { id: 1, fields: ['id', 'entityType'] }) as {
      value: ValidatedGetQuery;
    };
    const { sql } = buildGetSql(spec, validated.value, INTERNAL);

    // El literal NO VIAJA AL SQL: al SQL solo llegan NOMBRES de la ficha.
    sql.should.not.containEql('entityType');
    sql.should.not.containEql("'task'");
    sql.should.containEql('t.id AS "id"');
  });

  it('TS-91 · una relación de COLECCIÓN en el conjunto base no genera JOIN ni columna', () => {
    const spec: ResourceSpec = {
      ...tasksSpec,
      base: {
        ...tasksSpec.base,
        attachments: {
          kind: 'relation',
          cardinality: 'many',
          table: 'attachments',
          parentKey: 'entity_id',
          order: [{ expr: 'r.id', dir: 'ASC' }],
          fields: { id: 'r.id' },
        },
      },
      baseNames: [...tasksSpec.baseNames, 'attachments'],
      fieldNames: [...tasksSpec.fieldNames, 'attachments'],
    };
    const validated = validateList(spec, {}) as { value: ValidatedListQuery };

    // Entra en `relations` —se resuelve POR LOTE— y no en la consulta principal.
    [...validated.value.relations].should.containEql('attachments');
    const { sql } = buildRowsSql(spec, validated.value, INTERNAL);
    sql.should.not.containEql('JOIN attachments');
    sql.should.not.containEql('AS "attachments"');
  });

  it('una relación 1:1 declarada en `base` SÍ genera su JOIN, igual que en `includable`', () => {
    const spec: ResourceSpec = {
      ...tasksSpec,
      base: {
        ...tasksSpec.base,
        author: {
          kind: 'relation',
          cardinality: 'one',
          table: 'users',
          localKey: 'created_by',
          targetKey: 'id',
          optional: false,
          fields: { id: 'id', name: 'name' },
        },
      },
      baseNames: [...tasksSpec.baseNames, 'author'],
      fieldNames: [...tasksSpec.fieldNames, 'author'],
    };
    const validated = validateList(spec, {}) as { value: ValidatedListQuery };
    const { sql } = buildRowsSql(spec, validated.value, INTERNAL);

    sql.should.containEql('INNER JOIN users rel_author ON rel_author.id = t.created_by');
    sql.should.containEql('rel_author.name AS "author__name"');
  });
});

/**
 * LAS DOS FORMAS NUEVAS DEL RECORTE EXTERNO (S-025, Task 3).
 *
 * `comments` y `activity` no llevan el proyecto —lo lleva la entidad dueña— y tienen DOS
 * visibilidades en juego (H-8 del plan). `subscriptions` recorta por identidad y NADA MÁS.
 */
describe('queries/engine/build-sql — el recorte con visibilidades y el `owner` (S-025)', () => {
  const EXTERNAL = ctxWith('external', EXTERNAL_CALLER);
  const PERMITTED = '(SELECT project_id FROM user_project_permissions WHERE user_id = :caller)';

  /** El recorte de `comments`/`activity`: EXISTS sobre la entidad dueña, con las DOS visibilidades. */
  const OWNER_VISIBLE: ResourceSpec = {
    ...tasksSpec,
    externalScope: {
      kind: 'exists',
      table: 'objectives',
      foreignKey: 'id',
      localKey: 'objective_id',
      projectColumn: 'project_id',
      visibility: { column: 'visibility_level', value: 'public' },
      ownVisibility: { column: 'visibility_level', value: 'public' },
    },
  };

  /** El recorte de `subscriptions`: SOLO LAS PROPIAS. */
  const OWN: ResourceSpec = {
    ...tasksSpec,
    externalScope: { kind: 'owner', userColumn: 'user_id' },
  };

  function rowsFor(spec: ResourceSpec, ctx: QueryContext, payload: unknown = {}): SqlPlan {
    const validated = validateList(spec, payload) as { value: ValidatedListQuery };
    return buildRowsSql(spec, validated.value, ctx);
  }

  it('TS-92 · el EXISTS lleva la visibilidad de la entidad dueña Y la de la propia fila', () => {
    const { sql, replacements } = rowsFor(OWNER_VISIBLE, EXTERNAL);

    sql.should.containEql(
      'EXISTS (SELECT 1 FROM objectives scope_ WHERE scope_.id = t.objective_id' +
        ` AND scope_.project_id IN ${PERMITTED}` +
        ' AND scope_.visibility_level = :externalVisibility)'
    );
    // LA SEGUNDA MITAD, AFUERA DEL EXISTS: sin ella, un comentario interno sobre una tarea pública
    // se ve desde el portal de clientes (H-8).
    sql.should.containEql('t.visibility_level = :externalOwnVisibility');
    param(replacements, 'caller').should.equal(EXTERNAL_CALLER);
    param(replacements, 'externalVisibility').should.equal('public');
    param(replacements, 'externalOwnVisibility').should.equal('public');
  });

  it('TS-93 · el recorte `owner` es la identidad del caller y NADA MÁS', () => {
    const { sql, replacements } = rowsFor(OWN, EXTERNAL);

    sql.should.containEql('t.user_id = :caller');
    // SIN el predicado de proyectos permitidos, y no por olvido: con él, un caller externo
    // suscripto a algo de un proyecto que ya no ve dejaría de ver SU PROPIA suscripción.
    sql.should.not.containEql('user_project_permissions');
    param(replacements, 'caller').should.equal(EXTERNAL_CALLER);
  });

  it('TS-93 · con `internal` o `connector` el `owner` no emite nada', () => {
    for (const callerClass of ['internal', 'connector'] as CallerClass[]) {
      const { sql, replacements } = rowsFor(OWN, ctxWith(callerClass));
      sql.should.not.containEql('t.user_id = :caller');
      replacements.should.not.have.property('caller');
    }
  });

  it('el `owner` también aparece en el COUNT y en el `get`: el total sin recorte es una fuga', () => {
    const validatedList = validateList(OWN, {}) as { value: ValidatedListQuery };
    const validatedGet = validateGet(OWN, { id: 1 }) as { value: ValidatedGetQuery };

    buildCountSql(OWN, validatedList.value, EXTERNAL).sql.should.containEql('t.user_id = :caller');
    buildGetSql(OWN, validatedGet.value, EXTERNAL).sql.should.containEql('t.user_id = :caller');
  });

  it('un `exists` SIN las dos visibilidades produce el SQL de `clients` byte a byte (regresión)', () => {
    const CLIENTS_SHAPED: ResourceSpec = {
      ...tasksSpec,
      externalScope: {
        kind: 'exists',
        table: 'projects',
        foreignKey: 'client_id',
        localKey: 'id',
        projectColumn: 'id',
      },
    };
    const { sql, replacements } = rowsFor(CLIENTS_SHAPED, EXTERNAL);

    sql.should.containEql(
      `EXISTS (SELECT 1 FROM projects scope_ WHERE scope_.client_id = t.id AND scope_.id IN ${PERMITTED})`
    );
    replacements.should.not.have.property('externalVisibility');
    replacements.should.not.have.property('externalOwnVisibility');
  });

  it('los nombres del recorte NO colisionan con los del filtro', () => {
    const { replacements } = rowsFor(OWNER_VISIBLE, EXTERNAL, {
      filter: { state: ['backlog', 'activo'], projectId: 12 },
    });

    // El contador emite `p0`, `p1`, …; los del recorte pasan por `params.set()`, que no lo toca.
    Object.keys(replacements).sort().should.deepEqual([
      'caller',
      'externalOwnVisibility',
      'externalVisibility',
      'p0',
      'p1',
    ]);
  });
});

/**
 * S-026 · LAS DOS CAPACIDADES NUEVAS DEL MOTOR, sobre fichas de LABORATORIO.
 *
 * Las fichas son locales y no las de `worked-times` ni `users` A PROPÓSITO: lo que se verifica es
 * la CAPACIDAD GENÉRICA del motor, y acoplar estos tests a la ficha de un recurso haría que un
 * cambio del contrato de ese recurso rompiera tests que no hablan de él (mismo criterio que
 * `spec.test.ts`).
 */
describe('queries/engine/build-sql — el recorte SIN ACCESO y la cláusula propia (S-026)', () => {
  const EXTERNAL = ctxWith('external', EXTERNAL_CALLER);
  const PERMITTED = '(SELECT project_id FROM user_project_permissions WHERE user_id = :caller)';

  /** Ficha SIN ACCESO externo: el recorte que no es un predicado (Task 1). */
  const NONE_SPEC: ResourceSpec = {
    ...tasksSpec,
    externalScope: { kind: 'none' },
  };

  /** Ficha con la cláusula "más él mismo" del recorte alcanzable (Task 2). */
  const SELF_SPEC: ResourceSpec = {
    ...tasksSpec,
    externalScope: {
      kind: 'exists',
      table: 'user_project_permissions',
      foreignKey: 'user_id',
      localKey: 'id',
      projectColumn: 'project_id',
      orSelfColumn: 'id',
    },
  };

  /** La MISMA ficha sin la cláusula: la regresión de `clients` (TS-13). */
  const SELF_LESS_SPEC: ResourceSpec = {
    ...tasksSpec,
    externalScope: {
      kind: 'exists',
      table: 'user_project_permissions',
      foreignKey: 'user_id',
      localKey: 'id',
      projectColumn: 'project_id',
    },
  };

  function rowsFor(spec: ResourceSpec, ctx: QueryContext, payload: unknown = {}): SqlPlan {
    const validated = validateList(spec, payload) as { value: ValidatedListQuery };
    return buildRowsSql(spec, validated.value, ctx);
  }

  it('TS-1 · `kind: none` en clase externa emite `FALSE` como PRIMER predicado del WHERE', () => {
    const { sql } = rowsFor(NONE_SPEC, EXTERNAL);

    // DEFENSA EN PROFUNDIDAD, no el mecanismo: el mecanismo es el corte de `runList`, que no
    // llega hasta acá. Sin esta rama, un camino futuro que se saltee el corte PUBLICA LA TABLA.
    sql.should.match(/WHERE FALSE/);
    sql.should.not.containEql('user_project_permissions');
  });

  it('TS-1 · el `FALSE` va también en el COUNT y en el `get`: el total sin recorte es una fuga', () => {
    const validatedList = validateList(NONE_SPEC, {}) as { value: ValidatedListQuery };
    const validatedGet = validateGet(NONE_SPEC, { id: 1 }) as { value: ValidatedGetQuery };

    buildCountSql(NONE_SPEC, validatedList.value, EXTERNAL).sql.should.containEql('WHERE FALSE');
    buildGetSql(NONE_SPEC, validatedGet.value, EXTERNAL).sql.should.containEql('FALSE');
  });

  it('TS-1 · en clase interna y conector la ficha `none` no recorta nada', () => {
    for (const callerClass of ['internal', 'connector'] as CallerClass[]) {
      const { sql } = rowsFor(NONE_SPEC, ctxWith(callerClass));
      sql.should.not.containEql('FALSE');
    }
  });

  it('TS-12 · `orSelfColumn` emite el OR PARENTIZADO y el filtro queda FUERA del grupo', () => {
    const { sql, replacements } = rowsFor(SELF_SPEC, EXTERNAL, { filter: { state: 'activo' } });

    // `A OR B AND C` se lee `A OR (B AND C)`: sin los paréntesis el recorte DEJA DE RECORTAR.
    sql.should.containEql(
      `(EXISTS (SELECT 1 FROM user_project_permissions scope_ WHERE scope_.user_id = t.id ` +
        `AND scope_.project_id IN ${PERMITTED}) OR t.id = :caller)`
    );
    // Y el AND del filtro, FUERA del grupo.
    sql.should.containEql(') AND t.state = :p0');
    param(replacements, 'caller').should.equal(EXTERNAL_CALLER);
  });

  it('TS-12 · la cláusula propia también viaja en el COUNT y en el `get`', () => {
    const validatedList = validateList(SELF_SPEC, {}) as { value: ValidatedListQuery };
    const validatedGet = validateGet(SELF_SPEC, { id: 1 }) as { value: ValidatedGetQuery };

    buildCountSql(SELF_SPEC, validatedList.value, EXTERNAL).sql.should.containEql(
      'OR t.id = :caller)'
    );
    buildGetSql(SELF_SPEC, validatedGet.value, EXTERNAL).sql.should.containEql('OR t.id = :caller)');
  });

  it('TS-13 · SIN `orSelfColumn` el `exists` no cambia: ningún OR (regresión de `clients`)', () => {
    const { sql } = rowsFor(SELF_LESS_SPEC, EXTERNAL, { filter: { state: 'activo' } });

    sql.should.containEql(
      `EXISTS (SELECT 1 FROM user_project_permissions scope_ WHERE scope_.user_id = t.id ` +
        `AND scope_.project_id IN ${PERMITTED})`
    );
    sql.should.not.containEql(' OR t.id = :caller');
  });
});


/* =============================================================================================
 * S-027 · EL JOIN FIJO DE LA FICHA Y LAS DOS FORMAS NUEVAS DEL RECORTE
 *
 * TODO SOBRE FICHAS SINTÉTICAS y no sobre `attachments` ni `files`: lo que se verifica es la
 * CAPACIDAD GENÉRICA del motor, y `engine/` no conoce ningún recurso. Un test que usara la ficha
 * real congelaría la abstracción al revés.
 *
 * LOS TESTS SON DE FORMA, no de filas, y la división es deliberada: un test de forma atrapa el
 * PARÉNTESIS FALTANTE, que un test de filas sin filtro adicional NO atrapa —el resultado es el
 * mismo hasta que hay un filtro encima—.
 * =========================================================================================== */

/** `:p0`, `:p7`, … se normalizan a `:p` para poder afirmar sobre fragmentos completos. */
function normalize(sql: string): string {
  return sql.replace(/:p\d+/g, ':p');
}

const PERMITTED_SQL = '(SELECT project_id FROM user_project_permissions WHERE user_id = :caller)';

describe('queries/engine/build-sql — el JOIN fijo de la ficha (S-027, Task 2)', () => {
  const JOIN_BASE: Record<string, BaseSpec> = {
    id: { column: 'id' },
    fileId: { column: 'file_id' },
    // EL CAMPO APLANADO: sale de la tabla unida y se proyecta al MISMO NIVEL, no anidado.
    fileName: { column: 'file_name', from: 'f' },
    createdAt: { column: 'created_at' },
  };

  const JOIN_FILTERABLE: Record<string, FilterableSpec> = {
    fileId: { column: 'file_id', kind: 'integer' },
    // El filtro que NO vive en la tabla del recurso: la titularidad es del archivo (H-1).
    uploadedBy: { column: 'uploaded_by', from: 'f', kind: 'string' },
  };

  const SPEC_WITH_JOIN: ResourceSpec = {
    name: 'links',
    table: 'links',
    joins: [{ table: 'files', alias: 'f', on: 'f.id = t.file_id', kind: 'INNER' }],
    where: "t.deleted_at IS NULL AND f.retention_status = 'active'",
    base: JOIN_BASE,
    baseNames: Object.keys(JOIN_BASE),
    includable: {},
    includableNames: [],
    fieldNames: Object.keys(JOIN_BASE),
    filterable: JOIN_FILTERABLE,
    filterableNames: Object.keys(JOIN_FILTERABLE),
    sortable: { createdAt: { column: 'created_at' }, id: { column: 'id' } },
    sortableNames: ['createdAt', 'id'],
    defaults: { sort: ['createdAt'] },
    enums: {},
    truncatable: [],
    externalScope: { kind: 'column', projectColumn: 'project_id' },
  };

  const JOIN_SQL = 'INNER JOIN files f ON f.id = t.file_id';

  function rows(payload: unknown, ctx: QueryContext = INTERNAL): SqlPlan {
    const validated = validateList(SPEC_WITH_JOIN, payload) as { value: ValidatedListQuery };
    return buildRowsSql(SPEC_WITH_JOIN, validated.value, ctx);
  }

  it('TS-9 · el SQL de filas emite el JOIN declarado por la ficha', () => {
    rows({}).sql.should.containEql(JOIN_SQL);
  });

  it('TS-10 · un campo base con `from` se califica con el alias de la tabla unida', () => {
    const { sql } = rows({ fields: ['fileName'] });

    sql.should.containEql('f.file_name AS "fileName"');
    sql.should.not.containEql('t.file_name');
  });

  it('TS-11 · un campo base SIN `from` sigue saliendo de la tabla del recurso', () => {
    rows({ fields: ['fileId'] }).sql.should.containEql('t.file_id AS "fileId"');
  });

  it('TS-12 · EL COUNT EMITE EL MISMO JOIN (H-7): sin él, `count: true` no compila', () => {
    // `buildCountSql` arma sus joins desde `selectParts`, o sea SOLO los de las relaciones 1:1 del
    // conjunto devuelto. Con `count: 'only'` no hay ninguno, y `resource.where` NOMBRA EL ALIAS:
    // sin el JOIN fijo, PostgreSQL responde `missing FROM-clause entry for table "f"`. El default
    // es `count: false`, así que el bug no aparecería hasta que alguien pidiera el total.
    const validated = validateList(SPEC_WITH_JOIN, { count: 'only', fields: ['id'] }) as {
      value: ValidatedListQuery;
    };

    buildCountSql(SPEC_WITH_JOIN, validated.value, INTERNAL).sql.should.containEql(JOIN_SQL);
  });

  it('TS-13 · el `get` emite el mismo JOIN y el campo aplanado', () => {
    const validated = validateGet(SPEC_WITH_JOIN, { id: 1, fields: ['fileName'] }) as {
      value: ValidatedGetQuery;
    };
    const { sql } = buildGetSql(SPEC_WITH_JOIN, validated.value, INTERNAL);

    sql.should.containEql(JOIN_SQL);
    sql.should.containEql('f.file_name AS "fileName"');
  });

  it('TS-14 · un filtro con `from` se resuelve contra el alias, y el valor va en `replacements`', () => {
    const { sql, replacements } = rows({ filter: { uploadedBy: 'u-x' } });

    sql.should.containEql('f.uploaded_by = :p0');
    sql.should.not.containEql('t.uploaded_by');
    param(replacements, 'p0').should.equal('u-x');
  });

  it('TS-15 · `resource.where` puede nombrar el alias del JOIN, y va en LOS TRES SQL', () => {
    const expected = "t.deleted_at IS NULL AND f.retention_status = 'active'";
    const validatedList = validateList(SPEC_WITH_JOIN, {}) as { value: ValidatedListQuery };
    const validatedGet = validateGet(SPEC_WITH_JOIN, { id: 1 }) as { value: ValidatedGetQuery };

    rows({}).sql.should.containEql(expected);
    buildCountSql(SPEC_WITH_JOIN, validatedList.value, INTERNAL).sql.should.containEql(expected);
    buildGetSql(SPEC_WITH_JOIN, validatedGet.value, INTERNAL).sql.should.containEql(expected);
  });

  it('TS-16 · REGRESIÓN: una ficha SIN `joins` produce el SQL de siempre, carácter por carácter', () => {
    const validated = validateList(tasksSpec, {
      filter: { projectId: 12 },
      fields: ['id', 'title'],
      sort: ['-createdAt'],
    }) as { value: ValidatedListQuery };

    buildRowsSql(tasksSpec, validated.value, INTERNAL).sql.should.equal(
      'SELECT t.id AS "id", t.title AS "title", t.created_at AS "__k0", t.id AS "__k1"\n' +
        'FROM objectives t\n' +
        'WHERE t.project_id = :p0\n' +
        'ORDER BY t.created_at DESC, t.id DESC\n' +
        'LIMIT 51'
    );
  });

  it('TS-17 · el orden y el keyset siguen contra la tabla del recurso, nunca contra la unida', () => {
    // `SortableSpec` NO TIENE `from` a propósito: ordenar por una columna de la tabla unida haría
    // que el keyset dejara de usar el índice del recurso, que es lo único que lo hace barato.
    const { sql } = rows({ sort: ['-createdAt'] });

    sql.should.containEql('ORDER BY t.created_at DESC, t.id DESC');
    sql.should.not.containEql('ORDER BY f.');
  });
});

describe('queries/engine/build-sql — el recorte POLIMÓRFICO y el PUENTE (S-027, Task 3)', () => {
  const EXTERNAL = ctxWith('external', EXTERNAL_CALLER);

  /**
   * Las CINCO ramas, con las tres formas que el emisor tiene que cubrir:
   *   - `project`: SIN visibilidad y recortando por su PROPIA `id`.
   *   - `requirement` / `objective`: con visibilidad y con el proyecto en columna propia.
   *   - `*_comment`: CON SALTO al dueño y con LAS DOS visibilidades.
   */
  const BRANCHES: Readonly<Record<string, AttachmentOwner>> = {
    project: { table: 'projects', key: 'id', projectColumn: 'id' },
    requirement: {
      table: 'requirements',
      key: 'id',
      projectColumn: 'project_id',
      visibility: { column: 'visibility_level', value: 'public' },
    },
    requirement_comment: {
      table: 'requirement_activity',
      key: 'id',
      ownVisibility: { column: 'visibility_level', value: 'public' },
      owner: { table: 'requirements', foreignKey: 'requirement_id', key: 'id' },
      projectColumn: 'project_id',
      visibility: { column: 'visibility_level', value: 'public' },
    },
    objective: {
      table: 'objectives',
      key: 'id',
      projectColumn: 'project_id',
      visibility: { column: 'visibility_level', value: 'public' },
    },
    objective_comment: {
      table: 'objective_activity',
      key: 'id',
      ownVisibility: { column: 'visibility_level', value: 'public' },
      owner: { table: 'objectives', foreignKey: 'objective_id', key: 'id' },
      projectColumn: 'project_id',
      visibility: { column: 'visibility_level', value: 'public' },
    },
  };

  const POLY: PolymorphicExternalScope = {
    kind: 'polymorphic',
    typeColumn: 'entity_type',
    idColumn: 'entity_id',
    branches: BRANCHES,
  };

  const POLY_BASE: Record<string, BaseSpec> = {
    id: { column: 'id' },
    entityType: { column: 'entity_type' },
    entityId: { column: 'entity_id' },
    fileId: { column: 'file_id' },
  };

  const SPEC_POLY: ResourceSpec = {
    name: 'links',
    table: 'links',
    base: POLY_BASE,
    baseNames: Object.keys(POLY_BASE),
    includable: {},
    includableNames: [],
    fieldNames: Object.keys(POLY_BASE),
    filterable: { fileId: { column: 'file_id', kind: 'integer' } },
    filterableNames: ['fileId'],
    sortable: { id: { column: 'id' } },
    sortableNames: ['id'],
    defaults: { sort: ['id'] },
    enums: {},
    truncatable: [],
    externalScope: POLY,
  };

  const BRIDGE_BASE: Record<string, BaseSpec> = {
    id: { column: 'id' },
    uploadedBy: { column: 'uploaded_by' },
  };

  const SPEC_BRIDGE: ResourceSpec = {
    name: 'blobs',
    table: 'blobs',
    base: BRIDGE_BASE,
    baseNames: Object.keys(BRIDGE_BASE),
    includable: {},
    includableNames: [],
    fieldNames: Object.keys(BRIDGE_BASE),
    filterable: {},
    filterableNames: [],
    sortable: { id: { column: 'id' } },
    sortableNames: ['id'],
    defaults: { sort: ['id'] },
    enums: {},
    truncatable: [],
    externalScope: {
      kind: 'bridge',
      table: 'attachments',
      foreignKey: 'file_id',
      localKey: 'id',
      liveWhere: 'br_.deleted_at IS NULL',
      through: POLY,
      orOrphanColumn: 'uploaded_by',
    },
  };

  /** La MISMA ficha sin la rama huérfana: solo la (A), igual de parentizada. */
  const SPEC_BRIDGE_NO_ORPHAN: ResourceSpec = {
    ...SPEC_BRIDGE,
    externalScope: {
      kind: 'bridge',
      table: 'attachments',
      foreignKey: 'file_id',
      localKey: 'id',
      liveWhere: 'br_.deleted_at IS NULL',
      through: POLY,
    },
  };

  function rowsFor(spec: ResourceSpec, ctx: QueryContext, payload: unknown = {}): SqlPlan {
    const validated = validateList(spec, payload) as { value: ValidatedListQuery };
    return buildRowsSql(spec, validated.value, ctx);
  }

  function getFor(spec: ResourceSpec, ctx: QueryContext, payload: unknown = { id: 4 }): SqlPlan {
    const validated = validateGet(spec, payload) as { value: ValidatedGetQuery };
    return buildGetSql(spec, validated.value, ctx);
  }

  it('TS-18 · `polymorphic` emite UNA RAMA POR VALOR, en un grupo parentizado', () => {
    const { sql } = rowsFor(SPEC_POLY, EXTERNAL);

    // El grupo abre el WHERE y cada rama va parentizada adentro.
    normalize(sql).should.match(/^[\s\S]*WHERE \(\(t\.entity_type = :p AND EXISTS \(/);
    (sql.match(/t\.entity_type = :p\d+ AND EXISTS \(/g) || []).length.should.equal(5);
    // Cuatro uniones para cinco ramas: ninguna quedó fuera del grupo.
    (sql.match(/\) OR \(/g) || []).length.should.equal(4);
  });

  it('TS-19 · una rama SIN salto es un solo `EXISTS` sobre la tabla alcanzada', () => {
    const { sql } = rowsFor(SPEC_POLY, EXTERNAL);

    normalize(sql).should.containEql(
      'EXISTS (SELECT 1 FROM requirements scope_ WHERE scope_.id = t.entity_id' +
        ` AND scope_.project_id IN ${PERMITTED_SQL}` +
        ' AND scope_.visibility_level = :p)'
    );
  });

  it('TS-20 · la rama de `project` NO emite visibilidad y recorta por su PROPIA `id`', () => {
    const { sql } = rowsFor(SPEC_POLY, EXTERNAL);

    // La ausencia es del ESQUEMA —`projects` no tiene `visibility_level`— y no un olvido. La forma
    // uniforme la absorbe: el día que la gane, se agrega al mapa y el emisor no cambia.
    normalize(sql).should.containEql(
      'EXISTS (SELECT 1 FROM projects scope_ WHERE scope_.id = t.entity_id' +
        ` AND scope_.id IN ${PERMITTED_SQL})`
    );
  });

  it('TS-21 · una rama CON salto emite el JOIN al dueño y LAS DOS visibilidades', () => {
    const { sql } = rowsFor(SPEC_POLY, EXTERNAL);

    // Sin `ownVisibility`, un comentario INTERNO sobre una tarea PÚBLICA se ve desde el portal de
    // clientes: el default de `objective_activity.visibility_level` es `internal`.
    normalize(sql).should.containEql(
      'EXISTS (SELECT 1 FROM objective_activity scope_' +
        ' JOIN objectives scope_owner_ ON scope_owner_.id = scope_.objective_id' +
        ' WHERE scope_.id = t.entity_id' +
        ' AND scope_.visibility_level = :p' +
        ` AND scope_owner_.project_id IN ${PERMITTED_SQL}` +
        ' AND scope_owner_.visibility_level = :p)'
    );
  });

  it('TS-22 · EL RECORTE POLIMÓRFICO VA PARENTIZADO: el `OR` no se come el filtro', () => {
    const { sql } = rowsFor(SPEC_POLY, EXTERNAL, { filter: { fileId: 4 } });

    // `A OR B AND C` se lee `A OR (B AND C)` y EL RECORTE DEJA DE RECORTAR. No se nota sin filtro
    // adicional —que es el caso que uno prueba primero— y ahí un externo recibe filas ajenas.
    sql.should.containEql(') AND t.file_id = :p0');
    normalize(sql).should.match(/WHERE \(\(t\.entity_type/);
  });

  it('TS-23 · `bridge` emite las DOS ramas, con la negativa ACOTADA por `NOT EXISTS`', () => {
    const { sql } = getFor(SPEC_BRIDGE, EXTERNAL);
    const live = 'SELECT 1 FROM attachments br_ WHERE br_.file_id = t.id AND br_.deleted_at IS NULL';

    // (A) alguna fila puente VIVA cuya entidad es visible.
    normalize(sql).should.containEql(`EXISTS (${live} AND ((br_.entity_type = :p AND EXISTS (`);
    // (B) NINGUNA fila puente viva Y la fila es del caller. NO es `orSelfColumn`, que entra
    // SIEMPRE: con esa semántica un archivo con vínculo vivo a una entidad ajena se le filtraría
    // a quien lo subió (CA-12).
    sql.should.containEql(`OR (NOT EXISTS (${live}) AND t.uploaded_by = :caller)`);
  });

  it('TS-23 · la condición de "viva" es LA MISMA en las dos subconsultas', () => {
    const { sql } = getFor(SPEC_BRIDGE, EXTERNAL);

    // Si difirieran, existiría una fila que no pasa la (A) y tampoco la (B).
    (sql.match(/br_\.file_id = t\.id AND br_\.deleted_at IS NULL/g) || []).length.should.equal(2);
  });

  it('TS-24 · EL `bridge` COMPLETO VA PARENTIZADO, y el predicado del recurso queda fuera', () => {
    const spec: ResourceSpec = { ...SPEC_BRIDGE, where: "t.retention_status = 'active'" };
    const { sql } = getFor(spec, EXTERNAL);

    normalize(sql).should.match(/WHERE \(EXISTS \(/);
    sql.should.containEql(") AND t.retention_status = 'active' AND t.id = :p0");
  });

  it('TS-24 · sin `orOrphanColumn`, `bridge` emite SOLO la rama (A), igual de parentizada', () => {
    const { sql } = getFor(SPEC_BRIDGE_NO_ORPHAN, EXTERNAL);

    sql.should.not.containEql('NOT EXISTS');
    sql.should.not.containEql('t.uploaded_by = :caller');
    normalize(sql).should.match(/WHERE \(EXISTS \(/);
  });

  it('TS-25 · el emisor polimórfico se REUSA: el mismo predicado, con otro alias', () => {
    // UN SOLO LUGAR decide qué entidad es visible (CA-17). Con dos copias, agregar un sexto tipo
    // arreglaría un recurso y dejaría el otro roto, sin ningún síntoma.
    const poly = normalize(rowsFor(SPEC_POLY, EXTERNAL).sql);
    const bridge = normalize(getFor(SPEC_BRIDGE, EXTERNAL).sql);

    const fragment = poly.slice(poly.indexOf('((t.entity_type'), poly.indexOf('\nORDER BY'));
    bridge.should.containEql(fragment.replace(/\bt\.entity_type/g, 'br_.entity_type')
      .replace(/= t\.entity_id/g, '= br_.entity_id'));
  });

  it('TS-26 · caller INTERNO: ninguna de las dos formas emite una línea', () => {
    for (const spec of [SPEC_POLY, SPEC_BRIDGE]) {
      const { sql, replacements } = rowsFor(spec, ctxWith('internal'));

      sql.should.not.containEql('user_project_permissions');
      sql.should.not.containEql(':caller');
      replacements.should.not.have.property('caller');
    }
  });

  it('TS-27 · caller CONECTOR: ídem', () => {
    for (const spec of [SPEC_POLY, SPEC_BRIDGE]) {
      const { sql } = rowsFor(spec, ctxWith('connector'));

      sql.should.not.containEql('user_project_permissions');
      sql.should.not.containEql(':caller');
    }
  });

  it('TS-28 · los valores de tipo y de visibilidad viajan en `replacements`, no concatenados', () => {
    const { sql, replacements } = rowsFor(SPEC_POLY, EXTERNAL);

    // Ni los cinco tipos ni el `'public'` aparecen como literal en el SQL.
    sql.should.not.containEql("'public'");
    for (const type of Object.keys(BRANCHES)) {
      sql.should.not.containEql(`'${type}'`);
      Object.values(replacements).should.containEql(type);
    }
    // Seis visibilidades emitidas: dos propias (los comentarios) y cuatro de la tabla portadora.
    Object.values(replacements).filter((value) => value === 'public').length.should.equal(6);
    // Y por el CONTADOR del builder, así que ninguna rama pisa a la otra ni al filtro.
    Object.keys(replacements)
      .filter((name) => name !== 'caller')
      .forEach((name) => name.should.match(/^p\d+$/));
  });

  it('las dos formas nuevas van también en el COUNT: un total sin recorte es una fuga', () => {
    // Test EXTRA, no un TS del plan: el TS-29 (`deniesAllRows` sigue `false` para las dos) vive en
    // `spec.test.ts`. Este cubre la otra mitad de la propiedad — sin el recorte, el COUNT
    // devolvería el total REAL y filtraría exactamente la información que el recorte esconde.
    const validated = validateList(SPEC_POLY, {}) as { value: ValidatedListQuery };

    buildCountSql(SPEC_POLY, validated.value, EXTERNAL).sql.should.containEql(
      'FROM user_project_permissions WHERE user_id = :caller'
    );
  });
});
