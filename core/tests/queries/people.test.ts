import 'mocha';
import 'should';
import { dispatchQuery } from '../helpers/dispatch';
import {
  PERSON_ACTIVE,
  PERSON_INACTIVE,
  PROJECT_MAIN,
  PROJECT_OTHER,
  Q_EXTERNAL,
  Q_INTERNAL,
  createQueryCallers,
  createWorld,
  destroyQueryCallers,
  destroyWorld,
} from './task-fixtures';
import {
  PERSON_FOREIGN,
  PERSON_LINKED,
  PERSON_NO_CHARGE,
  PERSON_NO_USER,
  PERSON_UNASSIGNED,
  USER_SERVICE,
  createTeamWorld,
  destroyTeamWorld,
} from './team-fixtures';

/**
 * `people.list` — LAS PERSONAS DEL EQUIPO (S-026, Task 4).
 *
 * Los dos criterios que este archivo fija y que el resto del contrato no tiene:
 *
 *   CA-3 · `mustChargeWorkedTime` FILTRA SIN APARECER en la respuesta. `filterable` y `fieldNames`
 *          son listas INDEPENDIENTES, y este es el caso canónico de RF-8.
 *   CA-4 · `user: null` ES UN ESTADO VÁLIDO, no un error — y en el sentido inverso, una identidad
 *          de servicio NO APARECE como persona porque no tiene fila en `people`.
 */

function ids(reply: any): number[] {
  return reply.data.items.map((item: any) => item.id);
}

describe('queries/people.list — el conjunto base, los incluibles y los filtros', () => {
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

  it('TS-14 · el conjunto base son SIETE campos exactos', async () => {
    const reply: any = await dispatchQuery('people.list', { filter: { id: PERSON_LINKED } });

    reply.status.should.equal('success');
    Object.keys(reply.data.items[0]).should.deepEqual([
      'id',
      'firstName',
      'lastName',
      'enabled',
      'userId',
      'createdAt',
      'updatedAt',
    ]);
  });

  it('TS-15 · el sort default es `lastName, firstName` y el motor agrega `id` ASC', async () => {
    const reply: any = await dispatchQuery('people.list', {});

    // Acuña, Benítez, Gómez, Molina, Pérez, Rivas, Zapata.
    ids(reply).should.deepEqual([
      PERSON_NO_USER,
      PERSON_LINKED,
      PERSON_INACTIVE,
      PERSON_UNASSIGNED,
      PERSON_ACTIVE,
      PERSON_NO_CHARGE,
      PERSON_FOREIGN,
    ]);
  });

  it('TS-16 · los cuatro incluibles, y `user` SIN `email`', async () => {
    const reply: any = await dispatchQuery('people.list', {
      filter: { id: PERSON_LINKED },
      include: ['mustChargeWorkedTime', 'initDate', 'endDate', 'user'],
    });

    const item = reply.data.items[0];
    item.should.have.property('mustChargeWorkedTime', true);
    item.should.have.property('initDate');
    item.should.have.property('endDate', null);
    item.user.should.deepEqual({ id: Q_INTERNAL, name: 'Interna', username: 'q-user' });
  });

  it('TS-17 · CA-3 · `mustChargeWorkedTime` filtra SIN aparecer en la respuesta', async () => {
    const reply: any = await dispatchQuery('people.list', {
      filter: { mustChargeWorkedTime: true },
    });

    ids(reply).should.containEql(PERSON_LINKED);
    ids(reply).should.containEql(PERSON_NO_USER);
    ids(reply).should.not.containEql(PERSON_NO_CHARGE);
    // Es el caso canónico de RF-8: se filtra por un campo que NO viaja.
    reply.data.items.forEach((item: any) => {
      item.should.not.have.property('mustChargeWorkedTime');
    });
  });

  it('TS-18 · CA-4 · `user: null` para la persona sin usuario, objeto para la que lo tiene', async () => {
    const reply: any = await dispatchQuery('people.list', {
      filter: { id: [PERSON_LINKED, PERSON_NO_USER] },
      include: ['user'],
    });

    reply.status.should.equal('success');
    const byId = new Map(reply.data.items.map((item: any) => [item.id, item]));
    // LA CLAVE EXISTE Y VALE `null`: no es que falte.
    (byId.get(PERSON_NO_USER) as any).should.have.property('user', null);
    (byId.get(PERSON_LINKED) as any).user.should.have.property('id', Q_INTERNAL);
  });

  it('TS-19 · CA-4 · la identidad de servicio NO aparece como persona', async () => {
    const people: any = await dispatchQuery('people.list', {});

    // Se cumple POR EL MODELO —no tiene fila en `people`—, no por un filtro de la ficha.
    people.data.items.forEach((item: any) => {
      item.should.not.have.property('userId', USER_SERVICE);
    });

    const users: any = await dispatchQuery('users.list', {
      filter: { id: USER_SERVICE },
      include: ['person'],
    });
    users.data.items[0].should.have.property('person', null);
  });

  it('TS-20 · CA-2 · `filter.projectId` filtra por `projects_persons`', async () => {
    const other: any = await dispatchQuery('people.list', { filter: { projectId: PROJECT_OTHER } });
    ids(other).should.deepEqual([PERSON_FOREIGN]);

    const main: any = await dispatchQuery('people.list', { filter: { projectId: PROJECT_MAIN } });
    // En el orden del sort default: Acuña, Benítez, Rivas.
    ids(main).should.deepEqual([PERSON_NO_USER, PERSON_LINKED, PERSON_NO_CHARGE]);
  });

  it('TS-21 · `filter.q` busca en `first_name` Y en `last_name`', async () => {
    const byLastName: any = await dispatchQuery('people.list', { filter: { q: 'ben' } });
    ids(byLastName).should.deepEqual([PERSON_LINKED]);

    const byFirstName: any = await dispatchQuery('people.list', { filter: { q: 'diego' } });
    ids(byFirstName).should.deepEqual([PERSON_NO_USER]);
  });

  it('TS-22 · `filter.enabled`', async () => {
    const reply: any = await dispatchQuery('people.list', { filter: { enabled: false } });

    ids(reply).should.deepEqual([PERSON_NO_CHARGE]);
  });

  it('TS-23 · `filter.userId` es filtro DE DOMINIO; en primer nivel sigue prohibido', async () => {
    const filtered: any = await dispatchQuery('people.list', { filter: { userId: Q_INTERNAL } });
    filtered.status.should.equal('success');
    ids(filtered).should.deepEqual([PERSON_LINKED]);

    // QUIÉN PREGUNTA sale del subject y solo de ahí (RF-19).
    const topLevel: any = await dispatchQuery('people.list', { userId: Q_INTERNAL });
    topLevel.status.should.equal('failure');
    topLevel.errorCode.should.equal('invalid_fields');
    topLevel.errorMessage.should.containEql('quién pregunta sale del subject');
  });

  it('TS-24 · lo ordenable son cuatro nombres y nada más', async () => {
    const ok: any = await dispatchQuery('people.list', { sort: ['initDate'] });
    ok.status.should.equal('success');

    const bad: any = await dispatchQuery('people.list', { sort: ['createdAt'] });
    bad.status.should.equal('failure');
    bad.errorCode.should.equal('invalid_fields');
    bad.errorDetails.field.should.equal('sort');
    bad.errorDetails.allowed.should.deepEqual(['lastName', 'firstName', 'initDate', 'id']);
  });
});

describe('queries/people.list — el recorte del modo externo (CA-13)', () => {
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

  it('TS-25 · son las personas asignadas a PROYECTOS PERMITIDOS', async () => {
    const reply: any = await dispatchQuery('people.list', {}, Q_EXTERNAL);

    reply.status.should.equal('success');
    ids(reply).should.deepEqual([PERSON_NO_USER, PERSON_LINKED, PERSON_NO_CHARGE]);
    // Ni la del proyecto 13, ni la sin asignación, ni las dos del mundo heredado —que TAMPOCO
    // tienen fila en `projects_persons`, y esto lo AFIRMA en vez de asumirlo—.
    ids(reply).should.not.containEql(PERSON_FOREIGN);
    ids(reply).should.not.containEql(PERSON_UNASSIGNED);
    ids(reply).should.not.containEql(PERSON_ACTIVE);
    ids(reply).should.not.containEql(PERSON_INACTIVE);
  });

  it('TS-26 · el filtro NO desactiva el recorte: cero filas, no un error', async () => {
    const reply: any = await dispatchQuery(
      'people.list',
      { filter: { id: PERSON_UNASSIGNED } },
      Q_EXTERNAL
    );

    reply.status.should.equal('success');
    reply.data.items.should.deepEqual([]);
  });

  it('TS-27 · el recorte se reaplica en el `count`', async () => {
    const reply: any = await dispatchQuery('people.list', { count: 'only' }, Q_EXTERNAL);

    reply.data.page.total.should.equal(3);
  });
});
