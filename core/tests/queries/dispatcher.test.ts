import 'mocha';
import 'should';
import * as sinon from 'sinon';
import { Sequelize } from 'sequelize-typescript';
import { User } from '@jiku/models';
import { ErrorCode, Reply, failure, success } from '@jiku/nats-protocol';
import { sequelize } from '../../src/models';
import { readDb } from '../../src/models/read';
import logger from '../../src/logger';
import { BusHost } from '../../src/bus/host';
import {
  DEFAULT_PAYLOAD_BUDGET_BYTES,
  QueryDispatcher,
  budgetFrom,
} from '../../src/queries/dispatcher';
import { QueryRegistry } from '../../src/queries/registry';
import { Query, QueryContext } from '../../src/queries/types';

const SUBJECT = 'dev.api.jiku-queries.v1.tasks.list';

/**
 * Un `Query` de prueba. Va definido acá y no en `src/`: un stub de prueba en `src/` es código
 * muerto que el próximo lector cree que sirve para algo.
 */
function testQuery(
  pattern: string,
  execute: Query['execute'] = (): Promise<Reply> => Promise.resolve(success())
): Query {
  // `validate` PERMISIVO: desde S-022 la interfaz `Query` lo exige, igual que `Command`. Este
  // stub no tiene contrato que validar, así que deja pasar el payload TAL CUAL — que es lo que
  // las aserciones de abajo siguen verificando.
  return { pattern, validate: (payload: unknown) => ({ value: payload }), execute };
}

describe('queries/registry', () => {
  it('patterns() devuelve los patrones en ORDEN DE REGISTRO', () => {
    const registry = new QueryRegistry().registerAll([
      testQuery('tasks.list'),
      testQuery('projects.get'),
      testQuery('comments.list'),
    ]);

    registry.patterns().should.deepEqual(['tasks.list', 'projects.get', 'comments.list']);
  });

  it('resolve() es match EXACTO y devuelve null si el patrón no existe', () => {
    const query = testQuery('tasks.list');
    const registry = new QueryRegistry().register(query);

    (registry.resolve('tasks.list') === query).should.be.true();
    (registry.resolve('tasks.get') === null).should.be.true();
    // Los patrones de consulta no llevan `{param}`: no hay nada que extraer, y un id embebido
    // en el método NO matchea.
    (registry.resolve('tasks.7') === null).should.be.true();
  });

  it('register() de un patrón repetido LANZA, nombrando el patrón', () => {
    const registry = new QueryRegistry().register(testQuery('tasks.list'));
    let thrown: Error | null = null;

    try {
      registry.register(testQuery('tasks.list'));
    } catch (error) {
      thrown = error as Error;
    }

    // Con un `Map` la sobreescritura silenciosa es el default: hay que impedirla a mano, igual
    // que `registerService` falla el registro ante un subject duplicado.
    (thrown === null).should.be.false();
    thrown!.message.should.containEql('tasks.list');
  });
});

describe('queries/dispatcher', () => {
  before(async () => {
    // Desde S-017 los dos despachadores autorizan al caller del subject ANTES de resolver el
    // método. Los subjects de este archivo NO CAMBIAN —sus aserciones afirman sobre el caller que
    // llevan— así que lo que se agrega son las filas que la compuerta va a encontrar. `admin`
    // autoriza TODAS las consultas y NINGÚN comando, que es exactamente lo que estos tests
    // necesitan.
    await User.bulkCreate([
      { id: 'api', name: 'Api', username: 'api-q', email: 'api-q@test.local', roles: ['admin'] },
      {
        id: '323332022539911171',
        name: 'Persona',
        username: 'persona-q',
        email: 'persona-q@test.local',
        roles: ['admin'],
      },
    ]);
  });

  after(async () => {
    await User.destroy({ where: { id: ['api', '323332022539911171'] } });
  });

  it('TS-15 · el despachador NO abre transacción, en ninguna de las dos conexiones', async () => {
    const writeTx = sinon.spy(sequelize, 'transaction');
    const readTx = sinon.spy(readDb, 'transaction');
    try {
      const dispatcher = new QueryDispatcher(
        new QueryRegistry().register(testQuery('tasks.list')),
        readDb
      );

      await dispatcher.dispatch(SUBJECT, {});

      // Espiar solo una dejaría pasar el error más probable: abrir la transacción en la
      // conexión equivocada.
      writeTx.callCount.should.equal(0);
      readTx.callCount.should.equal(0);
    } finally {
      writeTx.restore();
      readTx.restore();
    }
  });

  it('TS-16 · el contexto lleva caller y db, y nada más', async () => {
    let captured: QueryContext | null = null;
    let receivedPayload: unknown = null;
    const fakeDb = { marker: 'fake' } as unknown as Sequelize;
    const dispatcher = new QueryDispatcher(
      new QueryRegistry().register(
        testQuery('tasks.list', (payload, ctx) => {
          receivedPayload = payload;
          captured = ctx;
          return Promise.resolve(success());
        })
      ),
      fakeDb
    );

    await dispatcher.dispatch('dev.323332022539911171.jiku-queries.v1.tasks.list', { a: 1 });

    const ctx = captured as unknown as QueryContext;
    Object.keys(ctx).sort().should.deepEqual(['caller', 'db']);
    ctx.caller.should.equal('323332022539911171');
    ((ctx.db as unknown) === (fakeDb as unknown)).should.be.true();
    // Ni transacción ni params: la ausencia es el contrato (RF-9, y los patrones no llevan id).
    ((ctx as any).transaction === undefined).should.be.true();
    ((ctx as any).params === undefined).should.be.true();
    // El payload llega TAL CUAL, sin transformar.
    JSON.stringify(receivedPayload).should.equal('{"a":1}');
  });

  it('TS-17 · un método no registrado se CONTESTA, no se cuelga', async () => {
    const warn = sinon.spy(logger, 'warn');
    try {
      const dispatcher = new QueryDispatcher(new QueryRegistry(), readDb);

      const reply = await dispatcher.dispatch('dev.api.jiku-queries.v1.widgets.list', {});

      reply.should.deepEqual({
        status: 'failure',
        errorCode: 'unknown_command',
        errorMessage: 'Unknown query: widgets.list',
      });
      warn.callCount.should.equal(1);
      String(warn.firstCall.args[0]).should.startWith('[query]');
    } finally {
      warn.restore();
    }
  });

  it('TS-18 · una consulta que lanza NO escapa del despachador', async () => {
    const error = sinon.spy(logger, 'error');
    try {
      const dispatcher = new QueryDispatcher(
        new QueryRegistry().register(
          testQuery('tasks.list', () => Promise.reject(new Error('boom')))
        ),
        readDb
      );

      // Resuelve, no rechaza: el stack NO cruza el bus.
      const reply = await dispatcher.dispatch(SUBJECT, {});

      reply.should.deepEqual({
        status: 'failure',
        errorCode: 'internal_error',
        errorMessage: 'Internal error',
      });
      error.callCount.should.equal(1);
      String(error.firstCall.args[0]).should.startWith('[query]');
      String(error.firstCall.args[0]).should.containEql('boom');
    } finally {
      error.restore();
    }
  });

  it('una consulta que lanza SINCRÓNICAMENTE tampoco escapa', async () => {
    const dispatcher = new QueryDispatcher(
      new QueryRegistry().register(
        testQuery('tasks.list', () => {
          throw new Error('sync boom');
        })
      ),
      readDb
    );

    const reply = await dispatcher.dispatch(SUBJECT, {});

    reply.errorCode!.should.equal('internal_error');
  });
});

/**
 * S-022 · `validate()` y el presupuesto de bytes.
 *
 * Va en un `describe` propio y NO toca los de arriba: lo que S-013 fijó sobre este despachador
 * —sin transacción, contexto mínimo, nunca lanza— sigue valiendo exactamente igual, y esos tests
 * son los que lo prueban.
 */
describe('queries/dispatcher — validate() y el presupuesto (CA-31)', () => {
  before(async () => {
    await User.create({
      id: 'sub-validate',
      name: 'Validate',
      username: 'validate-q',
      email: 'validate-q@test.local',
      roles: ['admin'],
    });
  });

  after(async () => {
    await User.destroy({ where: { id: 'sub-validate' } });
  });

  const SUBJECT_OK = 'dev.sub-validate.jiku-queries.v1.tasks.list';

  it('TS-54 · `validate()` se llama UNA VEZ y ANTES de `execute`', async () => {
    const calls: string[] = [];
    const dispatcher = new QueryDispatcher(
      new QueryRegistry().register({
        pattern: 'tasks.list',
        validate: (payload: unknown) => {
          calls.push('validate');
          return { value: payload };
        },
        execute: () => {
          calls.push('execute');
          return Promise.resolve(success());
        },
      }),
      readDb
    );

    await dispatcher.dispatch(SUBJECT_OK, {});

    calls.should.deepEqual(['validate', 'execute']);
  });

  it('TS-54 · si `validate()` devuelve error, `execute` NO se invoca y el reply es ESE error', async () => {
    let executed = false;
    const rejection = failure(ErrorCode.INVALID_FIELDS, 'mal', { field: 'sort' });
    const dispatcher = new QueryDispatcher(
      new QueryRegistry().register({
        pattern: 'tasks.list',
        validate: () => ({ error: rejection }),
        execute: () => {
          executed = true;
          return Promise.resolve(success());
        },
      }),
      readDb
    );

    const reply = await dispatcher.dispatch(SUBJECT_OK, { sort: ['x'] });

    executed.should.be.false();
    // TAL CUAL, incluido su `errorDetails`: el despachador no lo reescribe.
    reply.should.deepEqual(rejection);
  });

  it('TS-54 · un payload inválido NO llega a tocar la base', async () => {
    const query = sinon.spy(readDb, 'query');
    const writeTx = sinon.spy(sequelize, 'transaction');
    const readTx = sinon.spy(readDb, 'transaction');
    try {
      const dispatcher = new QueryDispatcher(
        new QueryRegistry().register({
          pattern: 'tasks.list',
          validate: () => ({ error: failure(ErrorCode.INVALID_FIELDS, 'mal') }),
          execute: () => Promise.resolve(success()),
        }),
        readDb
      );

      await dispatcher.dispatch(SUBJECT_OK, {});

      query.callCount.should.equal(0);
      // Y ninguna transacción, en ninguna de las dos conexiones: la propiedad de S-013 intacta.
      writeTx.callCount.should.equal(0);
      readTx.callCount.should.equal(0);
    } finally {
      query.restore();
      writeTx.restore();
      readTx.restore();
    }
  });

  it('el presupuesto se EVALÚA EN CADA dispatch, no se cachea al construir', async () => {
    const budgets: (number | undefined)[] = [];
    let next = 1000;
    const dispatcher = new QueryDispatcher(
      new QueryRegistry().register(
        testQuery('tasks.list', (_payload, ctx) => {
          budgets.push(ctx.budgetBytes);
          return Promise.resolve(success());
        })
      ),
      readDb,
      () => next
    );

    await dispatcher.dispatch(SUBJECT_OK, {});
    // Una reconexión a un server con otro `max_payload` cambia el número: cachearlo mediría
    // contra el server viejo.
    next = 2000;
    await dispatcher.dispatch(SUBJECT_OK, {});

    budgets.should.deepEqual([1000, 2000]);
  });

  it('sin proveedor, el contexto es el MISMO que entregó S-013', async () => {
    let captured: QueryContext | null = null;
    const dispatcher = new QueryDispatcher(
      new QueryRegistry().register(
        testQuery('tasks.list', (_payload, ctx) => {
          captured = ctx;
          return Promise.resolve(success());
        })
      ),
      readDb
    );

    await dispatcher.dispatch(SUBJECT_OK, {});

    // Sin `budgetBytes`: el motor resuelve la ausencia con su default. Es lo que permite que la
    // forma del contexto no cambie para quien no lo necesita.
    Object.keys(captured as unknown as QueryContext).sort().should.deepEqual(['caller', 'db']);
  });

  it('`budgetFrom` es la mitad del `max_payload`, y 524288 cuando no hay conexión', () => {
    budgetFrom(1048576).should.equal(524288);
    budgetFrom(2097152).should.equal(1048576);
    // 1 MiB es el `max_payload` por defecto de NATS; su mitad es el default de acá.
    budgetFrom(undefined).should.equal(DEFAULT_PAYLOAD_BUDGET_BYTES);
    DEFAULT_PAYLOAD_BUDGET_BYTES.should.equal(524288);
    // Un valor absurdo del server no puede producir un presupuesto de cero.
    budgetFrom(0).should.equal(DEFAULT_PAYLOAD_BUDGET_BYTES);
    budgetFrom(-1).should.equal(DEFAULT_PAYLOAD_BUDGET_BYTES);
  });

  it('`BusHost.maxPayload()` devuelve undefined antes de `start()`', () => {
    const host = new BusHost();

    (host.maxPayload() === undefined).should.be.true();
  });
});
