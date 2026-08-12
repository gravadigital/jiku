/**
 * Fixture global de Mocha. El arranque de la base ocurre antes, en `setup-env.ts`.
 * Acá se crea el esquema una vez para toda la corrida y se apaga el contenedor al final.
 */
import { execFileSync } from 'child_process';
import { DB_CONTAINER } from './setup-env';

export async function mochaGlobalSetup(): Promise<void> {
  // Importar acá: `src/models` construye el Sequelize al importarse, y para este punto
  // `setup-env.ts` ya dejó las variables de conexión listas.
  const initializeDb = (await import('../src/models')).default;
  await initializeDb();

  // Arrancar de cero. Con KEEP_DB=true el contenedor sobrevive entre corridas, y los
  // datos que queden de una anterior chocan con las restricciones de unicidad de los
  // fixtures (email y username de `users`).
  const { sequelize } = await import('../src/models');
  const tables = Object.values(sequelize.models)
    .map((model) => `"${model.getTableName()}"`)
    .join(', ');
  await sequelize.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
}

export async function mochaGlobalTeardown(): Promise<void> {
  if (process.env.CI === 'true' || process.env.KEEP_DB === 'true') {
    return;
  }
  try {
    execFileSync('docker', ['rm', '-f', DB_CONTAINER], { stdio: 'ignore', timeout: 30000 });
    console.log('[tests] PostgreSQL detenido');
  } catch {
    // ya estaba detenido
  }
}
