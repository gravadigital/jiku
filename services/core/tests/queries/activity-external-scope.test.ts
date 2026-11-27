import 'mocha';
import 'should';
import { ErrorCode, Reply } from '@jiku/nats-protocol';
import { dispatchQuery } from '../helpers/dispatch';
import {
  CREATOR,
  PROJECT_MAIN,
  PROJECT_OTHER,
  Q_ADMIN,
  Q_EXTERNAL,
  Q_INTERNAL,
  Q_MIXED,
  createQueryCallers,
  createWorld,
  destroyQueryCallers,
  destroyWorld,
  grantProjects,
} from './task-fixtures';
import { createDomainWorld, destroyDomainWorld } from './domain-fixtures';
import {
  CA_INTERNAL,
  CA_MAIN,
  MISSING_ID,
  Q_EXTERNAL_2,
  TASK_FOREIGN,
  TASK_INTERNAL,
  TASK_MAIN,
  createActivityTasks,
  createObjectiveActivity,
  createSecondExternalCaller,
  destroyActivityWorld,
  destroySecondExternalCaller,
  subscribeToTask,
} from './activity-fixtures';

/**
 * EL RECORTE DEL MODO EXTERNO DE LOS TRES RECURSOS DE S-025, END-TO-END.
 *
 * NO LO SUSTITUYE `build-sql.test.ts`: una implementación que agregara el recorte al objeto
 * `filter` en vez de al SQL devolvería LAS MISMAS FILAS en el caso feliz. Lo que atrapa el recorte
 * puesto en el lugar equivocado es el comportamiento, con un caller externo de verdad.
 *
 * LAS DOS FORMAS NUEVAS:
 *
 *   comments · activity  -> proyecto permitido Y entidad dueña `public` Y la PROPIA fila `public`
 *   subscriptions        -> SOLO LAS PROPIAS (`user_id = :caller`), sin permisos de proyecto
 *
 * LA MATRIZ, cubierta por construcción con las tres tareas del fixture:
 *
 *   TASK_MAIN     / 4001  proyecto permitido, entidad public, comentario public  -> SE VE
 *   TASK_MAIN     / 4002  proyecto permitido, entidad public, comentario internal -> NO (TS-61, H-8)
 *   TASK_INTERNAL         proyecto permitido, entidad INTERNAL                    -> NO (TS-59)
 *   TASK_FOREIGN          proyecto SIN permiso                                    -> NO (TS-58)
 */

interface Collection {
  items: Record<string, unknown>[];
  page: { limit: number; returned: number; cursor?: string; total?: number };
}

function items(reply: Reply<Collection>): Record<string, unknown>[] {
  reply.status.should.equal('success', JSON.stringify(reply));
  return reply.data!.items;
}

function ids(reply: Reply<Collection>): number[] {
  return items(reply).map((item) => item.id as number);
}

/** Comentarios de las dos tareas que un externo NO tiene que ver. */
const CA_ON_INTERNAL = 8001;
const CA_ON_FOREIGN = 8002;
/** Cambio de estado `public` de la tarea visible: `activity` sí lo devuelve a un externo. */
const ACT_PUBLIC = 8003;
/** Cambio `internal` de la tarea visible: `activity` NO lo devuelve a un externo. */
const ACT_INTERNAL = 8004;

describe('queries/S-025 — el recorte del modo externo, end-to-end', () => {
  before(async () => {
    await createWorld([PROJECT_MAIN, PROJECT_OTHER]);
    await createDomainWorld();
    await createActivityTasks();
    await createQueryCallers();
    await createSecondExternalCaller([PROJECT_MAIN]);

    // PERMISO SOBRE EL 12 Y NINGUNO SOBRE EL 13, para los tres callers externos.
    await grantProjects(Q_EXTERNAL, [PROJECT_MAIN]);
    await grantProjects(Q_MIXED, [PROJECT_MAIN]);

    await createObjectiveActivity([
      { id: CA_MAIN, objectiveId: TASK_MAIN, newValue: 'Publico', createdAt: '2026-01-01T00:00:00.000Z' },
      {
        id: CA_INTERNAL,
        objectiveId: TASK_MAIN,
        newValue: 'Interno',
        visibilityLevel: 'internal',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
      { id: CA_ON_INTERNAL, objectiveId: TASK_INTERNAL, newValue: 'De la tarea interna' },
      { id: CA_ON_FOREIGN, objectiveId: TASK_FOREIGN, newValue: 'De otro proyecto' },
      {
        id: ACT_PUBLIC,
        objectiveId: TASK_MAIN,
        type: 'state',
        previousValue: 'backlog',
        newValue: 'activo',
      },
      {
        id: ACT_INTERNAL,
        objectiveId: TASK_MAIN,
        type: 'area',
        previousValue: 'desarrollo',
        newValue: 'soporte',
        visibilityLevel: 'internal',
      },
    ]);

    // Dos suscripciones a la MISMA tarea, de dos callers externos distintos.
    await subscribeToTask(TASK_MAIN, Q_EXTERNAL);
    await subscribeToTask(TASK_MAIN, Q_EXTERNAL_2);
    // Y una del primero a una tarea de un proyecto SIN permiso: sigue siendo SUYA (TS-69).
    await subscribeToTask(TASK_FOREIGN, Q_EXTERNAL);
  });

  after(async () => {
    // Las filas ANTES que los usuarios: las suscripciones referencian `users.id`.
    await destroyActivityWorld();
    await destroySecondExternalCaller();
    await destroyQueryCallers();
    await destroyDomainWorld();
    await destroyWorld();
  });

  /* ------------------------------------------------------------------------------------------
   * CA-12 · `comments` y `activity`
   * ---------------------------------------------------------------------------------------- */

  it('TS-58 · un externo NO ve los comentarios de una entidad de OTRO proyecto', async () => {
    const reply = await dispatchQuery<Collection>(
      'comments.list',
      { filter: { entityType: 'task', entityId: TASK_FOREIGN } },
      Q_EXTERNAL
    );

    // `items: []`, NO un error de autorización: el recorte devuelve el conjunto vacío.
    items(reply).should.deepEqual([]);
    (reply.errorCode === undefined).should.be.true();
  });

  it('TS-59 · tampoco los de una entidad INTERNA de un proyecto permitido', async () => {
    const reply = await dispatchQuery<Collection>(
      'comments.list',
      { filter: { entityType: 'task', entityId: TASK_INTERNAL } },
      Q_EXTERNAL
    );

    items(reply).should.deepEqual([]);
  });

  it('TS-60 · SÍ ve los comentarios públicos de una entidad visible', async () => {
    const reply = await dispatchQuery<Collection>(
      'comments.list',
      { filter: { entityType: 'task', entityId: TASK_MAIN } },
      Q_EXTERNAL
    );

    ids(reply).should.deepEqual([CA_MAIN]);
  });

  it('TS-61 · un comentario INTERNO sobre una entidad visible NO se ve (H-8)', async () => {
    // ES LA DECISIÓN DE H-8 DEL PLAN, no un descubrimiento: `objective_activity.visibility_level`
    // existe exactamente para esto —el comentario es el único tipo de actividad cuya visibilidad
    // elige el usuario— y su default es `internal`. Sin la segunda mitad del recorte, un
    // comentario interno sobre una tarea pública se ve desde el portal de clientes.
    const reply = await dispatchQuery<Collection>(
      'comments.list',
      { filter: { entityType: 'task', entityId: TASK_MAIN } },
      Q_EXTERNAL
    );

    ids(reply).should.not.containEql(CA_INTERNAL);
  });

  it('TS-62 · el recorte se aplica ANTES del filtro y no se desactiva por payload', async () => {
    const reply = await dispatchQuery<Collection>(
      'comments.list',
      { filter: { entityType: 'task', entityId: TASK_MAIN, visibilityLevel: 'internal' } },
      Q_EXTERNAL
    );

    // Se combina con AND contra `= 'public'` y da CERO FILAS, no un error y no el comentario.
    reply.status.should.equal('success');
    items(reply).should.deepEqual([]);
  });

  it('TS-63 · el recorte también gobierna el `count`', async () => {
    const reply = await dispatchQuery<Collection>(
      'comments.list',
      { filter: { entityType: 'task', entityId: TASK_MAIN }, count: 'only' },
      Q_EXTERNAL
    );

    // UN TOTAL SIN RECORTE ES UNA FUGA: filtraría exactamente la información que el recorte
    // esconde. Hay dos comentarios y solo uno es visible.
    reply.data!.page.total!.should.equal(1);
  });

  it('TS-64 · `activity.list` aplica EL MISMO recorte', async () => {
    for (const entityId of [TASK_INTERNAL, TASK_FOREIGN]) {
      const hidden = await dispatchQuery<Collection>(
        'activity.list',
        { filter: { entityType: 'task', entityId } },
        Q_EXTERNAL
      );
      items(hidden).should.deepEqual([]);
    }

    const visible = await dispatchQuery<Collection>(
      'activity.list',
      { filter: { entityType: 'task', entityId: TASK_MAIN } },
      Q_EXTERNAL
    );
    // Solo las `public`: el comentario público y el cambio de estado. La regla de visibilidad
    // automática marca `internal` todo lo que no es `state`/`title`/`description`.
    ids(visible).sort().should.deepEqual([CA_MAIN, ACT_PUBLIC].sort());
  });

  it('TS-65 · el caller INTERNO no recorta nada', async () => {
    for (const caller of [Q_INTERNAL, Q_ADMIN]) {
      const reply = await dispatchQuery<Collection>(
        'comments.list',
        { filter: { entityType: 'task', entityId: TASK_MAIN } },
        caller
      );
      ids(reply).sort().should.deepEqual([CA_MAIN, CA_INTERNAL].sort());
    }
  });

  it('TS-66 · el caller con roles mixtos gana EL MÁS RESTRICTIVO', async () => {
    const reply = await dispatchQuery<Collection>(
      'comments.list',
      { filter: { entityType: 'task', entityId: TASK_MAIN } },
      Q_MIXED
    );

    // `roles: ['user','external-user']` -> clase EXTERNA. El mismo resultado que `Q_EXTERNAL`.
    ids(reply).should.deepEqual([CA_MAIN]);
  });

  /* ------------------------------------------------------------------------------------------
   * CA-11 · `subscriptions` — SOLO LAS PROPIAS
   * ---------------------------------------------------------------------------------------- */

  it('TS-67 · un externo ve SOLO SUS PROPIAS suscripciones', async () => {
    const first = await dispatchQuery<Collection>(
      'subscriptions.list',
      { filter: { entityType: 'task', entityId: TASK_MAIN } },
      Q_EXTERNAL
    );
    items(first).map((item) => item.userId).should.deepEqual([Q_EXTERNAL]);

    const second = await dispatchQuery<Collection>(
      'subscriptions.list',
      { filter: { entityType: 'task', entityId: TASK_MAIN } },
      Q_EXTERNAL_2
    );
    items(second).map((item) => item.userId).should.deepEqual([Q_EXTERNAL_2]);
  });

  it('TS-68 · pedir las de OTRO devuelve `[]`, no un error', async () => {
    const reply = await dispatchQuery<Collection>(
      'subscriptions.list',
      { filter: { entityType: 'task', entityId: TASK_MAIN, userId: Q_EXTERNAL_2 } },
      Q_EXTERNAL
    );

    // El recorte `user_id = :caller` se aplica ANTES y con AND: `items: []` y NO acceso, y NO un
    // `caller_not_authorized` ni un `invalid_fields`.
    reply.status.should.equal('success');
    items(reply).should.deepEqual([]);
  });

  it('TS-69 · el recorte NO depende de los permisos de proyecto', async () => {
    // `Q_EXTERNAL` está suscripto a una tarea de `PROJECT_OTHER`, sobre el que NO tiene permiso.
    // Con el predicado de proyectos "por simetría", dejaría de ver SU PROPIA suscripción — datos
    // de menos, en silencio.
    const reply = await dispatchQuery<Collection>(
      'subscriptions.list',
      { filter: { entityType: 'task', entityId: TASK_FOREIGN } },
      Q_EXTERNAL
    );

    items(reply).map((item) => item.userId).should.deepEqual([Q_EXTERNAL]);
  });

  it('TS-70 · el `count` de `subscriptions` también recorta', async () => {
    const reply = await dispatchQuery<Collection>(
      'subscriptions.list',
      { filter: { entityType: 'task', entityId: TASK_MAIN }, count: 'only' },
      Q_EXTERNAL
    );

    // Hay dos suscripciones a esa tarea; el externo cuenta UNA.
    reply.data!.page.total!.should.equal(1);
  });

  it('un caller interno SÍ ve las suscripciones de todos', async () => {
    const reply = await dispatchQuery<Collection>(
      'subscriptions.list',
      { filter: { entityType: 'task', entityId: TASK_MAIN } },
      Q_ADMIN
    );

    items(reply).map((item) => item.userId).sort().should.deepEqual([Q_EXTERNAL, Q_EXTERNAL_2].sort());
  });

  /* ------------------------------------------------------------------------------------------
   * CA-13 · `comment_not_found` de un id NO VISIBLE
   * ---------------------------------------------------------------------------------------- */

  it('TS-72 · un id no visible y uno inexistente responden EXACTAMENTE lo mismo', async () => {
    const hidden = await dispatchQuery('comments.get', { id: CA_INTERNAL, entityType: 'task' }, Q_EXTERNAL);
    const missing = await dispatchQuery('comments.get', { id: MISSING_ID, entityType: 'task' }, Q_EXTERNAL);

    // IDÉNTICAS: distinguirlas le confirmaría a un caller externo que el comentario existe.
    hidden.errorCode!.should.equal(ErrorCode.COMMENT_NOT_FOUND);
    JSON.stringify(hidden).should.equal(JSON.stringify(missing));
  });

  it('el mismo `comments.get` desde un caller interno SÍ devuelve el comentario interno', async () => {
    const reply = await dispatchQuery<Record<string, unknown>>(
      'comments.get',
      { id: CA_INTERNAL, entityType: 'task' },
      Q_ADMIN
    );

    reply.status.should.equal('success', JSON.stringify(reply));
    reply.data!.authorId!.should.equal(CREATOR);
  });
});
