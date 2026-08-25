import 'mocha';
import 'should';
import { Reply } from '@jiku/nats-protocol';
import { tasksSpec } from '../../src/queries/tasks/tasks-spec';
import { validateGet, validateList } from '../../src/queries/engine/validate-query';
import { ValidatedGetQuery, ValidatedListQuery } from '../../src/queries/engine/types';
import { ResourceSpec } from '../../src/queries/types';

/**
 * El validador de la gramática CONTRA LA FICHA.
 *
 * Lo que se verifica acá no es "rechaza lo inválido": es que NUNCA IGNORA EN SILENCIO. Un filtro
 * ignorado devuelve datos de más, que es el peor modo de falla de un contrato de lectura, y es
 * también la mitad estructural de la mitigación de inyección (CA-29): un nombre que no está en la
 * ficha no llega al SQL porque muere acá.
 */

function ok(result: unknown): ValidatedListQuery {
  ('value' in (result as object)).should.be.true(JSON.stringify(result));
  return (result as { value: ValidatedListQuery }).value;
}

function bad(result: unknown): Reply<never> {
  ('error' in (result as object)).should.be.true(JSON.stringify(result));
  return (result as { error: Reply<never> }).error;
}

const list = (payload: unknown) => validateList(tasksSpec, payload);
const get = (payload: unknown) => validateGet(tasksSpec, payload);

describe('queries/engine/validate-query — nombres (CA-22)', () => {
  it('TS-41 · un nombre inventado en `filter` NO se ignora', () => {
    const error = bad(list({ filter: { nombreInventado: 1 } }));

    error.errorCode!.should.equal('invalid_fields');
    error.errorDetails!.field!.should.equal('filter');
    error.errorDetails!.value!.should.equal('nombreInventado');
    (error.errorDetails!.allowed as string[]).should.containEql('projectId');
    (error.errorDetails!.allowed as string[]).should.containEql('state');
    (error.errorDetails!.allowed as string[]).should.containEql('q');
    (error.errorDetails!.allowed as string[]).should.not.containEql('nombreInventado');
  });

  it('TS-42 · un nombre inventado en `sort`', () => {
    const error = bad(list({ sort: ['nombreInventado'] }));

    error.errorCode!.should.equal('invalid_fields');
    error.errorDetails!.field!.should.equal('sort');
    error.errorDetails!.value!.should.equal('nombreInventado');
  });

  it('TS-43 · un nombre inventado en `fields`', () => {
    const error = bad(list({ fields: ['id', 'nombreInventado'] }));

    error.errorCode!.should.equal('invalid_fields');
    error.errorDetails!.field!.should.equal('fields');
    error.errorDetails!.value!.should.equal('nombreInventado');
  });

  it('TS-44 · un nombre inventado en `include`, con el `allowed` exacto', () => {
    const error = bad(list({ include: ['nombreInventado'] }));

    error.errorCode!.should.equal('invalid_fields');
    error.errorDetails!.field!.should.equal('include');
    error.errorDetails!.value!.should.equal('nombreInventado');
    (error.errorDetails!.allowed as string[]).should.deepEqual([
      'description',
      'project',
      'requirement',
      'responsiblePersons',
      'comments',
      'subscriptors',
    ]);
  });

  it('TS-13 · `estimatedFinishDate` es filtrable pero NO ordenable', () => {
    const error = bad(list({ sort: ['estimatedFinishDate'] }));

    error.errorCode!.should.equal('invalid_fields');
    error.errorDetails!.should.deepEqual({
      field: 'sort',
      value: 'estimatedFinishDate',
      allowed: ['title', 'state', 'priority', 'finishedAt', 'createdAt', 'updatedAt'],
    });

    // Y el MISMO nombre en `filter` pasa: las dos listas son independientes.
    ok(list({ filter: { estimatedFinishDate: '2026-08-01' } }));
  });

  it('CA-2 · el `allowed` es LA MISMA lista de la ficha, no una copia', () => {
    // Identidad, no igualdad: es lo que hace que `meta.describe` (S-028) no pueda desincronizarse,
    // porque no hay una segunda copia que mantener.
    const sortError = bad(list({ sort: ['inventado'] }));
    ((sortError.errorDetails!.allowed as unknown) === (tasksSpec.sortableNames as unknown))
      .should.be.true();

    const filterError = bad(list({ filter: { inventado: 1 } }));
    ((filterError.errorDetails!.allowed as unknown) === (tasksSpec.filterableNames as unknown))
      .should.be.true();

    const includeError = bad(list({ include: ['inventado'] }));
    ((includeError.errorDetails!.allowed as unknown) === (tasksSpec.includableNames as unknown))
      .should.be.true();
  });

  it('ningún mensaje de error lleva el subject, columnas de la base ni SQL', () => {
    for (const payload of [
      { filter: { inventado: 1 } },
      { sort: ['inventado'] },
      { page: { limit: -1 } },
      { count: 'quizas' },
    ]) {
      const error = bad(list(payload));
      const message = error.errorMessage!;
      message.should.not.containEql('jiku-queries');
      message.should.not.containEql('objectives');
      message.should.not.containEql('SELECT');
      message.should.not.containEql('created_at');
    }
  });
});

describe('queries/engine/validate-query — los seis operadores (CA-3)', () => {
  it('escalar es igualdad, lista es IN, null es IS NULL', () => {
    ok(list({ filter: { state: 'activo' } })).filter.conditions[0].operator.should.deepEqual({
      op: 'eq',
      values: ['activo'],
    });
    ok(list({ filter: { state: ['backlog', 'activo'] } })).filter.conditions[0].operator
      .should.deepEqual({ op: 'eq', values: ['backlog', 'activo'] });
    ok(list({ filter: { requirementId: null } })).filter.conditions[0].operator
      .should.deepEqual({ op: 'isNull' });
  });

  it('`{not}` es distinto y `{gte, lte}` es un rango COMBINABLE', () => {
    ok(list({ filter: { state: { not: 'cancelado' } } })).filter.conditions[0].operator
      .should.deepEqual({ op: 'not', values: ['cancelado'] });

    const range = ok(list({ filter: { createdAt: { gt: '2026-08-01', lt: '2026-08-10' } } }));
    range.filter.conditions[0].operator.should.deepEqual({
      op: 'range',
      bounds: { gt: '2026-08-01', lt: '2026-08-10' },
    });
  });

  it('`q` es búsqueda y solo acepta texto', () => {
    ok(list({ filter: { q: 'motor' } })).filter.conditions[0].operator.should.deepEqual({
      op: 'search',
      text: 'motor',
    });
    bad(list({ filter: { q: 5 } })).errorDetails!.field!.should.equal('filter.q');
  });

  it('una clave de operador desconocida es invalid_fields, no se ignora', () => {
    const error = bad(list({ filter: { createdAt: { like: 'x' } } }));

    error.errorCode!.should.equal('invalid_fields');
    error.errorDetails!.field!.should.equal('filter.createdAt');
    error.errorDetails!.value!.should.equal('like');
    (error.errorDetails!.allowed as string[]).should.containEql('not');
    (error.errorDetails!.allowed as string[]).should.containEql('gte');
  });

  it('`not` no se combina con un rango: no hay una lectura obvia y no se adivina', () => {
    bad(list({ filter: { createdAt: { not: '2026-08-01', gte: '2026-01-01' } } }))
      .errorCode!.should.equal('invalid_fields');
  });

  it('un valor fuera del enum se rechaza, con los valores aceptados', () => {
    const error = bad(list({ filter: { state: 'inventado' } }));

    error.errorDetails!.field!.should.equal('filter.state');
    (error.errorDetails!.allowed as string[]).should.containEql('backlog');
  });

  it('CA-21 · filtrar por `priority` con nombre expande a los enteros que se leen así', () => {
    // `urgente` matchea el 4 Y el 5: el filtro no puede mentir respecto de lo que se proyecta.
    ok(list({ filter: { priority: 'urgente' } })).filter.conditions[0].operator
      .should.deepEqual({ op: 'eq', values: [4, 5] });
    // `priorityValue` va con el entero crudo, sobre la MISMA columna.
    ok(list({ filter: { priorityValue: 5 } })).filter.conditions[0].operator
      .should.deepEqual({ op: 'eq', values: [5] });
  });

  it('un entero que no lo es se rechaza', () => {
    bad(list({ filter: { projectId: 'doce' } })).errorDetails!.field!.should.equal(
      'filter.projectId'
    );
  });
});

describe('queries/engine/validate-query — `filter.or` de UN nivel (CA-4)', () => {
  it('un `or` de primer nivel se parsea como grupos', () => {
    const value = ok(
      list({
        filter: {
          responsiblePersonId: 77,
          or: [{ state: 'activo' }, { state: 'finalizado', finishedAt: { gt: '2026-08-16' } }],
        },
      })
    );

    value.filter.conditions.length.should.equal(1);
    value.filter.or!.length.should.equal(2);
    value.filter.or![1].conditions.length.should.equal(2);
  });

  it('TS-10 · un `or` DENTRO de otro `or` se rechaza', () => {
    const error = bad(list({ filter: { or: [{ state: 'activo' }, { or: [{ state: 'backlog' }] }] } }));

    error.errorCode!.should.equal('invalid_fields');
    error.errorDetails!.field!.should.equal('filter.or');
  });

  it('un `or` que no es una lista de objetos se rechaza', () => {
    bad(list({ filter: { or: 'activo' } })).errorDetails!.field!.should.equal('filter.or');
    bad(list({ filter: { or: ['activo'] } })).errorDetails!.field!.should.equal('filter.or');
  });
});

describe('queries/engine/validate-query — orden (CA-5, CA-6)', () => {
  it('TS-11 · sin `sort` se usa el default de la ficha, con `id` de desempate', () => {
    const value = ok(list({}));

    value.sort.should.deepEqual([
      { field: 'createdAt', column: 'created_at', dir: 'DESC', nullable: false },
      { field: 'id', column: 'id', dir: 'DESC', nullable: false },
    ]);
  });

  it('TS-12 · `sort` explícito respeta orden y dirección, y `id` va al final', () => {
    const value = ok(list({ sort: ['-priority', 'title'] }));

    value.sort.should.deepEqual([
      { field: 'priority', column: 'priority', dir: 'DESC', nullable: false },
      { field: 'title', column: 'title', dir: 'ASC', nullable: false },
      // La dirección del desempate es la del ÚLTIMO criterio: un `id ASC` detrás de un
      // `created_at DESC` no usa el índice compuesto.
      { field: 'id', column: 'id', dir: 'ASC', nullable: false },
    ]);
  });

  it('la nulabilidad del criterio SALE DE LA FICHA, no se adivina', () => {
    // Es lo que decide si el keyset puede usar la comparación de tuplas o necesita la rama
    // consciente de los NULL. `finishedAt` es la única columna ordenable NULL-able de `tasks`.
    ok(list({ sort: ['-finishedAt'] })).sort[0].nullable.should.be.true();
    ok(list({ sort: ['title'] })).sort[0].nullable.should.be.false();
  });

  it('el desempate hereda la dirección del último criterio', () => {
    ok(list({ sort: ['title', '-createdAt'] })).sort[2].dir.should.equal('DESC');
  });

  it('un campo repetido en `sort` se rechaza: rompería el keyset', () => {
    bad(list({ sort: ['title', '-title'] })).errorDetails!.field!.should.equal('sort');
  });
});

describe('queries/engine/validate-query — `page.limit` (CA-16)', () => {
  it('TS-23 · ausente usa el default 50', () => {
    ok(list({})).limit.should.equal(50);
  });

  it('TS-24 · `0` significa "usá el default"', () => {
    ok(list({ page: { limit: 0 } })).limit.should.equal(50);
  });

  it('TS-25 · `500` se recorta a 200 SIN AVISAR: es success, no un failure', () => {
    ok(list({ page: { limit: 500 } })).limit.should.equal(200);
  });

  it('TS-26 · negativo se rechaza', () => {
    const error = bad(list({ page: { limit: -1 } }));

    error.errorCode!.should.equal('invalid_fields');
    error.errorDetails!.field!.should.equal('page.limit');
    error.errorDetails!.value!.should.equal(-1);
  });

  it('TS-27 · no entero se rechaza', () => {
    const error = bad(list({ page: { limit: 10.5 } }));

    error.errorCode!.should.equal('invalid_fields');
    error.errorDetails!.field!.should.equal('page.limit');
  });

  it('una clave inventada dentro de `page` se rechaza', () => {
    bad(list({ page: { offset: 10 } })).errorDetails!.field!.should.equal('page');
  });

  it('`cursor: null` es "primera página", no un cursor inválido', () => {
    (ok(list({ page: { limit: 10, cursor: null } })).cursor === undefined).should.be.true();
  });
});

describe('queries/engine/validate-query — conjunto devuelto (CA-9)', () => {
  it('sin `fields` ni `include`, el conjunto es la base', () => {
    ok(list({})).fields.should.deepEqual(tasksSpec.baseNames);
  });

  it('TS-15 · `( fields ?? base ) ∪ include ∪ { id }`, con `id` SIEMPRE', () => {
    const value = ok(list({ fields: ['title', 'project'], include: ['description'] }));

    [...value.fields].sort().should.deepEqual(['description', 'id', 'project', 'title']);
    // `id` aparece aunque no se lo pidió.
    value.fields.should.containEql('id');
    value.relations.should.deepEqual(['project']);
  });

  it('`fields` puede nombrar una relación, e `include` no la duplica', () => {
    const value = ok(list({ fields: ['id', 'project'], include: ['project'] }));

    value.fields.should.deepEqual(['id', 'project']);
    value.relations.should.deepEqual(['project']);
  });
});

describe('queries/engine/validate-query — `count` (CA-19)', () => {
  it('acepta ausente, false, true y "only"', () => {
    ok(list({})).count.should.equal(false);
    ok(list({ count: false })).count.should.equal(false);
    ok(list({ count: true })).count.should.equal(true);
    ok(list({ count: 'only' })).count.should.equal('only');
  });

  it('cualquier otro valor es invalid_fields', () => {
    for (const value of ['si', 1, {}, 'ONLY']) {
      const error = bad(list({ count: value }));
      error.errorCode!.should.equal('invalid_fields');
      error.errorDetails!.field!.should.equal('count');
    }
  });
});

describe('queries/engine/validate-query — identidad y forma (CA-23, CA-24)', () => {
  it('TS-45 · un campo de identidad en el payload se rechaza, en `list` y en `get`', () => {
    const onList = bad(list({ userId: 'u-creator', filter: { projectId: 12 } }));
    onList.errorCode!.should.equal('invalid_fields');
    onList.errorDetails!.value!.should.equal('userId');

    const onGet = bad(get({ id: 8140, caller: 'u-creator' }));
    onGet.errorCode!.should.equal('invalid_fields');
    onGet.errorDetails!.value!.should.equal('caller');
  });

  it('la identidad tampoco se acepta DENTRO del filtro', () => {
    bad(list({ filter: { sub: 'u-creator' } })).errorDetails!.value!.should.equal('sub');
  });

  it('una clave de primer nivel inventada se rechaza con la lista de palancas', () => {
    const error = bad(list({ inventado: 1 }));

    error.errorDetails!.value!.should.equal('inventado');
    (error.errorDetails!.allowed as string[]).should.deepEqual([
      'filter',
      'sort',
      'page',
      'fields',
      'include',
      'count',
    ]);
  });

  it('TS-46 · un `get` sin `id` se rechaza', () => {
    const error = bad(get({}));

    error.errorCode!.should.equal('invalid_fields');
    error.errorDetails!.field!.should.equal('id');
  });

  it('TS-47 · un `get` con las palancas de `list` se rechaza, nombrando la ofensora', () => {
    const cases: [string, unknown][] = [
      ['filter', { id: 8140, filter: { state: 'activo' } }],
      ['sort', { id: 8140, sort: ['title'] }],
      ['page', { id: 8140, page: { limit: 10 } }],
      ['count', { id: 8140, count: true }],
    ];

    for (const [lever, payload] of cases) {
      const error = bad(get(payload));
      error.errorCode!.should.equal('invalid_fields', lever);
      error.errorDetails!.value!.should.equal(lever);
    }
  });

  it('un `get` acepta `fields` e `include`, con la misma fórmula', () => {
    const value = (get({ id: 8140, fields: ['title'], include: ['project'] }) as {
      value: ValidatedGetQuery;
    }).value;

    [...value.fields].sort().should.deepEqual(['id', 'project', 'title']);
    value.id.should.equal(8140);
  });

  it('un payload que no es objeto se rechaza sin lanzar', () => {
    bad(list('hola')).errorCode!.should.equal('invalid_fields');
    bad(list([1, 2])).errorCode!.should.equal('invalid_fields');
  });

  it('cuerpo vacío (`{}`, null, undefined) es una consulta legítima', () => {
    ok(list({})).limit.should.equal(50);
    ok(list(null)).limit.should.equal(50);
    ok(list(undefined)).limit.should.equal(50);
  });
});

describe('queries/engine/validate-query — el hash del cursor', () => {
  it('el `scope` lleva el filtro CRUDO y los tokens EFECTIVOS del orden', () => {
    const value = ok(list({ filter: { projectId: 12 }, sort: ['-priority'] }));

    (value.scope.filter as object).should.deepEqual({ projectId: 12 });
    // Con el desempate por `id` incluido: dos requests con el mismo ORDER BY comparten cursor.
    [...value.scope.sort].should.deepEqual(['-priority', '-id']);
  });

  it('sin `sort`, el scope es el del default resuelto', () => {
    [...ok(list({})).scope.sort].should.deepEqual(['-createdAt', '-id']);
    [...ok(list({ sort: ['-createdAt'] })).scope.sort].should.deepEqual(['-createdAt', '-id']);
  });
});

/**
 * EL CAMPO CALCULADO EN LA PROYECCIÓN (S-024, Task 1).
 *
 * Lo que se verifica es una AUSENCIA: un calculado NO entra en `relations`, así que
 * `attachCollections()` lo ignora. Se cumple solo con la condición actual `kind === 'relation'`,
 * y por eso hay test: una capacidad que funciona "porque el código de al lado casualmente la
 * excluye" se rompe la primera vez que alguien toca ese código.
 */
describe('queries/engine/validate-query — el campo calculado (S-024)', () => {
  const SPEC: ResourceSpec = {
    ...tasksSpec,
    includable: {
      ...tasksSpec.includable,
      totalMinutes: { kind: 'computed', expr: 'SELECT 1', transform: (raw) => Number(raw) },
    },
    includableNames: [...tasksSpec.includableNames, 'totalMinutes'],
    fieldNames: [...tasksSpec.fieldNames, 'totalMinutes'],
  };

  it('un calculado entra en `fields` y NO en `relations`', () => {
    const value = (validateList(SPEC, { include: ['totalMinutes', 'comments'] }) as {
      value: ValidatedListQuery;
    }).value;

    value.fields.should.containEql('totalMinutes');
    // Solo `comments` es relación: el calculado no se resuelve por lote.
    [...value.relations].should.deepEqual(['comments']);
  });

  it('un calculado se puede pedir por `fields` como cualquier otro campo', () => {
    const value = (validateGet(SPEC, { id: 88, fields: ['totalMinutes'] }) as {
      value: ValidatedGetQuery;
    }).value;

    [...value.fields].should.deepEqual(['id', 'totalMinutes']);
    [...value.relations].should.deepEqual([]);
  });
});

/**
 * EL FILTRO DE CONTENCIÓN `jsonb` CON FORMA PROPIA (S-024, Task 2).
 *
 * El filtro `tag` recibe `{"key": "modulo", "value": "facturacion"}` —un OBJETO—, y sin esta rama
 * `parseCondition` lo leería como un mapa de OPERADORES y respondería *no conoce el operador
 * "key"*. La forma del par la declara la ficha, no el motor.
 */
describe('queries/engine/validate-query — el filtro de contención (S-024)', () => {
  const SHAPE = ['key', 'value'];
  const SPEC: ResourceSpec = {
    ...tasksSpec,
    filterable: {
      ...tasksSpec.filterable,
      tag: { contains: { column: 'tags', shape: SHAPE } },
    },
    filterableNames: [...tasksSpec.filterableNames, 'tag'],
  };

  const contains = (raw: unknown) => validateList(SPEC, { filter: { tag: raw } });

  it('un par acepta y normaliza en el ORDEN DE `shape`', () => {
    // Las claves vienen al revés a propósito: el valor del parámetro es un STRING, así que dos
    // requests con el mismo par y las claves en otro orden tienen que producir el mismo texto.
    const value = ok(contains({ value: 'facturacion', key: 'modulo' }));
    const condition = value.filter.conditions[0];

    condition.field.should.equal('tag');
    condition.operator.op.should.equal('contains');
    (condition.operator as { values: readonly unknown[] }).values.should.deepEqual([
      { key: 'modulo', value: 'facturacion' },
    ]);
  });

  it('una LISTA de pares acepta y conserva el orden', () => {
    const value = ok(
      contains([
        { key: 'modulo', value: 'facturacion' },
        { key: 'cliente', value: 'acme' },
      ])
    );

    (value.filter.conditions[0].operator as { values: readonly unknown[] }).values.should.deepEqual([
      { key: 'modulo', value: 'facturacion' },
      { key: 'cliente', value: 'acme' },
    ]);
  });

  it('TS-28 · un string, un par incompleto y un par con clave de más son `invalid_fields`', () => {
    for (const hostile of ['facturacion', { key: 'modulo' }, { key: 'm', value: 'f', extra: 1 }]) {
      const error = bad(contains(hostile));

      error.errorCode!.should.equal('invalid_fields');
      error.errorDetails!.field!.should.equal('filter.tag');
      (error.errorDetails!.allowed as string[]).should.deepEqual(SHAPE);
    }
  });

  it('TS-28 · un valor que no es texto dentro del par es `invalid_fields`', () => {
    const error = bad(contains({ key: 'modulo', value: 12 }));

    error.errorCode!.should.equal('invalid_fields');
    error.errorDetails!.field!.should.equal('filter.tag');
  });

  it('una lista VACÍA es `invalid_fields`: un contains sin pares no filtra nada', () => {
    const error = bad(contains([]));

    error.errorCode!.should.equal('invalid_fields');
    error.errorDetails!.field!.should.equal('filter.tag');
  });

  it('el contains funciona igual DENTRO de una rama de `or`', () => {
    const value = ok(
      validateList(SPEC, {
        filter: { or: [{ tag: { key: 'modulo', value: 'facturacion' } }, { state: 'activo' }] },
      })
    );

    value.filter.or!.should.have.length(2);
    value.filter.or![0].conditions[0].operator.op.should.equal('contains');
  });
});

/**
 * EL DESEMPATE POR `id` QUE NO SE DUPLICA (S-024, Task 3).
 *
 * `tasks` no declara `id` ordenable, y por eso hasta acá el push incondicional alcanzaba.
 * `requirements` SÍ lo declara, y sin la guarda `sort: ["id"]` produce `ORDER BY t.id, t.id`: dos
 * claves idénticas en el cursor y dos alias sobre la misma columna.
 */
describe('queries/engine/validate-query — el desempate por `id` (S-024)', () => {
  const SPEC: ResourceSpec = {
    ...tasksSpec,
    sortable: { ...tasksSpec.sortable, id: { column: 'id' } },
    sortableNames: [...tasksSpec.sortableNames, 'id'],
  };

  const sorted = (payload: unknown) =>
    (validateList(SPEC, payload) as { value: ValidatedListQuery }).value;

  it('TS-46 · `sort: ["id"]` produce UN SOLO criterio, ascendente', () => {
    const value = sorted({ sort: ['id'] });

    value.sort.map((criterion) => criterion.field).should.deepEqual(['id']);
    value.sort[0].dir.should.equal('ASC');
    [...value.scope.sort].should.deepEqual(['id']);
  });

  it('`sort: ["-id"]` conserva la dirección QUE PIDIÓ EL CALLER', () => {
    const value = sorted({ sort: ['-id'] });

    value.sort.map((criterion) => criterion.field).should.deepEqual(['id']);
    value.sort[0].dir.should.equal('DESC');
  });

  it('`id` declarado en medio del orden tampoco se duplica', () => {
    const value = sorted({ sort: ['-createdAt', 'id'] });

    value.sort.map((criterion) => criterion.field).should.deepEqual(['createdAt', 'id']);
  });

  it('sin `id` en el orden, el desempate se agrega como siempre y hereda la última dirección', () => {
    sorted({ sort: ['createdAt'] }).sort.map((c) => `${c.field}:${c.dir}`).should.deepEqual([
      'createdAt:ASC',
      'id:ASC',
    ]);
    sorted({ sort: ['-createdAt'] }).sort.map((c) => `${c.field}:${c.dir}`).should.deepEqual([
      'createdAt:DESC',
      'id:DESC',
    ]);
    // Sin `sort`, el default de la ficha más el desempate.
    sorted({}).sort.map((c) => `${c.field}:${c.dir}`).should.deepEqual([
      'createdAt:DESC',
      'id:DESC',
    ]);
  });
});

/**
 * EL DISCRIMINADOR: EL CAMPO OBLIGATORIO QUE ELIGE LA TABLA (S-025, Task 1).
 *
 * LA FICHA DE PRUEBA ES LOCAL, no `commentsSpec`: lo que se verifica acá es la GRAMÁTICA genérica.
 * El ejercicio contra base real de `comments`, `activity` y `subscriptions` vive en sus suites.
 */
describe('queries/engine/validate-query — el discriminador (S-025)', () => {
  const VARIANT: ResourceSpec = {
    ...tasksSpec,
    name: 'things',
    discriminator: {
      field: 'entityType',
      values: ['task', 'requirement'],
      variants: {
        task: { table: 'objective_things', filterable: { ...tasksSpec.filterable } },
        requirement: { table: 'requirement_things', filterable: { ...tasksSpec.filterable } },
      },
    },
    filterable: { ...tasksSpec.filterable, entityType: { column: 'kind', kind: 'string' } },
    filterableNames: [...tasksSpec.filterableNames, 'entityType'],
  };

  const vList = (payload: unknown) => validateList(VARIANT, payload);
  const vGet = (payload: unknown) => validateGet(VARIANT, payload);

  it('TS-29/TS-30/TS-31 · sin el discriminador en `filter`, `invalid_fields` con su `allowed`', () => {
    const error = bad(vList({ filter: { projectId: 12 } }));

    error.errorCode!.should.equal('invalid_fields');
    error.errorDetails!.field!.should.equal('filter.entityType');
    (error.errorDetails!.allowed as string[]).should.deepEqual(['task', 'requirement']);
    // El mensaje tiene que decir que es OBLIGATORIO, no solo que no se aceptó.
    error.errorMessage!.should.containEql('obligatorio');
  });

  it('TS-32 · sin `filter` en absoluto: nunca `success` con la tabla por defecto', () => {
    const error = bad(vList({}));

    error.errorCode!.should.equal('invalid_fields');
    error.errorDetails!.field!.should.equal('filter.entityType');
  });

  it('TS-35 · un valor fuera de la lista es `invalid_fields`, con el valor ofensor', () => {
    for (const value of ['objective', 'project', 'Task', '']) {
      const error = bad(vList({ filter: { entityType: value } }));
      error.errorDetails!.value!.should.equal(value);
      (error.errorDetails!.allowed as string[]).should.deepEqual(['task', 'requirement']);
    }
  });

  it('TS-36 · varios valores, `null` o un operador: la variante es UNA TABLA, no un conjunto', () => {
    for (const value of [['task', 'requirement'], { not: 'task' }, null, 7, true] as unknown[]) {
      bad(vList({ filter: { entityType: value } })).errorCode!.should.equal('invalid_fields');
    }
  });

  it('TS-37 · dentro de un `or` no selecciona variante: el de arriba sigue faltando', () => {
    const error = bad(
      vList({ filter: { or: [{ entityType: 'task' }, { entityType: 'requirement' }] } })
    );

    error.errorDetails!.field!.should.equal('filter.entityType');
  });

  it('el discriminador NO produce un `FilterCondition`: la tabla ES el predicado', () => {
    // Emitir además `entityType = 'task'` sobre una columna que la variante no tiene rompería el
    // SQL, y sobre una que sí la tiene filtraría dos veces por lo mismo.
    const value = ok(vList({ filter: { entityType: 'task', projectId: 12 } }));

    value.variant!.should.equal('task');
    value.filter.conditions.map((c) => c.field).should.deepEqual(['projectId']);
  });

  it('el valor elegido viaja en `variant` y el filtro CRUDO —con él— va al scope del cursor', () => {
    // Es lo que ata el cursor a la variante SIN código nuevo: un cursor emitido con `task` falla
    // el hash contra una página pedida con `requirement`.
    const value = ok(vList({ filter: { entityType: 'requirement' } }));

    value.variant!.should.equal('requirement');
    (value.scope.filter as Record<string, unknown>).entityType!.should.equal('requirement');
  });

  it('TS-33 · en un `get` el discriminador viaja en el PRIMER NIVEL y es obligatorio', () => {
    const error = bad(vGet({ id: 1234 }));

    error.errorCode!.should.equal('invalid_fields');
    // Sin el prefijo `filter.`: en un `get` no hay filtro.
    error.errorDetails!.field!.should.equal('entityType');
    (error.errorDetails!.allowed as string[]).should.deepEqual(['task', 'requirement']);
  });

  it('TS-78 · `GET_KEYS` se DERIVA de la ficha: el discriminador entra en `allowed`', () => {
    const error = bad(vGet({ id: 1, entityType: 'task', filter: {} }));

    (error.errorDetails!.allowed as string[]).should.deepEqual([
      'id',
      'fields',
      'include',
      'entityType',
    ]);
  });

  it('un `get` con el discriminador válido resuelve y lo deja en `variant`', () => {
    const result = vGet({ id: 1234, entityType: 'requirement' });
    ('value' in result).should.be.true(JSON.stringify(result));

    const value = (result as { value: ValidatedGetQuery }).value;
    value.variant!.should.equal('requirement');
    value.id.should.equal(1234);
  });

  it('una ficha SIN discriminador no exige nada y sigue aceptando las tres palancas de siempre', () => {
    // La regresión de las cuatro fichas de S-022 y S-024.
    ok(list({})).should.have.property('kind', 'list');
    const value = (get({ id: 1 }) as { value: ValidatedGetQuery }).value;
    (value.variant === undefined).should.be.true();
    (bad(get({ id: 1, filter: {} })).errorDetails!.allowed as string[]).should.deepEqual([
      'id',
      'fields',
      'include',
    ]);
  });
});

/**
 * LA EXCEPCIÓN DE IDENTIDAD DENTRO DE `filter` (S-025, Task 7 · H-6).
 *
 * `subscriptions` declara `userId` filtrable y `IDENTITY_PAYLOAD_FIELDS` lo prohíbe también dentro
 * de `filter`. Los dos no se contradicen: QUIÉN PREGUNTA sale del subject y solo de ahí (RF-19);
 * POR QUIÉN SE FILTRA es un dato del dominio.
 */
describe('queries/engine/validate-query — identidad y filtro declarado (S-025)', () => {
  const WITH_USER_ID: ResourceSpec = {
    ...tasksSpec,
    filterable: { ...tasksSpec.filterable, userId: { column: 'user_id', kind: 'string' } },
    filterableNames: [...tasksSpec.filterableNames, 'userId'],
  };

  it('TS-53 · un nombre de identidad QUE LA FICHA DECLARA se acepta dentro de `filter`', () => {
    const result = validateList(WITH_USER_ID, { filter: { userId: 'sub-q-user' } });
    ('value' in result).should.be.true(JSON.stringify(result));

    const value = (result as { value: ValidatedListQuery }).value;
    value.filter.conditions.map((c) => c.field).should.deepEqual(['userId']);
  });

  it('TS-54 · en las claves de PRIMER NIVEL la prohibición NO se levanta', () => {
    const error = bad(validateList(WITH_USER_ID, { userId: 'otro', filter: {} }));

    error.errorMessage!.should.containEql('quién pregunta sale del subject, no del cuerpo');
    error.errorDetails!.field!.should.equal('payload');
  });

  it('TS-55 · un nombre de identidad que la ficha NO declara sigue rechazado dentro de `filter`', () => {
    for (const key of ['caller', 'sub', 'principal', 'onBehalfOf']) {
      const error = bad(validateList(WITH_USER_ID, { filter: { [key]: 'otro' } }));
      error.errorMessage!.should.containEql('quién pregunta sale del subject, no del cuerpo');
      error.errorDetails!.field!.should.equal('filter');
      error.errorDetails!.value!.should.equal(key);
    }
    // Y en una ficha que NO declara `userId`, `userId` sigue siendo identidad.
    bad(list({ filter: { userId: 'otro' } })).errorMessage!.should.containEql(
      'quién pregunta sale del subject, no del cuerpo'
    );
  });
});

/**
 * EL DISCRIMINADOR NO SE CUELA POR UNA RAMA DE `or` (S-025, Task 1).
 *
 * La ficha lo declara filtrable —es un dato del contrato que `meta.describe` proyecta— pero SIN
 * columna, porque no es una columna: es lo que elige la tabla. Dejarlo llegar a `conditionSql`
 * produciría `t.undefined` en el SQL.
 */
describe('queries/engine/validate-query — el discriminador dentro de un `or` (S-025)', () => {
  const VARIANT: ResourceSpec = {
    ...tasksSpec,
    name: 'things',
    discriminator: {
      field: 'entityType',
      values: ['task', 'requirement'],
      variants: { task: { table: 'a_things' }, requirement: { table: 'b_things' } },
    },
    // Filtrable Y SIN COLUMNA, exactamente como lo declaran las tres fichas de S-025.
    filterable: { ...tasksSpec.filterable, entityType: {} },
    filterableNames: [...tasksSpec.filterableNames, 'entityType'],
  };

  it('con la variante ya elegida arriba, repetirlo en un `or` es `invalid_fields`', () => {
    const error = bad(
      validateList(VARIANT, { filter: { entityType: 'task', or: [{ entityType: 'requirement' }] } })
    );

    error.errorCode!.should.equal('invalid_fields');
    error.errorDetails!.field!.should.equal('filter.entityType');
    error.errorMessage!.should.containEql('nivel de arriba');
  });
});
