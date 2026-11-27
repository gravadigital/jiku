import 'mocha';
import 'should';
import sinon from 'sinon';
import { Requirement } from '@jiku/models';
import { Sequelize } from 'sequelize-typescript';
import { sequelize } from '../../src/models';
import { readDb } from '../../src/models/read';
import { buildTagsSql } from '../../src/queries/requirements/requirements-tags';
import { requirementsSpec } from '../../src/queries/requirements/requirements-spec';
import { dispatchQuery } from '../helpers/dispatch';
import {
  CREATOR,
  PROJECT_MAIN,
  PROJECT_OTHER,
  Q_EXTERNAL,
  Q_INTERNAL,
  Q_MIXED,
  createQueryCallers,
  createWorld,
  destroyQueryCallers,
  destroyWorld,
  grantProjects,
} from './task-fixtures';

/**
 * `requirements.tags` — EL AGREGADO CON FORMA PROPIA (S-028, Task 2).
 *
 * TODO ENTRA POR `dispatchQuery()` (ADR-013, CA-21): el helper arma el subject de `jiku-queries` y
 * entra por el `QueryDispatcher` real, así que cada test cubre también las dos compuertas y la
 * resolución de la clase del caller. Llamar a `execute()` directo probaría el SQL y nada más.
 *
 * LOS FIXTURES SON PROPIOS DE ESTE ARCHIVO y no salen de `domain-fixtures.ts`: los escenarios de
 * agrupado, deduplicación y coincidencia parcial necesitan un conjunto de tags DISEÑADO para que
 * cada propiedad sea observable por separado, y acomodarlo en los fixtures compartidos rompería las
 * aserciones de `requirements.test.ts` sobre el filtro `tag`.
 */

/** Los requisitos del proyecto principal, con el conjunto de tags que hace observable cada regla. */
const SEEDS = [
  { id: 6001, visibilityLevel: 'public', tags: [{ key: 'modulo', value: 'facturacion' }] },
  {
    id: 6002,
    visibilityLevel: 'public',
    tags: [
      { key: 'modulo', value: 'reportes' },
      { key: 'entorno', value: 'produccion' },
    ],
  },
  { id: 6003, visibilityLevel: 'public', tags: [{ key: 'modalidad', value: 'remoto' }] },
  // EL PAR REPETIDO: sin él, la deduplicación de `values` no se puede afirmar (TS-14).
  { id: 6004, visibilityLevel: 'public', tags: [{ key: 'modulo', value: 'facturacion' }] },
  // `NULL` y `[]`: los dos tienen que no aportar y no romper (TS-15, TS-16).
  { id: 6005, visibilityLevel: 'public', tags: null },
  { id: 6006, visibilityLevel: 'public', tags: [] },
  // EL INTERNO: su clave NO puede filtrarse a un caller externo (TS-21).
  { id: 6007, visibilityLevel: 'internal', tags: [{ key: 'secreto', value: 'x' }] },
];

/** En el OTRO proyecto, para que la insensibilidad a mayúsculas no ensucie los conteos del 12. */
const CASE_SEED = {
  id: 6101,
  visibilityLevel: 'public',
  tags: [
    { key: 'Modulo', value: 'uno' },
    { key: 'modulo', value: 'dos' },
  ],
};

interface TagItem {
  key: string;
  values: string[];
}

function items(reply: any): TagItem[] {
  reply.status.should.equal('success', JSON.stringify(reply));
  return reply.data.items as TagItem[];
}

function keys(reply: any): string[] {
  return items(reply).map((item) => item.key);
}

describe('queries/requirements.tags — el agregado del contrato (S-028, Task 2)', () => {
  before(async () => {
    await createWorld([PROJECT_MAIN, PROJECT_OTHER]);
    await createQueryCallers();
    // `Q_EXTERNAL` VE el proyecto 12; `Q_MIXED` —que también es de clase externa— NO. La diferencia
    // entre los dos es lo que separa "recortado a nada" de "recortado a lo permitido".
    await grantProjects(Q_EXTERNAL, [PROJECT_MAIN]);

    await Requirement.bulkCreate(
      [...SEEDS.map((seed) => ({ ...seed, projectId: PROJECT_MAIN })),
        { ...CASE_SEED, projectId: PROJECT_OTHER }].map((seed) => ({
        id: seed.id,
        title: `Requisito ${seed.id}`,
        description: 'Fixture de tags',
        state: 'analisis',
        priority: 'sin_prioridad',
        projectId: seed.projectId,
        createdBy: CREATOR,
        visibilityLevel: seed.visibilityLevel,
        tags: seed.tags,
      })) as any
    );
  });

  after(async () => {
    await destroyQueryCallers();
    await destroyWorld();
  });

  afterEach(() => sinon.restore());

  /* ------------------------------------------------------------------------------------------
   * EL CAMINO FELIZ Y EL AGRUPADO
   * ---------------------------------------------------------------------------------------- */

  it('TS-8 · agrupa los pares por clave (CA-3)', async () => {
    const reply = await dispatchQuery('requirements.tags', {
      filter: { projectId: PROJECT_MAIN, key: 'modulo' },
    });

    items(reply).should.deepEqual([{ key: 'modulo', values: ['facturacion', 'reportes'] }]);
  });

  it('TS-9 · sin `filter.key` devuelve TODAS las claves del proyecto (CA-5)', async () => {
    const reply = await dispatchQuery('requirements.tags', {
      filter: { projectId: PROJECT_MAIN },
    });

    // El caller por defecto es el publicador confiable: clase CONECTOR, sin recorte, así que ve
    // también la clave del requisito interno.
    keys(reply).should.deepEqual(['entorno', 'modalidad', 'modulo', 'secreto']);
  });

  it('TS-14 · los valores NO se duplican (CA-3)', async () => {
    // `{modulo, facturacion}` está en DOS requisitos (6001 y 6004). `ARRAY_AGG(DISTINCT ...)` lo
    // resuelve sin código, y el `ORDER BY` dentro del agregado hace determinista el orden.
    const reply = await dispatchQuery('requirements.tags', {
      filter: { projectId: PROJECT_MAIN, key: 'modulo' },
    });

    items(reply)[0].values.should.deepEqual(['facturacion', 'reportes']);
  });

  it('TS-15 · un requisito con `tags = NULL` no rompe ni aporta', async () => {
    const reply = await dispatchQuery('requirements.tags', {
      filter: { projectId: PROJECT_MAIN },
    });

    reply.status.should.equal('success');
    keys(reply).should.not.containEql('');
  });

  it('TS-16 · un requisito con `tags = []` no aporta', async () => {
    const reply = await dispatchQuery('requirements.tags', {
      filter: { projectId: PROJECT_MAIN },
    });

    // Cuatro claves EXACTAS: si `[]` aportara algo, habría una quinta entrada vacía.
    items(reply).should.have.length(4);
  });

  it('un `tags` que NO es un array no hace fallar la consulta entera', async () => {
    // `jsonb_array_elements` LANZA sobre un objeto, y la columna no tiene CHECK. Sin la guarda del
    // `CASE` dentro del `LATERAL`, una fila mal escrita por SQL rompería el endpoint para TODO el
    // proyecto con `internal_error`.
    // LA ESCRITURA VA POR LA CONEXIÓN DEL DUEÑO: `readDb` conecta con un rol SIN `INSERT` (ADR-001),
    // y esa asimetría es la que hace que el test valga.
    await sequelize.query(
      `INSERT INTO requirements (id, title, description, state, priority, project_id, created_by,
         visibility_level, tags, created_at, updated_at)
       VALUES (6099, 'Tags mal escritos', 'Fixture', 'analisis', 'sin_prioridad', :projectId,
         :creator, 'public', '{"modulo":"x"}'::jsonb, NOW(), NOW())`,
      { replacements: { projectId: PROJECT_MAIN, creator: CREATOR } }
    );

    try {
      const reply = await dispatchQuery('requirements.tags', {
        filter: { projectId: PROJECT_MAIN },
      });

      reply.status.should.equal('success', JSON.stringify(reply));
      keys(reply).should.deepEqual(['entorno', 'modalidad', 'modulo', 'secreto']);
    } finally {
      await sequelize.query('DELETE FROM requirements WHERE id = 6099');
    }
  });

  /* ------------------------------------------------------------------------------------------
   * LA COINCIDENCIA PARCIAL
   * ---------------------------------------------------------------------------------------- */

  it('TS-12 · `filter.key` es de COINCIDENCIA PARCIAL (CA-5)', async () => {
    const reply = await dispatchQuery('requirements.tags', {
      filter: { projectId: PROJECT_MAIN, key: 'mod' },
    });

    keys(reply).should.deepEqual(['modalidad', 'modulo']);
  });

  it('TS-13 · la coincidencia parcial es INSENSIBLE A MAYÚSCULAS (CA-5)', async () => {
    const reply = await dispatchQuery('requirements.tags', {
      filter: { projectId: PROJECT_OTHER, key: 'modulo' },
    });

    // `ILIKE`, coherente con el `q` del resto del contrato. `Modulo` y `modulo` son claves DISTINTAS
    // —el agrupado es por el valor exacto—, pero las dos matchean el filtro.
    keys(reply).sort().should.deepEqual(['Modulo', 'modulo']);
  });

  it('TS-18 · un `filter.key` que no matchea nada devuelve la lista vacía', async () => {
    const reply = await dispatchQuery('requirements.tags', {
      filter: { projectId: PROJECT_MAIN, key: 'zzz' },
    });

    items(reply).should.deepEqual([]);
  });

  it('los comodines de `LIKE` del caller son LITERALES, no un lenguaje de patrones', async () => {
    const reply = await dispatchQuery('requirements.tags', {
      filter: { projectId: PROJECT_MAIN, key: '%' },
    });

    // Sin el escape, `%` traería TODAS las claves. Con él busca un `%` literal, que no existe.
    items(reply).should.deepEqual([]);
  });

  /* ------------------------------------------------------------------------------------------
   * `filter.projectId` OBLIGATORIO
   * ---------------------------------------------------------------------------------------- */

  it('TS-10 · sin `filter.projectId` es `invalid_fields` (CA-4)', async () => {
    const reply: any = await dispatchQuery('requirements.tags', { filter: { key: 'modulo' } });

    reply.status.should.equal('failure');
    reply.errorCode.should.equal('invalid_fields');
    reply.errorDetails.field.should.equal('filter.projectId');
  });

  it('TS-11 · sin `filter` entero también es `invalid_fields` (CA-4)', async () => {
    const reply: any = await dispatchQuery('requirements.tags', {});

    reply.status.should.equal('failure');
    reply.errorCode.should.equal('invalid_fields');
    reply.errorDetails.field.should.equal('filter.projectId');
  });

  it('TS-27 · un `filter.projectId` no numérico es `invalid_fields` (CA-4)', async () => {
    const reply: any = await dispatchQuery('requirements.tags', {
      filter: { projectId: 'doce' },
    });

    reply.status.should.equal('failure');
    reply.errorCode.should.equal('invalid_fields');
    reply.errorDetails.field.should.equal('filter.projectId');
  });

  /* ------------------------------------------------------------------------------------------
   * EL RECORTE DEL MODO EXTERNO
   * ---------------------------------------------------------------------------------------- */

  it('TS-19 · un caller externo SIN permiso recibe `items: []`, no un error (CA-6)', async () => {
    const reply = await dispatchQuery(
      'requirements.tags',
      { filter: { projectId: PROJECT_MAIN } },
      Q_MIXED
    );

    items(reply).should.deepEqual([]);
  });

  it('TS-20 · un caller externo CON permiso ve los pares de los requisitos públicos (CA-6)', async () => {
    const reply = await dispatchQuery(
      'requirements.tags',
      { filter: { projectId: PROJECT_MAIN } },
      Q_EXTERNAL
    );

    keys(reply).should.deepEqual(['entorno', 'modalidad', 'modulo']);
  });

  it('TS-21 · los tags de un requisito `internal` NO se filtran al modo externo (CA-6)', async () => {
    const reply = await dispatchQuery(
      'requirements.tags',
      { filter: { projectId: PROJECT_MAIN } },
      Q_EXTERNAL
    );

    // El canal lateral que este test cierra: un endpoint que "solo devuelve claves y valores"
    // dejaría deducir el contenido de un requisito que el portal no puede leer.
    keys(reply).should.not.containEql('secreto');
  });

  it('TS-22 · el recorte se aplica ANTES del filtro (CA-6)', async () => {
    const reply = await dispatchQuery(
      'requirements.tags',
      { filter: { projectId: PROJECT_MAIN, key: 'modulo' } },
      Q_MIXED
    );

    items(reply).should.deepEqual([]);
  });

  it('TS-23 · un caller INTERNO no se recorta (CA-6)', async () => {
    const reply = await dispatchQuery(
      'requirements.tags',
      { filter: { projectId: PROJECT_MAIN } },
      Q_INTERNAL
    );

    keys(reply).should.containEql('secreto');
  });

  /* ------------------------------------------------------------------------------------------
   * LAS REGLAS GENERALES DEL CONTRATO (CA-20)
   * ---------------------------------------------------------------------------------------- */

  it('TS-24 · una palanca de `list` no declarada es `invalid_fields`', async () => {
    const reply: any = await dispatchQuery('requirements.tags', {
      filter: { projectId: PROJECT_MAIN },
      sort: ['key'],
    });

    reply.status.should.equal('failure');
    reply.errorCode.should.equal('invalid_fields');
    reply.errorDetails.allowed.should.containEql('filter');
    reply.errorDetails.allowed.should.not.containEql('sort');
  });

  it('TS-25 · un nombre no declarado dentro de `filter` es `invalid_fields`', async () => {
    const reply: any = await dispatchQuery('requirements.tags', {
      filter: { projectId: PROJECT_MAIN, inventado: 1 },
    });

    reply.status.should.equal('failure');
    reply.errorCode.should.equal('invalid_fields');
    reply.errorDetails.allowed.should.deepEqual(['projectId', 'key']);
  });

  it('TS-26 · un campo de identidad en el payload se rechaza', async () => {
    const reply: any = await dispatchQuery('requirements.tags', {
      filter: { projectId: PROJECT_MAIN },
      userId: 'otro',
    });

    reply.status.should.equal('failure');
    reply.errorCode.should.equal('invalid_fields');
    reply.errorMessage.should.containEql('subject');
  });

  it('TS-17 · un proyecto sin requisitos con tags devuelve `items: []`, no un `*_not_found`', async () => {
    const reply: any = await dispatchQuery('requirements.tags', { filter: { projectId: 999 } });

    reply.status.should.equal('success');
    reply.data.items.should.deepEqual([]);
  });

  it('TS-28 · un proyecto inexistente NO devuelve `*_not_found` (CA-20)', async () => {
    const reply: any = await dispatchQuery('requirements.tags', {
      filter: { projectId: 999999 },
    });

    reply.status.should.equal('success');
    reply.data.items.should.deepEqual([]);
    JSON.stringify(reply).should.not.containEql('_not_found');
  });

  it('la respuesta NO lleva `page`: no es una colección paginada', async () => {
    const reply: any = await dispatchQuery('requirements.tags', {
      filter: { projectId: PROJECT_MAIN },
    });

    Object.keys(reply.data).should.deepEqual(['items']);
  });

  /* ------------------------------------------------------------------------------------------
   * EL SQL
   * ---------------------------------------------------------------------------------------- */

  it('TS-30 · ningún nombre del payload se concatena al SQL', () => {
    const plan = buildTagsSql(
      { projectId: PROJECT_MAIN, key: 'inyeccion-obvia' },
      { caller: 'sub-q-external', callerClass: 'external', db: readDb }
    );

    plan.sql.should.not.containEql('inyeccion-obvia');
    plan.sql.should.not.containEql(String(PROJECT_MAIN));
    plan.replacements.keyPattern!.should.equal('%inyeccion-obvia%');
    plan.replacements.projectId!.should.equal(PROJECT_MAIN);
  });

  it('si la ficha de `requirements` cambiara de forma, el recorte FALLA en vez de desaparecer', () => {
    // La alternativa —no emitir nada y seguir— dejaría al agregado sin recorte EN SILENCIO, con los
    // tags de los requisitos internos saliendo por un endpoint que "solo devuelve claves y valores".
    // El despachador traduce este throw a `internal_error`: un 500 evidente antes que una fuga muda.
    const original = Object.getOwnPropertyDescriptor(requirementsSpec, 'externalScope')!;
    Object.defineProperty(requirementsSpec, 'externalScope', {
      value: { kind: 'none' },
      configurable: true,
    });

    try {
      (() =>
        buildTagsSql(
          { projectId: PROJECT_MAIN },
          { caller: 'sub-q-external', callerClass: 'external', db: readDb }
        )).should.throw(/no sabe recortar un externalScope "none"/);
    } finally {
      Object.defineProperty(requirementsSpec, 'externalScope', original);
    }
  });

  it('el recorte sale de la ficha de `requirements` y NO se emite para un caller interno', () => {
    const external = buildTagsSql(
      { projectId: PROJECT_MAIN },
      { caller: 'sub-q-external', callerClass: 'external', db: readDb }
    );
    const internal = buildTagsSql(
      { projectId: PROJECT_MAIN },
      { caller: 'sub-q-user', callerClass: 'internal', db: readDb }
    );

    external.sql.should.containEql('user_project_permissions');
    external.sql.should.containEql('visibility_level');
    internal.sql.should.not.containEql('user_project_permissions');
    internal.sql.should.not.containEql('visibility_level');
  });
});

/**
 * TS-29 · EL `statement_timeout` SE TRADUCE A `query_timeout`, TAMBIÉN EN ESTE ENDPOINT.
 *
 * Va en su propio `describe` porque necesita una conexión con otro `statement_timeout`, y es el
 * test que justifica que `execute` use `selectRows` y no `ctx.db.query` directo: con la llamada
 * cruda, la respuesta sería `internal_error` y se rompería la invariante
 * `POSTGRESQL_STATEMENT_TIMEOUT_MS (8000) < NATS_QUERY_TIMEOUT_MS (10000)`.
 */
describe('queries/requirements.tags — `query_timeout` (S-028, TS-29)', () => {
  let slowDb: Sequelize;

  before(async () => {
    await createWorld([PROJECT_MAIN]);
    const saved = process.env.POSTGRESQL_STATEMENT_TIMEOUT_MS;
    process.env.POSTGRESQL_STATEMENT_TIMEOUT_MS = '100';
    const modulePath = require.resolve('../../src/models/read');
    delete require.cache[modulePath];
    slowDb = (require('../../src/models/read') as typeof import('../../src/models/read')).readDb;
    process.env.POSTGRESQL_STATEMENT_TIMEOUT_MS = saved;
    delete require.cache[modulePath];
  });

  after(async () => {
    await slowDb.close();
    await destroyWorld();
  });

  afterEach(() => sinon.restore());

  it('TS-29 · responde `query_timeout`, no `internal_error`', async () => {
    sinon.stub(readDb, 'query').callsFake((() => slowDb.query('SELECT pg_sleep(2)')) as any);

    const reply: any = await dispatchQuery('requirements.tags', {
      filter: { projectId: PROJECT_MAIN },
    });

    reply.status.should.equal('failure');
    reply.errorCode.should.equal('query_timeout');
    reply.errorCode.should.not.equal('internal_error');
  });
});
