import 'mocha';
import 'should';
import { dispatchQuery } from '../helpers/dispatch';
import {
  PROJECT_MAIN,
  PROJECT_OTHER,
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
  PERSON_UNASSIGNED,
  Q_LONELY,
  createTeamWorld,
  destroyTeamWorld,
} from './team-fixtures';

/**
 * LA MATRIZ CLASE × RECURSO DEL RECORTE EXTERNO (S-026, Task 9).
 *
 * Lo que este archivo agrega y NO se ve en el archivo de cada recurso: los seis JUNTOS, contra las
 * tres clases de caller. Es donde se verifica de un vistazo que
 *
 *   - un caller INTERNO no recorta en NINGUNO de los seis (RF-23), y en esta story es donde más se
 *     nota: ve las horas y las ausencias de todo el equipo;
 *   - los tres recursos de tiempo devuelven `items: []` a un externo y filas a un interno;
 *   - los otros tres recortan por proyecto permitido, con la cláusula propia solo en `users`.
 */

/** Los seis, y qué se espera de cada uno en clase EXTERNA. */
const EXTERNAL_EMPTY = ['worked-times.list', 'unworked-times.list', 'week-assigned-times.list'];
const EXTERNAL_SCOPED = ['people.list', 'users.list', 'project-permissions.list'];
const ALL_SIX = [...EXTERNAL_SCOPED, ...EXTERNAL_EMPTY];

describe('queries/S-026 — la matriz clase × recurso del recorte externo', () => {
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

  it('los TRES recursos de tiempo devuelven `items: []` a CUALQUIER caller externo', async () => {
    // `Q_MIXED` tiene `['user','external-user']`: GANA EL MÁS RESTRICTIVO, así que su clase es
    // EXTERNA aunque también sea `user`.
    for (const caller of [Q_EXTERNAL, Q_MIXED, Q_LONELY]) {
      for (const method of EXTERNAL_EMPTY) {
        const reply: any = await dispatchQuery(method, {}, caller);
        const label = `${method} · ${caller}`;

        reply.status.should.equal('success', `${label}: ${JSON.stringify(reply)}`);
        reply.data.items.should.deepEqual([], label);
      }
    }
  });

  it('RF-23 · un caller INTERNO no recorta en NINGUNO de los seis', async () => {
    for (const caller of [Q_INTERNAL, Q_ADMIN]) {
      for (const method of ALL_SIX) {
        const reply: any = await dispatchQuery(method, { count: 'only' }, caller);
        const label = `${method} · ${caller}`;

        reply.status.should.equal('success', `${label}: ${JSON.stringify(reply)}`);
        // Es la decisión explícita de la v1: el modo interno ve horas y ausencias de TODO el equipo.
        reply.data.page.total.should.be.above(0, label);
      }
    }
  });

  it('la clase CONECTOR tampoco recorta: el caller autoriza por su cuenta', async () => {
    // `Q_CONNECTOR` tiene `internal-app` SIN ser el publicador confiable, y ESO YA NO LO CORTA:
    // el rol pasó a autorizar los dos planos completos, así que atraviesa la compuerta 1, la 2
    // le resuelve la clase `connector` y llega a la consulta.
    //
    // ES EL ENSANCHAMIENTO MÁS SERIO DEL CAMBIO, y por eso se afirma sobre los SEIS recursos:
    // `worked-times`, `unworked-times` y `week-assigned-times` declaran "sin acceso externo" —a
    // un caller externo le devuelven `items: []` sin ejecutar SQL— y un conector los ve
    // ENTEROS. Horas, ausencias y planificación de capacidad de todo el equipo.
    for (const method of ALL_SIX) {
      const reply: any = await dispatchQuery(method, { count: 'only' }, Q_CONNECTOR);
      reply.status.should.equal('success', `${method}: ${JSON.stringify(reply)}`);
      reply.data.page.total.should.be.above(0, method);
    }

    // Y el publicador confiable —el caller por defecto de `dispatchQuery`— sigue igual: la
    // exención del `sub` lo lleva a la misma clase por otro camino.
    for (const method of ALL_SIX) {
      const reply: any = await dispatchQuery(method, { count: 'only' });
      reply.data.page.total.should.be.above(0, method);
    }
  });

  it('los tres recursos con recorte por proyecto lo aplican ANTES del filtro', async () => {
    // `people`: la persona sin asignación no entra ni pidiéndola por id.
    const person: any = await dispatchQuery(
      'people.list',
      { filter: { id: PERSON_UNASSIGNED } },
      Q_EXTERNAL
    );
    person.data.items.should.deepEqual([]);

    // `users`: el usuario de otro proyecto tampoco.
    const user: any = await dispatchQuery('users.list', { filter: { id: Q_INTERNAL } }, Q_EXTERNAL);
    user.data.items.should.deepEqual([]);

    // `project-permissions`: todas las filas visibles son del proyecto permitido, Y EXISTE UNA DEL
    // 13 que se está dejando afuera —sin ella la aserción de arriba sería vacía—.
    const unclipped: any = await dispatchQuery('project-permissions.list', {});
    unclipped.data.items
      .map((item: any) => item.projectId)
      .should.containEql(PROJECT_OTHER);

    const permissions: any = await dispatchQuery('project-permissions.list', {}, Q_EXTERNAL);
    permissions.data.items.length.should.be.above(0);
    permissions.data.items.forEach((item: any) => item.projectId.should.equal(PROJECT_MAIN));
  });

  it('CA-14 · `users` es el ÚNICO de los seis cuyo recorte incluye al propio caller', async () => {
    // El caller SIN NINGÚN permiso se ve a sí mismo en `users`…
    const users: any = await dispatchQuery('users.list', {}, Q_LONELY);
    users.data.items.map((item: any) => item.id).should.deepEqual([Q_LONELY]);

    // …y NO ve nada en los otros dos recursos con recorte por proyecto: la cláusula propia es de
    // `users` y no una regla general. `people` recorta por asignación y `project-permissions` por
    // proyecto permitido, y `Q_LONELY` no tiene ninguno de los dos.
    const people: any = await dispatchQuery('people.list', {}, Q_LONELY);
    people.data.items.should.deepEqual([]);

    const permissions: any = await dispatchQuery('project-permissions.list', {}, Q_LONELY);
    permissions.data.items.should.deepEqual([]);
  });

  it('el recorte NO se puede desactivar por payload, en ninguno de los seis', async () => {
    // Ni una clave de identidad de primer nivel, que es la forma que el instinto busca primero.
    for (const method of ALL_SIX) {
      const reply: any = await dispatchQuery(method, { callerId: Q_INTERNAL }, Q_EXTERNAL);

      reply.status.should.equal('failure', method);
      reply.errorCode.should.equal('invalid_fields', method);
      reply.errorMessage.should.containEql('quién pregunta sale del subject');
    }
  });

  it('el recorte de los tres recursos de tiempo NO afecta a la clase interna en el mismo mundo', async () => {
    // El contraste completo, en una sola aserción: MISMO payload, MISMO mundo, DOS clases.
    const external: any = await dispatchQuery(
      'worked-times.list',
      { filter: { personId: PERSON_LINKED } },
      Q_EXTERNAL
    );
    const internal: any = await dispatchQuery(
      'worked-times.list',
      { filter: { personId: PERSON_LINKED } },
      Q_INTERNAL
    );

    external.data.items.should.deepEqual([]);
    internal.data.items.length.should.equal(3);
  });
});
