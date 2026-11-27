import 'mocha';
import 'should';
import sinon from 'sinon';
import { readDb } from '../../src/models/read';
import { dispatchQuery } from '../helpers/dispatch';
import {
  PROJECT_MAIN,
  Q_EXTERNAL,
  createQueryCallers,
  createWorld,
  destroyQueryCallers,
  destroyWorld,
} from './task-fixtures';
import {
  PERSON_LINKED,
  WK_INTERNAL,
  WK_MAIN,
  createTeamWorld,
  destroyTeamWorld,
} from './team-fixtures';

/**
 * `week-assigned-times.list` — LA ASIGNACIÓN SEMANAL (S-026, Task 7).
 *
 * La ÚNICA de las seis fichas SIN `filter.id`, y es una ausencia deliberada (CA-8).
 */

function ids(reply: any): number[] {
  return reply.data.items.map((item: any) => item.id);
}

describe('queries/week-assigned-times.list — la ficha y la ausencia de `filter.id`', () => {
  before(async () => {
    await createWorld();
    await createQueryCallers();
    await createTeamWorld();
  });

  after(async () => {
    await destroyTeamWorld();
    await destroyQueryCallers();
    await destroyWorld();
  });

  it('TS-59 · el conjunto base son NUEVE campos exactos', async () => {
    const reply: any = await dispatchQuery('week-assigned-times.list', {
      filter: { personId: PERSON_LINKED },
    });

    reply.status.should.equal('success');
    Object.keys(reply.data.items[0]).should.deepEqual([
      'id',
      'dateFrom',
      'dateTo',
      'internal',
      'minutes',
      'projectId',
      'personId',
      'createdAt',
      'updatedAt',
    ]);
  });

  it('TS-60 · `filter.internal` es booleano y `filter.dateFrom` acepta rango', async () => {
    const byInternal: any = await dispatchQuery('week-assigned-times.list', {
      filter: { internal: true },
    });
    ids(byInternal).should.deepEqual([WK_INTERNAL]);

    const byRange: any = await dispatchQuery('week-assigned-times.list', {
      filter: { personId: PERSON_LINKED, dateFrom: { gte: '2026-08-05' } },
    });
    ids(byRange).should.deepEqual([WK_INTERNAL]);
  });

  it('TS-61 · NO declara `filter.id`, y es la única de las seis fichas sin él', async () => {
    const reply: any = await dispatchQuery('week-assigned-times.list', { filter: { id: WK_MAIN } });

    // ES UNA AUSENCIA DELIBERADA (CA-8): una asignación semanal se busca por PERSONA y por SEMANA.
    reply.status.should.equal('failure');
    reply.errorCode.should.equal('invalid_fields');
    reply.errorDetails.field.should.equal('filter');
    reply.errorDetails.allowed.should.deepEqual([
      'personId',
      'projectId',
      'internal',
      'dateFrom',
    ]);
  });

  it('TS-62 · los dos incluibles', async () => {
    const reply: any = await dispatchQuery('week-assigned-times.list', {
      filter: { personId: PERSON_LINKED },
      include: ['person', 'project'],
    });

    reply.data.items.forEach((item: any) => {
      item.person.should.deepEqual({
        id: PERSON_LINKED,
        firstName: 'Carla',
        lastName: 'Benítez',
      });
      item.project.should.deepEqual({ id: PROJECT_MAIN, name: 'Portal Jiku', code: 'PJK' });
    });
  });

  it('TS-63 · el sort default es `["dateFrom"]`, y `personId` también es ordenable', async () => {
    const byDefault: any = await dispatchQuery('week-assigned-times.list', {
      filter: { personId: PERSON_LINKED },
    });
    ids(byDefault).should.deepEqual([WK_MAIN, WK_INTERNAL]);

    const byPerson: any = await dispatchQuery('week-assigned-times.list', { sort: ['personId'] });
    byPerson.status.should.equal('success');

    const bad: any = await dispatchQuery('week-assigned-times.list', { sort: ['minutes'] });
    bad.errorCode.should.equal('invalid_fields');
    bad.errorDetails.allowed.should.deepEqual(['dateFrom', 'personId']);
  });
});

describe('queries/week-assigned-times.list — SIN ACCESO EXTERNO (CA-9)', () => {
  before(async () => {
    await createWorld();
    await createQueryCallers();
    await createTeamWorld();
  });

  after(async () => {
    await destroyTeamWorld();
    await destroyQueryCallers();
    await destroyWorld();
  });

  it('TS-5 · un caller externo recibe `items: []` SIN EJECUTAR UNA SOLA CONSULTA', async () => {
    const spy = sinon.spy(readDb, 'query');
    try {
      const reply: any = await dispatchQuery('week-assigned-times.list', {}, Q_EXTERNAL);

      reply.status.should.equal('success');
      reply.data.items.should.deepEqual([]);
      spy.callCount.should.equal(0);
    } finally {
      spy.restore();
    }
  });
});
