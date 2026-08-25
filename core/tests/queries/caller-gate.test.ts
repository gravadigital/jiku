import 'mocha';
import 'should';
import * as sinon from 'sinon';
import { User } from '@jiku/models';
import { ErrorCode } from '@jiku/nats-protocol';
import { getTrustedPublisherId } from '../../src/config';
import logger from '../../src/logger';
import { sequelize } from '../../src/models';
import { dispatchQuery } from '../helpers/dispatch';
import {
  PROJECT_MAIN,
  Q_CONNECTOR,
  Q_EMPTY,
  Q_EXTERNAL,
  Q_INTERNAL,
  Q_NO_ROW,
  createQueryCallers,
  createTasks,
  createWorld,
  destroyQueryCallers,
  destroyWorld,
  grantProjects,
} from './task-fixtures';

/**
 * LAS DOS COMPUERTAS DEL PLANO DE CONSULTAS, y el único `SELECT` que las alimenta.
 *
 *   1. `authorizeWithRoles` -> "¿puede ejecutar este método?" -> `caller_not_authorized` (S-017)
 *   2. `resolveCallerClass` -> "¿qué le recorto?"             -> `unknown_caller`        (S-023)
 *
 * Existen las dos, en ese orden, y ninguna sustituye a la otra: la primera tiene la exención del
 * `CORE_TRUSTED_PUBLISHER_ID` intacta y la segunda NO EXIME A NADIE, la api incluida.
 *
 * Se entra por `dispatchQuery()` contra la base real, como manda la convención `testing`.
 */
describe('queries · las dos compuertas y el único lookup (S-023)', () => {
  // Se resuelve EN EL `before` y no al cargar el archivo: `getTrustedPublisherId()` lanza si
  // `loadConfig()` todavía no corrió, y quien lo corre es el `mochaGlobalSetup` de
  // `tests/global-setup.ts`, o sea DESPUÉS de que Mocha cargó los archivos de test.
  let TRUSTED: string;

  before(async () => {
    TRUSTED = getTrustedPublisherId();
    await createWorld([PROJECT_MAIN]);
    await createQueryCallers();
    await grantProjects(Q_EXTERNAL, [PROJECT_MAIN]);
    await createTasks([
      { id: 9101, title: 'Visible', visibilityLevel: 'public', projectId: PROJECT_MAIN },
      { id: 9102, title: 'Interna', visibilityLevel: 'internal', projectId: PROJECT_MAIN },
    ]);
  });

  after(async () => {
    await destroyQueryCallers();
    await destroyWorld();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('TS-10 · un caller interno consulta y se lee `users` UNA SOLA vez', async () => {
    const findByPk = sinon.spy(User, 'findByPk');

    const reply = await dispatchQuery('tasks.list', {}, Q_INTERNAL);

    reply.status.should.equal('success');
    // Las DOS compuertas comen del MISMO `roles`: implementado ingenuamente serían dos lecturas.
    findByPk.callCount.should.equal(1);
  });

  it('TS-11 · el caller EXENTO con fila también paga un solo `SELECT`', async () => {
    const findByPk = sinon.spy(User, 'findByPk');

    const reply = await dispatchQuery('tasks.list', {});

    reply.status.should.equal('success');
    // UNO, no cero: en consultas la exención de la compuerta 1 no exime de la LECTURA, porque la
    // clase la necesita todo caller (CA-8). Es la asimetría deliberada con el plano de comandos,
    // donde el exento sigue sin tocar la base (TS-33 de S-017, intacto).
    findByPk.callCount.should.equal(1);
  });

  it('TS-12 · CA-8/CA-9: la api SIN fila pasa la compuerta 1 y FALLA la 2', async () => {
    await User.destroy({ where: { id: TRUSTED } });
    try {
      const reply = await dispatchQuery('tasks.list', {});

      // NUNCA `items: []`: una lista vacía por falta de identidad es un fallo abierto disfrazado
      // de dato, y se debuggea durante horas.
      reply.should.deepEqual({
        status: 'failure',
        errorCode: 'unknown_caller',
        errorMessage: 'No se pudo resolver la identidad del caller',
      });
    } finally {
      await User.create({
        id: TRUSTED,
        name: 'Api',
        username: 'api-queries',
        email: 'api-queries@test.local',
        roles: ['internal-app'],
      });
    }
  });

  it('TS-13 · la compuerta 1 ENSOMBRECE a la 2 para todo caller no exento', async () => {
    const vacio = await dispatchQuery('tasks.list', {}, Q_EMPTY);
    const sinFila = await dispatchQuery('tasks.list', {}, Q_NO_ROW);

    // Los roles con `queries: ALL` son `internal-app`, `admin`, `user` y `external-user`, y los
    // cuatro TIENEN clase: un caller sin roles útiles muere antes, en la compuerta 1.
    vacio.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
    sinFila.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
    vacio.errorCode!.should.not.equal(ErrorCode.UNKNOWN_CALLER);
    sinFila.errorCode!.should.not.equal(ErrorCode.UNKNOWN_CALLER);
  });

  it('TS-14 · un `internal-app` que NO es el exento SÍ consulta, y en clase conector', async () => {
    const reply = await dispatchQuery('tasks.list', {}, Q_CONNECTOR);

    // ESTE TEST AFIRMABA LO CONTRARIO. `ROLE_METHODS['internal-app'].queries` era `[]`, así que
    // un segundo conector se comía un `caller_not_authorized` en la compuerta 1 y NUNCA llegaba
    // a la 2. Ahora pasa las dos y aterriza en la clase `connector`.
    //
    // LA CONSECUENCIA A TENER PRESENTE: `connector` NO RECORTA NINGUNA FILA. Cualquier identidad
    // con este rol lee los 16 recursos completos — proyectos, requisitos, horas — sin el recorte
    // del modo externo. Es el precio de haberlo hecho el rol de conector.
    reply.status.should.equal('success');
    (reply.errorCode === ErrorCode.CALLER_NOT_AUTHORIZED).should.be.false();
    (reply.errorCode === ErrorCode.UNKNOWN_CALLER).should.be.false();
  });

  it('TS-15 · un `roles` que NO es array falla CERRADA en la compuerta 2', async () => {
    // La columna es JSONB sin CHECK y la tabla es escribible por SQL: el caso es alcanzable.
    await sequelize.query(`UPDATE users SET roles = '{"a":1}'::jsonb WHERE id = :id`, {
      replacements: { id: TRUSTED },
    });
    try {
      const reply = await dispatchQuery('tasks.list', {});

      reply.errorCode!.should.equal(ErrorCode.UNKNOWN_CALLER);
      reply.errorCode!.should.not.equal(ErrorCode.INTERNAL_ERROR);
      reply.status.should.not.equal('success');
    } finally {
      await User.update({ roles: ['internal-app'] }, { where: { id: TRUSTED } });
    }
  });

  it('TS-16 · el mensaje de `unknown_caller` NO es un oráculo de identidad', async () => {
    await User.destroy({ where: { id: TRUSTED } });
    try {
      const reply = await dispatchQuery('tasks.list', {});
      const message = reply.errorMessage!;

      // Ni el caller, ni el subject, ni el método, ni el nombre de la tabla, ni si la fila existe.
      message.should.not.containEql(TRUSTED);
      message.should.not.containEql('tasks.list');
      message.should.not.containEql('users');
      message.should.not.containEql('jiku-queries');
      // Y DISTINTO del de la compuerta 1, a propósito: son dos códigos y dos causas.
      message.should.not.equal('El caller no está autorizado a ejecutar este método');
      // En español (convención `error-handling`).
      message.should.equal('No se pudo resolver la identidad del caller');
    } finally {
      await User.create({
        id: TRUSTED,
        name: 'Api',
        username: 'api-queries',
        email: 'api-queries@test.local',
        roles: ['internal-app'],
      });
    }
  });

  it('el rechazo por `unknown_caller` loguea UN warn con el caller y el método, sin payload', async () => {
    const warn = sinon.spy(logger, 'warn');
    await User.destroy({ where: { id: TRUSTED } });
    try {
      await dispatchQuery('tasks.list', { filter: { q: 'SECRETO' } });

      // `warn` y no `error`: es entrada que el servicio maneja bien, y un `failure` no es un error.
      warn.callCount.should.equal(1);
      const message = String(warn.firstCall.args[0]);
      message.should.startWith('[auth]');
      message.should.containEql(TRUSTED);
      message.should.containEql('tasks.list');
      // El payload NUNCA se loguea.
      message.should.not.containEql('SECRETO');
    } finally {
      await User.create({
        id: TRUSTED,
        name: 'Api',
        username: 'api-queries',
        email: 'api-queries@test.local',
        roles: ['internal-app'],
      });
    }
  });

  it('el camino RESUELTO no loguea nada', async () => {
    const warn = sinon.spy(logger, 'warn');
    const error = sinon.spy(logger, 'error');

    const reply = await dispatchQuery('tasks.list', {}, Q_INTERNAL);

    reply.status.should.equal('success');
    warn.called.should.be.false();
    error.called.should.be.false();
  });

  it('TS-18 · CA-4: NINGUNA ficha vuelve a consultar `users`', async () => {
    const findByPk = sinon.spy(User, 'findByPk');

    const reply = await dispatchQuery(
      'tasks.list',
      {
        include: [
          'description',
          'project',
          'requirement',
          'responsiblePersons',
          'comments',
          'subscriptors',
        ],
        count: true,
      },
      Q_EXTERNAL
    );

    reply.status.should.equal('success');
    // Cuatro consultas SQL o más las dispara el `include`, y ninguna es a `users`: la clase ya
    // viajó en el contexto.
    findByPk.callCount.should.equal(1);
  });

  it('TS-19 · CA-17: sin cache — dos requests hacen dos lookups', async () => {
    const findByPk = sinon.spy(User, 'findByPk');

    await dispatchQuery('tasks.list', {}, Q_INTERNAL);
    await dispatchQuery('tasks.list', {}, Q_INTERNAL);

    // Cachear reintroduciría los roles obsoletos con una ventana adicional y no medible, para
    // ahorrar un SELECT por PK contra una tabla de decenas de filas.
    findByPk.callCount.should.equal(2);
  });

  it('TS-20 · si el lookup falla, se DENIEGA con internal_error y no escapa nada', async () => {
    const error = sinon.spy(logger, 'error');
    sinon.stub(User, 'findByPk').rejects(new Error('pool agotado'));

    // Resuelve, no rechaza: el stack NO cruza el bus (ADR-003).
    const reply = await dispatchQuery('tasks.list', {}, Q_INTERNAL);

    reply.should.deepEqual({
      status: 'failure',
      errorCode: 'internal_error',
      errorMessage: 'Internal error',
    });
    error.callCount.should.equal(1);
    // `[auth]` y no `[query]`: es un fallo de la compuerta, no de la consulta, y eso es lo que
    // mantiene grepeable "todo rechazo de autorización de los dos planos" con una sola línea.
    String(error.firstCall.args[0]).should.startWith('[auth]');
  });

  it('TS-21 · CA-1: la identidad NO se acepta por payload, en `list` ni en `get`', async () => {
    const list = await dispatchQuery('tasks.list', { filter: { userId: 'otro-sub' } }, Q_EXTERNAL);
    const get = await dispatchQuery('tasks.get', { id: 9101, caller: 'otro-sub' }, Q_EXTERNAL);

    // El caller sale del SEGUNDO TOKEN DEL SUBJECT y de ningún otro lugar: el auth-callout solo
    // autoriza a publicar bajo el id propio (ADR-007), así que ese token es infalsificable.
    list.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    get.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
  });
});
