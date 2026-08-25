import 'mocha';
import 'should';
import { dispatchQuery } from '../helpers/dispatch';
import {
  CREATOR,
  Q_ADMIN,
  Q_EXTERNAL,
  Q_INTERNAL,
  Q_MIXED,
  createQueryCallers,
  createWorld,
  destroyQueryCallers,
  destroyWorld,
} from './task-fixtures';
import {
  PERSON_LINKED,
  Q_LONELY,
  USER_SERVICE,
  createTeamWorld,
  destroyTeamWorld,
} from './team-fixtures';

/**
 * `users.list` — EL ESPEJO DE IDENTIDAD, RECORTADO (S-026, Task 5).
 *
 * Los tres criterios que este archivo fija:
 *
 *   CA-6  · `email` es EL ÚNICO DATO PERSONAL del contrato: filtrable, incluible y NO base.
 *   CA-7  · `roles` e `identityType` NO SE EXPONEN, en las cuatro palancas a la vez. No hay código
 *           que los excluya: la única protección es NO DECLARARLOS (ADR-008).
 *   CA-14 · el recorte externo es "los de mis proyectos, MÁS YO MISMO".
 */

function ids(reply: any): string[] {
  return reply.data.items.map((item: any) => item.id);
}

describe('queries/users.list — el conjunto base, `email` y los dos campos que no se exponen', () => {
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

  it('TS-28 · el conjunto base son CINCO campos exactos', async () => {
    const reply: any = await dispatchQuery('users.list', { filter: { id: Q_INTERNAL } });

    reply.status.should.equal('success');
    Object.keys(reply.data.items[0]).should.deepEqual([
      'id',
      'name',
      'username',
      'createdAt',
      'updatedAt',
    ]);
  });

  it('TS-29 · CA-6 · `email` filtra SIN aparecer en la respuesta', async () => {
    const reply: any = await dispatchQuery('users.list', {
      filter: { email: 'q-user@test.local' },
    });

    ids(reply).should.deepEqual([Q_INTERNAL]);
    reply.data.items[0].should.not.have.property('email');
  });

  it('TS-30 · CA-6 · con `include: ["email"]` sí viaja', async () => {
    const reply: any = await dispatchQuery('users.list', {
      filter: { id: Q_INTERNAL },
      include: ['email'],
    });

    reply.data.items[0].email.should.equal('q-user@test.local');
  });

  it('TS-31 · CA-7 · `roles` no es campo', async () => {
    const reply: any = await dispatchQuery('users.list', { fields: ['id', 'roles'] });

    reply.status.should.equal('failure');
    reply.errorCode.should.equal('invalid_fields');
    reply.errorDetails.field.should.equal('fields');
    reply.errorDetails.value.should.equal('roles');
    reply.errorDetails.allowed.should.not.containEql('roles');
    reply.errorDetails.allowed.should.not.containEql('identityType');
  });

  it('TS-32 · CA-7 · `roles` no es filtro', async () => {
    const reply: any = await dispatchQuery('users.list', { filter: { roles: ['admin'] } });

    reply.status.should.equal('failure');
    reply.errorCode.should.equal('invalid_fields');
    reply.errorDetails.field.should.equal('filter');
    reply.errorDetails.allowed.should.deepEqual(['id', 'username', 'email', 'q']);
  });

  it('TS-33 · CA-7 · `identityType` no es ni filtro ni incluible ni ordenable', async () => {
    const asFilter: any = await dispatchQuery('users.list', {
      filter: { identityType: 'person' },
    });
    asFilter.errorCode.should.equal('invalid_fields');
    asFilter.errorDetails.field.should.equal('filter');

    const asInclude: any = await dispatchQuery('users.list', { include: ['identityType'] });
    asInclude.errorCode.should.equal('invalid_fields');
    asInclude.errorDetails.field.should.equal('include');

    const asSort: any = await dispatchQuery('users.list', { sort: ['identityType'] });
    asSort.errorCode.should.equal('invalid_fields');
    asSort.errorDetails.field.should.equal('sort');
  });

  it('TS-34 · `include: ["person"]` trae los tres campos, y `null` si no hay persona', async () => {
    const reply: any = await dispatchQuery('users.list', {
      filter: { id: [Q_INTERNAL, USER_SERVICE] },
      include: ['person'],
    });

    const byId = new Map(reply.data.items.map((item: any) => [item.id, item]));
    (byId.get(Q_INTERNAL) as any).person.should.deepEqual({
      id: PERSON_LINKED,
      firstName: 'Carla',
      lastName: 'Benítez',
    });
    // La identidad de servicio no tiene fila en `people`: es la regla de dominio, no un error.
    (byId.get(USER_SERVICE) as any).should.have.property('person', null);
  });

  it('TS-35 · `filter.q` busca en `name`, `username` Y `email`', async () => {
    const byUsername: any = await dispatchQuery('users.list', { filter: { q: 'q-admin' } });
    ids(byUsername).should.deepEqual([Q_ADMIN]);

    const byName: any = await dispatchQuery('users.list', { filter: { q: 'Interna' } });
    // `Interna` matchea el `name` de `Q_INTERNAL`; `Externa Sola` no lo contiene.
    ids(byName).should.deepEqual([Q_INTERNAL]);
  });

  it('TS-36 · el sort default es `["name"]` y lo ordenable son dos nombres', async () => {
    const ok: any = await dispatchQuery('users.list', { sort: ['username'] });
    ok.status.should.equal('success');

    const bad: any = await dispatchQuery('users.list', { sort: ['createdAt'] });
    bad.errorCode.should.equal('invalid_fields');
    bad.errorDetails.allowed.should.deepEqual(['name', 'username']);
  });
});

describe('queries/users.list — el recorte externo y la cláusula "más él mismo"', () => {
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

  it('TS-37 · CA-13 · son los usuarios con permiso sobre proyectos que el caller ve', async () => {
    const reply: any = await dispatchQuery('users.list', {}, Q_EXTERNAL);

    reply.status.should.equal('success');
    ids(reply).sort().should.deepEqual([Q_EXTERNAL, Q_MIXED].sort());
    ids(reply).should.not.containEql(CREATOR);
    ids(reply).should.not.containEql(Q_INTERNAL);
    ids(reply).should.not.containEql(USER_SERVICE);
  });

  it('TS-38 · CA-14 · un externo SIN NINGÚN permiso se ve A SÍ MISMO', async () => {
    const reply: any = await dispatchQuery('users.list', {}, Q_LONELY);

    // EXACTAMENTE UNA FILA, LA PROPIA. Si sale `[]`, falta la cláusula "más él mismo" y un cliente
    // recién dado de alta no puede ni resolver su propio nombre.
    ids(reply).should.deepEqual([Q_LONELY]);
  });

  it('TS-39 · CA-14 · la cláusula propia CONVIVE con el `EXISTS`, no lo reemplaza ni duplica', async () => {
    const reply: any = await dispatchQuery('users.list', { count: true }, Q_EXTERNAL);

    // El caller Y el otro usuario con permiso sobre el 12, sin duplicar al caller.
    reply.data.page.total.should.equal(2);
  });

  it('TS-40 · el filtro NO desactiva el recorte', async () => {
    const reply: any = await dispatchQuery('users.list', { filter: { id: CREATOR } }, Q_EXTERNAL);

    reply.status.should.equal('success');
    reply.data.items.should.deepEqual([]);
  });
});
