import 'mocha';
import 'should';
import { QueryTypes } from 'sequelize';
import { readDb } from '../../src/models/read';
import { sequelize } from '../../src/models';

/**
 * La conexión de lectura arranca sus sesiones con random_page_cost = 1.1: sin eso el planner
 * ignora los índices trigram de la búsqueda `q` (migración 20260923_02). La de escritura no cambia.
 */
describe('models/read — costo de página del planner en la conexión de lectura', () => {
  it('las sesiones de lectura usan random_page_cost = 1.1', async () => {
    const [row] = await readDb.query<{ value: string }>(
      'SELECT current_setting(\'random_page_cost\') AS value',
      { type: QueryTypes.SELECT }
    );
    row.value.should.equal('1.1');
  });

  it('la conexión de escritura conserva el default del servidor', async () => {
    const [row] = await sequelize.query<{ value: string }>(
      'SELECT current_setting(\'random_page_cost\') AS value',
      { type: QueryTypes.SELECT }
    );
    row.value.should.equal('4');
  });
});
