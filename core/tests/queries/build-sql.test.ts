import 'mocha';
import 'should';
import { tasksSpec } from '../../src/queries/tasks/tasks-spec';
import { buildCountSql, buildGetSql, buildRowsSql } from '../../src/queries/engine/build-sql';
import { validateGet, validateList } from '../../src/queries/engine/validate-query';
import { SqlPlan, ValidatedGetQuery, ValidatedListQuery } from '../../src/queries/engine/types';

/**
 * El SQL generado, leído como texto.
 *
 * Se lee el SQL y no solo el resultado a propósito (CA-29): un test que solo mire las filas
 * pasaría igual con una implementación que concatene valores del payload, que es exactamente el
 * bug que este motor no puede tener. Acá se verifica la propiedad estructural: los NOMBRES salen
 * de la ficha y los VALORES nunca aparecen en el string.
 */

function plan(payload: unknown, keys?: unknown[]): SqlPlan {
  const validated = validateList(tasksSpec, payload) as { value: ValidatedListQuery };
  return buildRowsSql(tasksSpec, validated.value, keys);
}

/** Un `replacements` es `Record<string, unknown>`: este helper le pone tipo a la aserción. */
function param(replacements: Record<string, unknown>, name: string): any {
  return replacements[name];
}

function countPlan(payload: unknown): SqlPlan {
  const validated = validateList(tasksSpec, payload) as { value: ValidatedListQuery };
  return buildCountSql(tasksSpec, validated.value);
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
    const validated = validateGet(tasksSpec, { id: 8140, include: ['project'] }) as {
      value: ValidatedGetQuery;
    };

    const { sql, replacements } = buildGetSql(tasksSpec, validated.value);

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
