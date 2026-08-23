import 'mocha';
import 'should';
import * as sinon from 'sinon';
import { Sequelize } from 'sequelize-typescript';
import { Reply, success } from '@jiku/nats-protocol';
import { sequelize } from '../../src/models';
import { readDb } from '../../src/models/read';
import logger from '../../src/logger';
import { QueryDispatcher } from '../../src/queries/dispatcher';
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
  return { pattern, execute };
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
