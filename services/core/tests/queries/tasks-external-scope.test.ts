import 'mocha';
import 'should';
import { Objective } from '@jiku/models';
import { dispatchQuery } from '../helpers/dispatch';
import {
  PROJECT_MAIN,
  PROJECT_OTHER,
  Q_ADMIN,
  Q_EXTERNAL,
  Q_INTERNAL,
  Q_MIXED,
  createQueryCallers,
  createTasks,
  createWorld,
  destroyQueryCallers,
  destroyWorld,
  grantProjects,
} from './task-fixtures';

/**
 * EL RECORTE DEL MODO EXTERNO, VERIFICADO DESDE EL COMPORTAMIENTO.
 *
 * Es la verificación que la story pide explícitamente, y no la sustituye la de
 * `build-sql.test.ts`: un test que solo inspeccione el SQL NO ATRAPA un recorte agregado en el
 * lugar equivocado —al objeto `filter` en vez de al SQL— porque en el caso feliz devuelve las
 * mismas filas. Lo que se prueba acá es qué VE cada clase de caller, incluidos los intentos de
 * desactivar el recorte por payload.
 *
 * Se entra por `dispatchQuery()` contra la base real, como manda la convención `testing`.
 */

interface Page {
  items: Record<string, any>[];
  page: { limit: number; returned: number; cursor?: string; total?: number };
}

const ids = (items: Record<string, any>[]): number[] => items.map((item) => item.id);

/** El recurso VISIBLE para el caller externo: proyecto permitido y `visibilityLevel: public`. */
const VISIBLE = 9001;
/** Existe, está en un proyecto permitido, pero es `internal`. */
const INTERNA = 9002;
/** Existe y es pública, pero vive en un proyecto SIN permiso. */
const AJENA = 9003;
/** No existe. */
const INEXISTENTE = 999999;

describe('queries/tasks — el recorte del modo externo, end-to-end (S-023)', () => {
  before(async () => {
    await createWorld([PROJECT_MAIN, PROJECT_OTHER]);
    await createQueryCallers();

    // Permiso sobre el proyecto principal y NINGUNO sobre el otro: es el mundo mínimo que hace
    // observable la diferencia entre "no existe" y "no lo podés ver".
    await grantProjects(Q_EXTERNAL, [PROJECT_MAIN]);
    await grantProjects(Q_MIXED, [PROJECT_MAIN]);

    await createTasks([
      {
        id: VISIBLE,
        title: 'Pública del proyecto permitido',
        visibilityLevel: 'public',
        projectId: PROJECT_MAIN,
        createdAt: '2026-08-03T00:00:00.000Z',
      },
      {
        id: INTERNA,
        title: 'Interna del proyecto permitido',
        visibilityLevel: 'internal',
        projectId: PROJECT_MAIN,
        createdAt: '2026-08-02T00:00:00.000Z',
      },
      {
        id: AJENA,
        title: 'Pública de un proyecto sin permiso',
        visibilityLevel: 'public',
        projectId: PROJECT_OTHER,
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ]);
  });

  after(async () => {
    // El mundo PRIMERO: borra las filas de `user_project_permissions` que referencian a los
    // callers, y recién después se pueden borrar los callers.
    await destroyWorld();
    await destroyQueryCallers();
  });

  describe('CA-11 · el recorte se aplica ANTES del filtro del caller', () => {
    it('TS-28 · `tasks.list` externo sin filtro devuelve SOLO lo visible', async () => {
      const reply = await dispatchQuery<Page>('tasks.list', {}, Q_EXTERNAL);

      reply.status.should.equal('success');
      // Sin la interna (`visibilityLevel: internal`) y sin la del proyecto ajeno.
      ids(reply.data!.items).should.deepEqual([VISIBLE]);
    });

    it('TS-36 · roles mixtos entran en modo EXTERNO: gana el más restrictivo', async () => {
      // `['user','external-user']`: si ganara `user`, este caller vería las tres.
      const reply = await dispatchQuery<Page>('tasks.list', {}, Q_MIXED);

      ids(reply.data!.items).should.deepEqual([VISIBLE]);
    });
  });

  describe('CA-12 · el recorte NO se puede desactivar por payload', () => {
    it('TS-29 · pedir `visibilityLevel: internal` devuelve `items: []`, no un error', async () => {
      const reply = await dispatchQuery<Page>(
        'tasks.list',
        { filter: { visibilityLevel: 'internal' } },
        Q_EXTERNAL
      );

      // El filtro del caller se combina con AND contra el recorte: cero filas es una respuesta
      // legítima, y un error habría sido un oráculo.
      reply.status.should.equal('success');
      reply.data!.items.should.deepEqual([]);
      reply.data!.page.limit.should.equal(50);
      reply.data!.page.returned.should.equal(0);
    });

    it('TS-30 · pedir un proyecto SIN permiso devuelve `items: []`', async () => {
      const reply = await dispatchQuery<Page>(
        'tasks.list',
        { filter: { projectId: PROJECT_OTHER } },
        Q_EXTERNAL
      );

      reply.status.should.equal('success');
      reply.data!.items.should.deepEqual([]);
    });

    it('TS-31 · el `count` cuenta SOLO lo visible', async () => {
      const externo = await dispatchQuery<Page>('tasks.list', { count: true }, Q_EXTERNAL);
      const interno = await dispatchQuery<Page>('tasks.list', { count: true }, Q_INTERNAL);

      // Los dos despachos, sobre el MISMO payload: un total sin comparación no prueba que el
      // recorte esté también en el COUNT, que es donde es más fácil olvidarlo.
      externo.data!.page.total!.should.equal(1);
      interno.data!.page.total!.should.equal(3);
    });
  });

  describe('CA-13, CA-14 · el `get` y la indistinguibilidad de los `*_not_found`', () => {
    it('TS-32 · `tasks.get` de algo visible responde el recurso', async () => {
      const reply = await dispatchQuery<{ id: number }>('tasks.get', { id: VISIBLE }, Q_EXTERNAL);

      reply.status.should.equal('success');
      reply.data!.id.should.equal(VISIBLE);
    });

    it('TS-33 · `tasks.get` de una tarea `internal` que EXISTE responde task_not_found', async () => {
      const reply = await dispatchQuery('tasks.get', { id: INTERNA }, Q_EXTERNAL);

      // NO un error de autorización: eso le confirmaría al caller externo que el recurso existe.
      reply.should.deepEqual({
        status: 'failure',
        errorCode: 'task_not_found',
        errorMessage: 'No existe una tarea con ese id',
      });
    });

    it('TS-34 · `tasks.get` de una tarea de un proyecto sin permiso responde igual', async () => {
      const reply = await dispatchQuery('tasks.get', { id: AJENA }, Q_EXTERNAL);

      reply.should.deepEqual({
        status: 'failure',
        errorCode: 'task_not_found',
        errorMessage: 'No existe una tarea con ese id',
      });
    });

    it('TS-35 · "no existe" y "no lo podés ver" son INDISTINGUIBLES', async () => {
      const interna = await dispatchQuery('tasks.get', { id: INTERNA }, Q_EXTERNAL);
      const ajena = await dispatchQuery('tasks.get', { id: AJENA }, Q_EXTERNAL);
      const inexistente = await dispatchQuery('tasks.get', { id: INEXISTENTE }, Q_EXTERNAL);

      // Lo que se verifica es que los tres reply sean IDÉNTICOS, no que cada uno sea
      // `task_not_found`: tres aserciones sueltas dejarían pasar un mensaje que difiera.
      interna.should.deepEqual(inexistente);
      ajena.should.deepEqual(inexistente);
    });
  });

  describe('CA-15, CA-16 · los modos que NO recortan', () => {
    it('TS-37 · el modo INTERNO no recorta nada a nivel de fila', async () => {
      const list = await dispatchQuery<Page>('tasks.list', {}, Q_INTERNAL);
      const get = await dispatchQuery<{ id: number }>('tasks.get', { id: INTERNA }, Q_ADMIN);

      // Es una decisión explícita de la v1 (RF-23): quien tiene credenciales de bus con rol `user`
      // es equipo interno con acceso a todo, y la autorización fina por rol vive en la api.
      ids(list.data!.items).should.deepEqual([VISIBLE, INTERNA, AJENA]);
      get.status.should.equal('success');
      get.data!.id.should.equal(INTERNA);
    });

    it('TS-38 · el modo CONECTOR no recorta nada', async () => {
      // El caller por defecto de `dispatchQuery()` es el publicador confiable, que en los fixtures
      // tiene `roles: ['internal-app']` -> clase CONECTOR.
      const reply = await dispatchQuery<Page>('tasks.list', {});

      ids(reply.data!.items).should.deepEqual([VISIBLE, INTERNA, AJENA]);
    });
  });

  /**
   * TS-39 vive en su propio bloque porque necesita MÁS tareas de las que el resto de los
   * escenarios espera ver: con `limit: 2` hacen falta al menos tres visibles para que haya una
   * segunda página. Se crean y se borran acá.
   */
  describe('CA-11, CA-12 · el recorte se REAPLICA en la página siguiente', () => {
    const EXTRA = [9004, 9005, 9006, 9007];

    before(async () => {
      await createTasks([
        {
          id: 9004,
          title: 'Pública 2',
          visibilityLevel: 'public',
          projectId: PROJECT_MAIN,
          createdAt: '2026-08-06T00:00:00.000Z',
        },
        {
          id: 9005,
          title: 'Pública 3',
          visibilityLevel: 'public',
          projectId: PROJECT_MAIN,
          createdAt: '2026-08-05T00:00:00.000Z',
        },
        {
          id: 9006,
          title: 'Interna 2',
          visibilityLevel: 'internal',
          projectId: PROJECT_MAIN,
          createdAt: '2026-08-04T00:00:00.000Z',
        },
        {
          id: 9007,
          title: 'Ajena 2',
          visibilityLevel: 'public',
          projectId: PROJECT_OTHER,
          createdAt: '2026-07-31T00:00:00.000Z',
        },
      ]);
    });

    after(async () => {
      await Objective.destroy({ where: { id: EXTRA } });
    });

    it('TS-39 · ninguna página devuelve una tarea no visible, y la suma es el conjunto recortado', async () => {
      const primera = await dispatchQuery<Page>('tasks.list', { page: { limit: 2 } }, Q_EXTERNAL);

      primera.status.should.equal('success');
      ids(primera.data!.items).should.deepEqual([9004, 9005]);
      (typeof primera.data!.page.cursor).should.equal('string');

      const segunda = await dispatchQuery<Page>(
        'tasks.list',
        { page: { limit: 2, cursor: primera.data!.page.cursor } },
        Q_EXTERNAL
      );

      // El cursor transporta la CLAVE DE ORDEN y no un conjunto congelado: el `WHERE` se vuelve a
      // armar entero en cada página, así que el recorte se reaplica.
      ids(segunda.data!.items).should.deepEqual([VISIBLE]);

      const todas = [...ids(primera.data!.items), ...ids(segunda.data!.items)];
      todas.should.deepEqual([9004, 9005, VISIBLE]);
      todas.should.not.containEql(INTERNA);
      todas.should.not.containEql(AJENA);
      todas.should.not.containEql(9006);
      todas.should.not.containEql(9007);
    });
  });
});
