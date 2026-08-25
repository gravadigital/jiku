import 'mocha';
import 'should';
import * as sinon from 'sinon';
import { Sequelize } from 'sequelize-typescript';
import { readDb } from '../../src/models/read';
import { dispatchQuery } from '../helpers/dispatch';
import { createTasks, createWorld, destroyWorld } from './task-fixtures';

/**
 * TS-50 · EL `statement_timeout` CORTA ANTES QUE EL BUS, y el código es `query_timeout`.
 *
 * Lo que se verifica es la INVARIANTE, no el valor de ninguna de las dos variables:
 * `POSTGRESQL_STATEMENT_TIMEOUT_MS` (8000) < `NATS_QUERY_TIMEOUT_MS` (10000). La base corta
 * primero, el motor captura el `57014` de PostgreSQL y responde algo que EXPLICA qué pasó, en vez
 * de dejar al caller esperando un timeout mudo.
 *
 * EL `statement_timeout` SE BAJA EN EL TEST, no globalmente: bajarlo en la variable rompería el
 * resto de la suite, y un test que espere ocho segundos es un test que nadie corre.
 */

const PROJECT_SLOW = 24;
/** Muy por debajo de los 10000 ms del caller: lo que se prueba es el ORDEN, no el número. */
const SLOW_STATEMENT_TIMEOUT_MS = 100;
const CALLER_TIMEOUT_MS = 10000;

/**
 * Una conexión de lectura NUEVA con otro `statement_timeout`.
 *
 * `src/models/read.ts` lee `process.env` AL IMPORTARSE, así que la única forma de tener otro
 * valor es reimportar el módulo con la variable cambiada. Local a este archivo, igual que el
 * `reloadRead()` de `tests/models/read.test.ts`: es un caso, no una necesidad general.
 */
function reloadReadWithTimeout(ms: number): Sequelize {
  const saved = process.env.POSTGRESQL_STATEMENT_TIMEOUT_MS;
  process.env.POSTGRESQL_STATEMENT_TIMEOUT_MS = String(ms);
  const modulePath = require.resolve('../../src/models/read');
  delete require.cache[modulePath];
  const loaded = require('../../src/models/read') as typeof import('../../src/models/read');
  process.env.POSTGRESQL_STATEMENT_TIMEOUT_MS = saved;
  delete require.cache[modulePath];
  return loaded.readDb;
}

describe('queries/tasks — `query_timeout` (CA-27)', () => {
  let slowDb: Sequelize;

  before(async () => {
    await createWorld([PROJECT_SLOW]);
    await createTasks([{ id: 40000, title: 'Lenta', projectId: PROJECT_SLOW }]);
    slowDb = reloadReadWithTimeout(SLOW_STATEMENT_TIMEOUT_MS);
  });

  after(async () => {
    await slowDb.close();
    await destroyWorld();
  });

  afterEach(() => sinon.restore());

  it('TS-50 · una consulta que la base cancela responde `query_timeout`, antes que el caller', async () => {
    // La consulta se desvía a una conexión con `statement_timeout` de 100 ms y a un SQL
    // deliberadamente lento. El resto del camino es el REAL: el error viene de PostgreSQL, lo
    // traduce el ejecutor, y el envelope sale por el despachador.
    sinon.stub(readDb, 'query').callsFake((() =>
      slowDb.query('SELECT pg_sleep(2)')) as any);

    const started = Date.now();
    const reply = await dispatchQuery('tasks.list', { filter: { projectId: PROJECT_SLOW } });
    const elapsed = Date.now() - started;

    reply.status.should.equal('failure');
    reply.errorCode!.should.equal('query_timeout');
    // No un `internal_error` genérico, y no un timeout mudo del bus.
    reply.errorCode!.should.not.equal('internal_error');
    // LA INVARIANTE: la respuesta llega ANTES de que el caller se rinda.
    elapsed.should.be.below(CALLER_TIMEOUT_MS);
  });

  it('TS-50 · el mensaje está en español y no filtra SQL, columnas ni el subject', async () => {
    sinon.stub(readDb, 'query').callsFake((() =>
      slowDb.query('SELECT pg_sleep(2)')) as any);

    const reply = await dispatchQuery('tasks.list', { filter: { projectId: PROJECT_SLOW } });

    const message = reply.errorMessage!;
    message.should.containEql('consulta');
    message.should.not.containEql('SELECT');
    message.should.not.containEql('pg_sleep');
    message.should.not.containEql('objectives');
    message.should.not.containEql('created_at');
    message.should.not.containEql('jiku-queries');
    // Y NO lleva datos estructurados en el mensaje: para eso está `errorDetails`.
    (reply.errorDetails === undefined).should.be.true();
  });

  it('la invariante que lo sostiene: el corte de la base es MUY anterior al del caller', async () => {
    const started = Date.now();
    let thrown: any = null;
    try {
      await slowDb.query('SELECT pg_sleep(2)');
    } catch (error) {
      thrown = error;
    }

    // El código viene de POSTGRES, no de una validación de TypeScript ni de un timeout propio en
    // JavaScript — que es justo lo que este motor NO agrega.
    String(thrown.original.code).should.equal('57014');
    (Date.now() - started).should.be.below(CALLER_TIMEOUT_MS);
  });

  it('sin el desvío, la misma consulta responde normalmente', async () => {
    // La precondición del test de arriba: sin ella, un `query_timeout` sería indistinguible de
    // una consulta rota.
    const reply = await dispatchQuery('tasks.list', { filter: { projectId: PROJECT_SLOW } });

    reply.status.should.equal('success');
  });
});
