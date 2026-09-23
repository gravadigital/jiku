import 'mocha';
import 'should';
import { QueryTypes } from 'sequelize';
import { readDb } from '../../src/models/read';

/**
 * Las consultas parametrizadas de la conexión de lectura van como sentencias preparadas con
 * nombre (`src/models/named-statements.ts`). Se usa una transacción solo para fijar UNA conexión
 * del pool: las sentencias preparadas son de la sesión.
 */
describe('models/named-statements — sentencias preparadas con nombre en la lectura', () => {
  const SQL = 'SELECT $1::int + 1 AS "n"';

  it('una consulta parametrizada queda preparada en la sesión, con nombre', async () => {
    await readDb.transaction(async (transaction) => {
      const [row] = await readDb.query<{ n: number }>(SQL, {
        type: QueryTypes.SELECT, bind: [41], transaction,
      });
      row.n.should.equal(42);
      const prepared = await readDb.query<{ name: string }>(
        'SELECT name FROM pg_prepared_statements WHERE statement = \'SELECT $1::int + 1 AS "n"\'',
        { type: QueryTypes.SELECT, transaction }
      );
      prepared.length.should.equal(1);
      prepared[0].name.should.startWith('jq_');
    });
  });

  it('si la sesión perdió la sentencia, se reintenta sin nombre y el caller no ve el error', async () => {
    // Una conexión del pool, SIN transacción: es como corre el plano de consultas (RF-9). Dentro de
    // una transacción el fallo la abortaría y no habría reintento posible (ver el módulo).
    const manager = (readDb as any).connectionManager;
    const connection = await manager.getConnection({ type: 'SELECT' });
    // La misma firma con la que la llama Sequelize (`Query.run`).
    const run = (values: unknown[]) =>
      new Promise<any>((resolve, reject) =>
        connection.query(SQL, values, (error: any, result: any) => (error ? reject(error) : resolve(result)))
      );
    try {
      (await run([1])).rows[0].n.should.equal(2);
      // El cliente `pg` cree que ya la preparó; el servidor ya no la tiene (26000 al ejecutarla).
      await new Promise((resolve) => connection.query('DEALLOCATE ALL', resolve));
      (await run([9])).rows[0].n.should.equal(10);
      // Y la siguiente vuelve a ir con nombre.
      (await run([20])).rows[0].n.should.equal(21);
    } finally {
      manager.releaseConnection(connection);
    }
  });

  it('una consulta sin parámetros no se prepara', async () => {
    await readDb.transaction(async (transaction) => {
      await readDb.query('SELECT 1 AS "uno"', { type: QueryTypes.SELECT, transaction });
      // La conexión del pool puede traer sentencias de otros tests: se busca ESTA.
      const prepared = await readDb.query(
        'SELECT name FROM pg_prepared_statements WHERE statement = \'SELECT 1 AS "uno"\'',
        { type: QueryTypes.SELECT, transaction }
      );
      prepared.length.should.equal(0);
    });
  });
});
