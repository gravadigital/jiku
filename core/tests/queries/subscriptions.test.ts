import 'mocha';
import 'should';
import { ErrorCode, Reply } from '@jiku/nats-protocol';
import { subscriptionsSpec } from '../../src/queries/subscriptions/subscriptions-spec';
import { dispatchQuery } from '../helpers/dispatch';
import {
  CREATOR,
  PROJECT_MAIN,
  PROJECT_OTHER,
  Q_INTERNAL,
  createQueryCallers,
  createWorld,
  destroyQueryCallers,
  destroyWorld,
} from './task-fixtures';
import { createDomainWorld, destroyDomainWorld } from './domain-fixtures';
import {
  MISSING_ID,
  REQ_MAIN,
  TASK_MAIN,
  createActivityTasks,
  destroyActivityWorld,
  subscribeToRequirement,
  subscribeToTask,
} from './activity-fixtures';

/**
 * `subscriptions.list` CONTRA BASE REAL, por el despachador (S-025).
 *
 * La ficha más chica de las tres y la de las dos trampas: los nombres asimétricos de las dos
 * tablas —PLURAL y SINGULAR— y `filter.userId`, que es uno de los once nombres que la lista de
 * identidad prohíbe dentro de `filter`.
 */

interface Collection {
  items: Record<string, unknown>[];
  page: { limit: number; returned: number; cursor?: string; total?: number };
}

function items(reply: Reply<Collection>): Record<string, unknown>[] {
  reply.status.should.equal('success', JSON.stringify(reply));
  return reply.data!.items;
}

function failed(reply: Reply<unknown>): Reply<unknown> {
  reply.status.should.equal('failure', JSON.stringify(reply));
  return reply;
}

const TASK_FILTER = { entityType: 'task', entityId: TASK_MAIN };

describe('queries/subscriptions — el contrato del recurso (S-025)', () => {
  before(async () => {
    await createWorld([PROJECT_MAIN, PROJECT_OTHER]);
    await createDomainWorld();
    await createActivityTasks();
    await createQueryCallers();

    await subscribeToTask(TASK_MAIN, CREATOR);
    await subscribeToTask(TASK_MAIN, Q_INTERNAL);
    // LA OTRA TABLA, que es SINGULAR: `requirement_subscriptors`.
    await subscribeToRequirement(REQ_MAIN, Q_INTERNAL);
  });

  after(async () => {
    // EL ORDEN IMPORTA Y NO ES DEFENSIVO: las suscripciones referencian `users.id`, así que las
    // filas se borran ANTES que los callers que las tienen.
    await destroyActivityWorld();
    await destroyQueryCallers();
    await destroyDomainWorld();
    await destroyWorld();
  });

  it('TS-50 · el conjunto base son los CINCO campos declarados', async () => {
    const reply = await dispatchQuery<Collection>('subscriptions.list', { filter: TASK_FILTER });

    Object.keys(items(reply)[0]).sort().should.deepEqual([
      'createdAt',
      'entityId',
      'entityType',
      'id',
      'userId',
    ]);
    const own = items(reply).find((item) => item.userId === CREATOR)!;
    own.entityType!.should.equal('task');
    own.entityId!.should.equal(TASK_MAIN);
  });

  it('TS-51 · la otra variante lee la tabla SINGULAR', async () => {
    // `objectives_subscriptors` es PLURAL y `requirement_subscriptors` SINGULAR. Si la ficha
    // copiara un nombre para el otro, el SQL falla — y no antes de correr.
    const reply = await dispatchQuery<Collection>('subscriptions.list', {
      filter: { entityType: 'requirement', entityId: REQ_MAIN },
    });

    const own = items(reply).find((item) => item.userId === Q_INTERNAL)!;
    own.entityId!.should.equal(REQ_MAIN);
    own.entityType!.should.equal('requirement');
  });

  it('TS-52 · `user` es incluible, con tres campos y sin `email`', async () => {
    const reply = await dispatchQuery<Collection>('subscriptions.list', {
      filter: { ...TASK_FILTER, userId: CREATOR },
      include: ['user'],
    });

    items(reply)[0].user!.should.deepEqual({
      id: CREATOR,
      name: 'Creador',
      username: 'creador-queries',
    });

    const without = await dispatchQuery<Collection>('subscriptions.list', {
      filter: { ...TASK_FILTER, userId: CREATOR },
    });
    items(without)[0].should.not.have.property('user');
  });

  it('TS-53 · `filter.userId` filtra por el usuario SUSCRIPTO y NO es identidad', async () => {
    const reply = await dispatchQuery<Collection>('subscriptions.list', {
      filter: { ...TASK_FILTER, userId: Q_INTERNAL },
    });

    // NUNCA el `invalid_fields` de "quién pregunta sale del subject": acá `userId` dice POR QUIÉN
    // SE FILTRA, y quién pregunta sigue saliendo del segundo token del subject (RF-19).
    items(reply).length.should.equal(1);
    items(reply)[0].userId!.should.equal(Q_INTERNAL);
  });

  it('TS-54 · `userId` en el PRIMER NIVEL del payload sigue prohibido', async () => {
    const error = failed(
      await dispatchQuery('subscriptions.list', { userId: 'otro', filter: TASK_FILTER })
    );

    // La prohibición de primer nivel NO SE LEVANTA: ahí un `userId` no puede significar otra cosa
    // que "pregunto en nombre de".
    error.errorMessage!.should.containEql('quién pregunta sale del subject, no del cuerpo');
    error.errorDetails!.field!.should.equal('payload');
  });

  it('TS-55 · un nombre de identidad NO declarado sigue prohibido dentro de `filter`', async () => {
    for (const key of ['caller', 'sub', 'principal']) {
      const error = failed(
        await dispatchQuery('subscriptions.list', { filter: { ...TASK_FILTER, [key]: 'otro' } })
      );
      error.errorMessage!.should.containEql('quién pregunta sale del subject, no del cuerpo');
    }
  });

  it('TS-56 · el ÚNICO sort de `subscriptions` es `id`', async () => {
    const error = failed(
      await dispatchQuery('subscriptions.list', { filter: TASK_FILTER, sort: ['createdAt'] })
    );

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    error.errorDetails!.field!.should.equal('sort');
    (error.errorDetails!.allowed as string[]).should.deepEqual(['id']);
  });

  it('TS-57 · `subscriptions` NO TIENE `get`', async () => {
    const error = failed(await dispatchQuery('subscriptions.get', { id: 1 }));

    error.errorCode!.should.equal(ErrorCode.UNKNOWN_COMMAND);
    error.errorMessage!.should.containEql('subscriptions.get');
  });

  it('TS-31 · `subscriptions.list` SIN `filter.entityType`', async () => {
    const error = failed(
      await dispatchQuery('subscriptions.list', { filter: { entityId: TASK_MAIN } })
    );

    error.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    error.errorDetails!.field!.should.equal('filter.entityType');
    (error.errorDetails!.allowed as string[]).should.deepEqual(['task', 'requirement']);
  });

  it('TS-32 · sin `filter` en absoluto tampoco resuelve una tabla por defecto', async () => {
    failed(await dispatchQuery('subscriptions.list', {})).errorDetails!.field!.should.equal(
      'filter.entityType'
    );
  });

  it('TS-75 · un filtro sin coincidencias devuelve `items: []`', async () => {
    const reply = await dispatchQuery<Collection>('subscriptions.list', {
      filter: { entityType: 'task', entityId: MISSING_ID },
    });

    items(reply).should.deepEqual([]);
  });

  it('TS-76 · un nombre inventado en las cuatro palancas es `invalid_fields`', async () => {
    const payloads: unknown[] = [
      { filter: { ...TASK_FILTER, nombreInventado: 1 } },
      { filter: TASK_FILTER, sort: ['nombreInventado'] },
      { filter: TASK_FILTER, fields: ['nombreInventado'] },
      { filter: TASK_FILTER, include: ['nombreInventado'] },
    ];

    for (const payload of payloads) {
      failed(await dispatchQuery('subscriptions.list', payload)).errorCode!.should.equal(
        ErrorCode.INVALID_FIELDS
      );
    }
  });
});

/** LA FICHA COMO DATO (TS-94). No toca la base. */
describe('queries/subscriptions — la ficha como dato (S-025)', () => {
  it('TS-94 · sin `notFoundCode` ni `notFoundMessage`: no tiene `get`', () => {
    (subscriptionsSpec.notFoundCode === undefined).should.be.true();
    (subscriptionsSpec.notFoundMessage === undefined).should.be.true();
  });

  it('TS-94 · los cuatro arrays de nombres, y `sortableNames` es solo `id`', () => {
    [...subscriptionsSpec.baseNames].should.deepEqual([
      'id',
      'entityType',
      'entityId',
      'userId',
      'createdAt',
    ]);
    [...subscriptionsSpec.includableNames].should.deepEqual(['user']);
    [...subscriptionsSpec.filterableNames].should.deepEqual(['entityType', 'entityId', 'userId']);
    [...subscriptionsSpec.sortableNames].should.deepEqual(['id']);
    [...subscriptionsSpec.truncatable].should.deepEqual([]);
  });

  it('TS-93 · el recorte es `owner` y se declara UNA VEZ, no por variante', () => {
    subscriptionsSpec.externalScope.should.deepEqual({ kind: 'owner', userColumn: 'user_id' });
    for (const variant of Object.values(subscriptionsSpec.discriminator!.variants)) {
      (variant.externalScope === undefined).should.be.true();
    }
  });

  it('las dos variantes leen la tabla correcta, con la asimetría de la base', () => {
    subscriptionsSpec.discriminator!.variants.task.table.should.equal('objectives_subscriptors');
    subscriptionsSpec.discriminator!.variants.requirement.table.should.equal(
      'requirement_subscriptors'
    );
  });
});
