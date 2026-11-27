import 'mocha';
import 'should';
import sinon from 'sinon';
import { User } from '@jiku/models';
import { readDb } from '../../src/models/read';
import { dispatchQuery } from '../helpers/dispatch';
import {
  CREATOR,
  Q_ADMIN,
  Q_CONNECTOR,
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
 *   CA-7  · `roles` e `identityType` NO SE EXPONEN A PERSONAS (internas ni externas), en las cuatro
 *           palancas a la vez. No hay código que los excluya: la protección es NO DECLARARLOS para
 *           su clase (ADR-008). Para el CONECTOR son solo incluibles (S-086, al final del archivo).
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
    const reply: any = await dispatchQuery('users.list', { fields: ['id', 'roles'] }, Q_INTERNAL);

    reply.status.should.equal('failure');
    reply.errorCode.should.equal('invalid_fields');
    reply.errorDetails.field.should.equal('fields');
    reply.errorDetails.value.should.equal('roles');
    reply.errorDetails.allowed.should.not.containEql('roles');
    reply.errorDetails.allowed.should.not.containEql('identityType');
  });

  it('TS-32 · CA-7 · `roles` no es filtro', async () => {
    const reply: any = await dispatchQuery('users.list', { filter: { roles: ['admin'] } }, Q_INTERNAL);

    reply.status.should.equal('failure');
    reply.errorCode.should.equal('invalid_fields');
    reply.errorDetails.field.should.equal('filter');
    reply.errorDetails.allowed.should.deepEqual(['id', 'username', 'email', 'q']);
  });

  it('TS-33 · CA-7 · `identityType` no es ni filtro ni incluible ni ordenable', async () => {
    const asFilter: any = await dispatchQuery(
      'users.list',
      { filter: { identityType: 'person' } },
      Q_INTERNAL
    );
    asFilter.errorCode.should.equal('invalid_fields');
    asFilter.errorDetails.field.should.equal('filter');

    const asInclude: any = await dispatchQuery('users.list', { include: ['identityType'] }, Q_INTERNAL);
    asInclude.errorCode.should.equal('invalid_fields');
    asInclude.errorDetails.field.should.equal('include');

    const asSort: any = await dispatchQuery('users.list', { sort: ['identityType'] }, Q_INTERNAL);
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

const DOCS_USERS = 'sub-q-docs-users';
const ALLOWED_PERSON = ['email', 'person'];

describe('queries/users.list — incluibles por clase (S-086)', () => {
  before(async () => {
    await createWorld();
    await createQueryCallers();
    await createTeamWorld();
    await User.create({
      id: DOCS_USERS,
      name: 'jiku-docs',
      username: 'q-docs-users',
      email: null,
      roles: ['internal-app', 'docs'],
      identityType: 'service',
    } as any);
  });

  after(async () => {
    await User.destroy({ where: { id: DOCS_USERS } });
    await destroyTeamWorld();
    await destroyQueryCallers();
    await destroyWorld();
  });

  afterEach(() => sinon.restore());

  const asConnector = (payload: any, caller = DOCS_USERS): Promise<any> =>
    dispatchQuery('users.list', payload, caller) as Promise<any>;

  describe('conector', () => {
    it('TS-1 · jiku-docs ([internal-app, docs]) recibe roles e identityType', async () => {
      const reply = await asConnector({ filter: { id: [Q_INTERNAL] }, include: ['roles', 'identityType'] });

      reply.status.should.equal('success');
      reply.data.items.length.should.equal(1);
      reply.data.items[0].id.should.equal(Q_INTERNAL);
      reply.data.items[0].roles.should.deepEqual(['user']);
      reply.data.items[0].identityType.should.equal('person');
      Object.keys(reply.data.items[0]).sort().should.deepEqual([
        'createdAt', 'id', 'identityType', 'name', 'roles', 'updatedAt', 'username',
      ]);
    });

    it('TS-2 · un conector con solo internal-app también los recibe', async () => {
      const reply = await asConnector(
        { filter: { id: [Q_INTERNAL] }, include: ['roles', 'identityType'] },
        Q_CONNECTOR
      );

      reply.status.should.equal('success');
      reply.data.items[0].roles.should.deepEqual(['user']);
      reply.data.items[0].identityType.should.equal('person');
    });

    it('TS-3 · el publicador confiable (api) también es conector', async () => {
      const reply: any = await dispatchQuery('users.list', {
        filter: { id: [Q_ADMIN] },
        include: ['roles'],
      });

      reply.status.should.equal('success');
      reply.data.items[0].roles.should.deepEqual(['admin']);
      reply.data.items[0].should.not.have.property('identityType');
    });

    it('TS-4 · identidad de servicio y roles desconocidos viajan tal cual', async () => {
      const reply = await asConnector({
        filter: { id: [DOCS_USERS, USER_SERVICE] },
        include: ['roles', 'identityType'],
      });

      reply.status.should.equal('success');
      const byId = new Map(reply.data.items.map((item: any) => [item.id, item]));
      const docs: any = byId.get(DOCS_USERS);
      docs.roles.should.deepEqual(['internal-app', 'docs']);
      docs.identityType.should.equal('service');
      const svc: any = byId.get(USER_SERVICE);
      svc.roles.should.deepEqual(['internal-app']);
      svc.identityType.should.equal('service');
    });

    it('TS-5 · el conector puede nombrarlos en `fields`', async () => {
      const reply = await asConnector({ filter: { id: [Q_INTERNAL] }, fields: ['id', 'roles'] });

      reply.status.should.equal('success');
      Object.keys(reply.data.items[0]).sort().should.deepEqual(['id', 'roles']);
      reply.data.items[0].roles.should.deepEqual(['user']);
    });

    it('TS-6 · con `include` inválido ve los cuatro incluibles en `allowed`', async () => {
      const reply = await asConnector({ include: ['nope'] });

      reply.status.should.equal('failure');
      reply.errorCode.should.equal('invalid_fields');
      reply.errorDetails.field.should.equal('include');
      reply.errorDetails.allowed.should.deepEqual(['email', 'person', 'roles', 'identityType']);
    });

    it('TS-7 · se combinan con los incluibles comunes', async () => {
      const reply = await asConnector({
        filter: { id: [Q_INTERNAL] },
        include: ['email', 'person', 'roles'],
      });

      reply.status.should.equal('success');
      reply.data.items[0].email.should.equal('q-user@test.local');
      reply.data.items[0].should.have.property('person');
      reply.data.items[0].roles.should.deepEqual(['user']);
    });

    it('TS-16 · el SQL del conector sí nombra las columnas', async () => {
      const spy = sinon.spy(readDb, 'query');
      const reply = await asConnector({ filter: { id: [Q_INTERNAL] }, include: ['roles', 'identityType'] });

      reply.status.should.equal('success');
      const sqls = spy.getCalls().map((c) => String(c.args[0]));
      sqls.some((q) => q.includes('t.roles AS "roles"')).should.equal(true);
      sqls.some((q) => q.includes('t.identity_type AS "identityType"')).should.equal(true);
    });
  });

  describe('personas', () => {
    it('TS-8 · interna (user) pide `roles` en include', async () => {
      const reply = await asConnector({ include: ['roles'] }, Q_INTERNAL);

      reply.status.should.equal('failure');
      reply.errorCode.should.equal('invalid_fields');
      reply.errorDetails.field.should.equal('include');
      reply.errorDetails.value.should.equal('roles');
      reply.errorDetails.allowed.should.deepEqual(ALLOWED_PERSON);
    });

    it('TS-9 · interna (admin) pide `identityType` en include', async () => {
      const reply = await asConnector({ include: ['identityType'] }, Q_ADMIN);

      reply.errorCode.should.equal('invalid_fields');
      reply.errorDetails.field.should.equal('include');
      reply.errorDetails.allowed.should.deepEqual(ALLOWED_PERSON);
    });

    it('TS-10 · el rechazo es idéntico al de un nombre inexistente', async () => {
      const a = await asConnector({ include: ['roles'] }, Q_INTERNAL);
      const b = await asConnector({ include: ['inexistente'] }, Q_INTERNAL);

      a.errorCode.should.equal('invalid_fields');
      b.errorCode.should.equal('invalid_fields');
      a.errorDetails.field.should.equal(b.errorDetails.field);
      a.errorDetails.allowed.should.deepEqual(b.errorDetails.allowed);
      a.errorMessage.should.equal(b.errorMessage.replace('inexistente', 'roles'));
    });

    it('TS-12 · externa pide los dos', async () => {
      const reply = await asConnector({ include: ['roles', 'identityType'] }, Q_EXTERNAL);

      reply.errorCode.should.equal('invalid_fields');
      reply.errorDetails.field.should.equal('include');
      reply.errorDetails.allowed.should.deepEqual(ALLOWED_PERSON);
    });

    it('TS-13 · externa en `fields`', async () => {
      const reply = await asConnector({ fields: ['id', 'identityType'] }, Q_EXTERNAL);

      reply.errorCode.should.equal('invalid_fields');
      reply.errorDetails.field.should.equal('fields');
      reply.errorDetails.value.should.equal('identityType');
    });

    it('TS-23 · externa: `sort: ["roles"]`', async () => {
      const reply = await asConnector({ sort: ['roles'] }, Q_EXTERNAL);

      reply.errorCode.should.equal('invalid_fields');
      reply.errorDetails.field.should.equal('sort');
    });

    it('TS-14 · el SQL de una persona no nombra las columnas', async () => {
      const spy = sinon.spy(readDb, 'query');
      const reply = await asConnector({ filter: { id: [Q_INTERNAL] }, include: ['email', 'person'] }, Q_INTERNAL);

      reply.status.should.equal('success');
      const sqls = spy.getCalls().map((c) => String(c.args[0]));
      sqls.length.should.be.above(0);
      sqls.forEach((q) => {
        q.should.not.containEql('t.roles');
        q.should.not.containEql('identity_type');
      });
    });

    it('TS-15 · la persona que pide `roles` no llega a la base', async () => {
      const spy = sinon.spy(readDb, 'query');
      const reply = await asConnector({ include: ['roles'] }, Q_INTERNAL);

      reply.errorCode.should.equal('invalid_fields');
      spy.called.should.equal(false);
    });

    it('TS-22 · interna: `identityType` no es filtro, incluible ni ordenable', async () => {
      const f = await asConnector({ filter: { identityType: 'person' } }, Q_INTERNAL);
      const i = await asConnector({ include: ['identityType'] }, Q_INTERNAL);
      const o = await asConnector({ sort: ['identityType'] }, Q_INTERNAL);

      [f, i, o].forEach((r) => r.errorCode.should.equal('invalid_fields'));
      [f.errorDetails.field, i.errorDetails.field, o.errorDetails.field].should.deepEqual([
        'filter', 'include', 'sort',
      ]);
    });
  });

  describe('filtro y orden — cualquier clase', () => {
    it('TS-17 · el conector no filtra por `roles`', async () => {
      const reply = await asConnector({ filter: { roles: ['admin'] } });

      reply.errorCode.should.equal('invalid_fields');
      reply.errorDetails.field.should.equal('filter');
      reply.errorDetails.allowed.should.deepEqual(['id', 'username', 'email', 'q']);
    });

    it('TS-18 · el conector no filtra por `identityType`', async () => {
      const reply = await asConnector({ filter: { identityType: 'person' } });

      reply.errorCode.should.equal('invalid_fields');
      reply.errorDetails.field.should.equal('filter');
      reply.errorDetails.allowed.should.deepEqual(['id', 'username', 'email', 'q']);
    });

    it('TS-19 · el conector no ordena por `roles`', async () => {
      const reply = await asConnector({ sort: ['roles'] });

      reply.errorCode.should.equal('invalid_fields');
      reply.errorDetails.field.should.equal('sort');
      reply.errorDetails.allowed.should.deepEqual(['name', 'username']);
    });

    it('TS-20 · el conector no ordena por `-identityType`', async () => {
      const reply = await asConnector({ sort: ['-identityType'] });

      reply.errorCode.should.equal('invalid_fields');
      reply.errorDetails.field.should.equal('sort');
    });

    it('TS-24 · `q` no busca en roles', async () => {
      const reply = await asConnector({ filter: { q: 'internal-app' }, include: ['roles'] });

      reply.status.should.equal('success');
      const found = ids(reply);
      found.should.not.containEql(Q_CONNECTOR);
      found.should.not.containEql(USER_SERVICE);
    });
  });
});
