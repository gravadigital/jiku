import 'mocha';
import 'should';
import { Person, Project, User, WeekAssignedTime } from '@jiku/models';
import { ErrorCode, Reply } from '@jiku/nats-protocol';
import { rolesAuthorize } from '../../src/authorize-caller';
import { COMMAND_ENTITY } from '../../src/entity-project';
import { dispatch } from '../helpers/dispatch';
import { LUNES, LUNES_ANTERIOR } from '../helpers/dates';

/**
 * C-38 · SOLO `admin` EDITA LA GRILLA, y lo decide EL MAPA, no el comando (CA-3, CA-12).
 *
 * LA REGLA NO DEPENDE DEL PAYLOAD: "solo `admin` edita la grilla" es una pregunta sobre el rol y
 * se responde ANTES de resolver el método y antes de abrir la transacción. Es el mismo corte que
 * S-030 estableció entre `caller_not_authorized` y `access_denied`.
 *
 * ARCHIVO APARTE del de comportamiento porque el juego de fixtures es otro: acá hacen falta filas
 * reales en `users` con sus roles, para el canal DIRECTO. Es el precedente de S-031.
 *
 * OJO CON EL DEFAULT DE `dispatch()`: sin sobre y sin caller explícito cae en el canal EXENTO
 * (publicador de confianza, `roles: []`) y la compuerta lo DEJA PASAR — o sea, un test de C-38 que
 * se olvide la identidad responde `success`, que es lo contrario de lo que afirma. Todos los tests
 * de acá pasan identidad EXPLÍCITAMENTE, siempre.
 */

/** Una persona con rol `user`, con fila real en `users`. */
const ANA = 'sub-s032-auth-ana';
/** Una persona con rol `admin`, con fila real en `users`. */
const BETO = 'sub-s032-auth-beto';
/** Una persona con rol `external-user`, con fila real en `users`. */
const CORA = 'sub-s032-auth-cora';
/** El dueño de los fixtures con FK a `users`. */
const OWNER = 'sub-s032-auth-owner';

/** El reply reducido a lo que CA-14 compara: la DECISIÓN, no la redacción. */
type Decision = [string, string | null];

function decision(reply: Reply<unknown>): Decision {
  return [reply.status, reply.errorCode ?? null];
}

describe('week-assigned-times.replace — C-38 y la paridad de canales (S-032)', () => {
  let PROJ_COM: number;
  let P_ANA: number;

  before(async () => {
    await User.bulkCreate([
      { id: OWNER, name: 'Owner', username: 's032a-owner', email: 's032a-owner@t.local' },
      {
        id: ANA, name: 'Ana', username: 's032a-ana',
        email: 's032a-ana@t.local', roles: ['user'],
      },
      {
        id: BETO, name: 'Beto', username: 's032a-beto',
        email: 's032a-beto@t.local', roles: ['admin'],
      },
      {
        id: CORA, name: 'Cora', username: 's032a-cora',
        email: 's032a-cora@t.local', roles: ['external-user'],
      },
    ]);

    const project = await Project.create({
      name: 'Proyecto S032 auth', code: 'S032A', status: 'activo', type: 'comercial',
      description: 'x', initDate: new Date(), createdBy: OWNER,
    });
    PROJ_COM = project.id;

    const ana = await Person.create({
      firstName: 'Ana', lastName: 'Auth', enabled: true,
      initDate: new Date('2026-01-01'), userId: ANA,
    });
    P_ANA = ana.id;
  });

  after(async () => {
    await WeekAssignedTime.destroy({ where: {} });
    await Person.destroy({ where: {} });
    await Project.destroy({ where: {} });
    await User.destroy({ where: { id: [OWNER, ANA, BETO, CORA] } });
  });

  afterEach(async () => {
    await WeekAssignedTime.destroy({ where: {} });
  });

  describe('el canal del SOBRE', () => {
    it('TS-28 · un `user` es rechazado por la COMPUERTA (CA-3, CA-12)', async () => {
      const reply = await dispatch('week-assigned-times.replace', {
        actor: { id: ANA, roles: ['user'] },
        dateFrom: LUNES,
        assignments: [],
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
      // NO SE ABRE TRANSACCIÓN NI SE TOCA LA GRILLA: la compuerta corre en el paso 4 del
      // despachador, antes de resolver el método.
      (await WeekAssignedTime.count({ where: { dateFrom: LUNES } })).should.equal(0);
    });

    it('TS-29 · un `admin` es aceptado (CA-3, CA-12)', async () => {
      const reply = await dispatch('week-assigned-times.replace', {
        actor: { id: BETO, roles: ['admin'] },
        dateFrom: LUNES,
        assignments: [{ projectId: PROJ_COM, personId: P_ANA, minutes: 60 }],
      });

      reply.status.should.equal('success');
      (await WeekAssignedTime.count({ where: { dateFrom: LUNES } })).should.equal(1);
    });
  });

  describe('el canal DIRECTO', () => {
    it('TS-30 · un `user` con fila en `users` es rechazado (CA-3, CA-12)', async () => {
      const reply = await dispatch(
        'week-assigned-times.replace',
        { dateFrom: LUNES, assignments: [] },
        ANA
      );

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
    });

    it('TS-31 · un `admin` publicando directo es aceptado (CA-3, CA-12)', async () => {
      const reply = await dispatch(
        'week-assigned-times.replace',
        { dateFrom: LUNES, assignments: [] },
        BETO
      );

      reply.status.should.equal('success');
    });
  });

  it('TS-32 · un `external-user` es rechazado por LOS DOS canales (CA-3, CA-12)', async () => {
    const sobre = await dispatch('week-assigned-times.replace', {
      actor: { id: CORA, roles: ['external-user'] },
      dateFrom: LUNES,
      assignments: [],
    });
    const directo = await dispatch(
      'week-assigned-times.replace',
      { dateFrom: LUNES, assignments: [] },
      CORA
    );

    for (const reply of [sobre, directo]) {
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
    }
  });

  describe('la matriz de paridad (CA-14)', () => {
    // EL CRITERIO DE COMPARABILIDAD: el `sub` tiene que ser EL MISMO y los roles LOS MISMOS de los
    // dos lados. Con sobre mandan `actor.roles` y no se lee la base; sin sobre salen de
    // `users.roles`. Se compara LA DECISIÓN, no la redacción.
    it('TS-33 · C-38 decide lo mismo por sobre y por directo', async () => {
      const userSobre = await dispatch('week-assigned-times.replace', {
        actor: { id: ANA, roles: ['user'] }, dateFrom: LUNES, assignments: [],
      });
      const userDirecto = await dispatch(
        'week-assigned-times.replace', { dateFrom: LUNES, assignments: [] }, ANA
      );

      decision(userSobre).should.deepEqual(decision(userDirecto));
      decision(userSobre).should.deepEqual(['failure', ErrorCode.CALLER_NOT_AUTHORIZED]);

      const adminSobre = await dispatch('week-assigned-times.replace', {
        actor: { id: BETO, roles: ['admin'] }, dateFrom: LUNES, assignments: [],
      });
      const adminDirecto = await dispatch(
        'week-assigned-times.replace', { dateFrom: LUNES, assignments: [] }, BETO
      );

      decision(adminSobre).should.deepEqual(decision(adminDirecto));
      decision(adminSobre).should.deepEqual(['success', null]);
    });

    it('TS-34 · C-36 decide lo mismo por sobre y por directo', async () => {
      const sobre = await dispatch('week-assigned-times.replace', {
        actor: { id: BETO, roles: ['admin'] }, dateFrom: LUNES_ANTERIOR, assignments: [],
      });
      const directo = await dispatch(
        'week-assigned-times.replace', { dateFrom: LUNES_ANTERIOR, assignments: [] }, BETO
      );

      decision(sobre).should.deepEqual(decision(directo));
      decision(sobre).should.deepEqual(['failure', ErrorCode.INVALID_DATE_RANGE]);
    });
  });

  describe('los gates de los dos mapas', () => {
    it('TS-37 · (gate) `ROLE_METHODS` da el comando 21 a `admin` y A NADIE MÁS (CA-12)', () => {
      for (const channel of ['direct', 'envelope'] as const) {
        rolesAuthorize(['admin'], 'week-assigned-times.replace', 'commands', channel)
          .should.be.true();
        // `internal-app` LO GANA SOLO, por el sentinela `'*'`. Es la otra mitad de CA-12, y ya
        // tiene su propio test como "el costo explícito del sentinela".
        rolesAuthorize(['internal-app'], 'week-assigned-times.replace', 'commands', channel)
          .should.be.true();

        for (const role of ['user', 'external-user', 'core', 'bus-observer']) {
          rolesAuthorize([role], 'week-assigned-times.replace', 'commands', channel)
            .should.be.false();
        }
      }
    });

    it('TS-38 · (gate) `COMMAND_ENTITY` declara el comando 21 con `null` EXPLÍCITO (H-3)', () => {
      // `null` ("no hay entidad que chequear: PASA") y AUSENTE ("DENIEGA") son dos cosas distintas:
      // la entrada existe porque ALGUIEN LA DECIDIÓ, no porque el default la haya tapado.
      ('week-assigned-times.replace' in COMMAND_ENTITY).should.be.true();
      (COMMAND_ENTITY['week-assigned-times.replace'] === null).should.be.true();
    });
  });
});
