import 'mocha';
import 'should';
import * as sinon from 'sinon';
import { Sequelize } from 'sequelize-typescript';
import logger from '../../src/logger';
import { selectRows } from '../../src/queries/engine/execute-sql';
import { QueryContext } from '../../src/queries/types';

/**
 * El ejecutor y la captura del `statement_timeout`.
 *
 * La pieza que importa es una sola: cuando la base corta por `statement_timeout`, el motor
 * responde `query_timeout` y no un `internal_error` genérico. La detección es POR CÓDIGO DE
 * POSTGRES, nunca por el texto del mensaje, y estos tests fabrican los errores en vez de esperar
 * ocho segundos — el camino contra la base real está en `tasks-timeout.test.ts`.
 */

const PLAN = { sql: 'SELECT 1', replacements: {} };

function contextThatFails(error: unknown): QueryContext {
  return {
    caller: 'test',
    db: { query: () => Promise.reject(error) } as unknown as Sequelize,
  };
}

function pgError(code: string, where: 'parent' | 'original'): any {
  const error: any = new Error('canceling statement due to statement timeout');
  error[where] = { code };
  return error;
}

describe('queries/engine/execute-sql — la traducción de errores de PostgreSQL (CA-27)', () => {
  afterEach(() => sinon.restore());

  it('devuelve las filas tipadas cuando la base responde', async () => {
    const ctx: QueryContext = {
      caller: 'test',
      db: { query: () => Promise.resolve([{ n: 1 }]) } as unknown as Sequelize,
    };

    const result = await selectRows<{ n: number }>(ctx, PLAN, 'tasks.list');

    ('rows' in result).should.be.true();
    (result as { rows: { n: number }[] }).rows.should.deepEqual([{ n: 1 }]);
  });

  it('ejecuta con `QueryTypes.SELECT` y los valores en `replacements`', async () => {
    const query = sinon.stub().resolves([]);
    const ctx: QueryContext = { caller: 'test', db: { query } as unknown as Sequelize };

    await selectRows(ctx, { sql: 'SELECT :p0', replacements: { p0: 'x' } }, 'tasks.list');

    query.firstCall.args[0].should.equal('SELECT :p0');
    query.firstCall.args[1].type.should.equal('SELECT');
    query.firstCall.args[1].replacements.should.deepEqual({ p0: 'x' });
    // SIN transacción: este plano no abre ninguna (ADR-003).
    (query.firstCall.args[1].transaction === undefined).should.be.true();
  });

  it('un `57014` en `parent` produce `query_timeout`', async () => {
    const result = await selectRows(contextThatFails(pgError('57014', 'parent')), PLAN, 'tasks.list');

    (result as any).error.errorCode.should.equal('query_timeout');
  });

  it('un `57014` en `original` TAMBIÉN produce `query_timeout`', async () => {
    // Sequelize no siempre envuelve el error del driver en la misma propiedad: chequear una sola
    // dejaría el código sin emisor en la mitad de los casos.
    const result = await selectRows(contextThatFails(pgError('57014', 'original')), PLAN, 'tasks.list');

    (result as any).error.errorCode.should.equal('query_timeout');
  });

  it('la detección es por CÓDIGO, no por el texto del mensaje', async () => {
    // Mismo texto, otro código: NO es un timeout. Un `includes("timeout")` fallaría acá.
    const error: any = new Error('canceling statement due to statement timeout');
    error.parent = { code: '42501' };

    let thrown: unknown = null;
    try {
      await selectRows(contextThatFails(error), PLAN, 'tasks.list');
    } catch (caught) {
      thrown = caught;
    }

    (thrown === null).should.be.false();
  });

  it('cualquier otro error de base SE PROPAGA al despachador, que responde internal_error', async () => {
    const error: any = new Error('permission denied for table objectives');
    error.parent = { code: '42501' };

    let thrown: any = null;
    try {
      await selectRows(contextThatFails(error), PLAN, 'tasks.list');
    } catch (caught) {
      thrown = caught;
    }

    // No se traga lo que no sabe traducir.
    thrown.parent.code.should.equal('42501');
  });

  it('el mensaje de `query_timeout` está en español y NO lleva SQL, columnas ni el subject', async () => {
    const result = await selectRows(
      contextThatFails(pgError('57014', 'parent')),
      { sql: 'SELECT t.created_at FROM objectives t', replacements: {} },
      'dev.323332022539911171.jiku-queries.v1.tasks.list'
    );

    const message = (result as any).error.errorMessage as string;
    message.should.containEql('consulta');
    message.should.not.containEql('SELECT');
    message.should.not.containEql('created_at');
    message.should.not.containEql('objectives');
    message.should.not.containEql('323332022539911171');
  });

  it('el DETALLE va al log, con el prefijo del módulo', async () => {
    const error = sinon.spy(logger, 'error');

    await selectRows(contextThatFails(pgError('57014', 'parent')), PLAN, 'tasks.list');

    error.callCount.should.equal(1);
    String(error.firstCall.args[0]).should.startWith('[query]');
  });
});
