/**
 * Fixture global de Mocha.
 *
 * El arranque de la base ocurre antes, en `setup-env.ts` (ver la explicación ahí).
 * Acá se crea el esquema y, al final, se apaga el contenedor.
 *
 * Crear el esquema una sola vez y para toda la corrida es lo que permite ejecutar
 * cualquier archivo por separado sin fallar con `relation "users" does not exist`.
 */
import { execFileSync } from 'child_process';
import path from 'path';
import { DB_CONTAINER } from './setup-env';


/**
 * The schema the tests run on is the one the migrations build (services/api/db-upgrade: the
 * baseline on an empty database, then every migration), the same as an installation. The
 * models' `sync()` that `initializeDb()` runs afterwards only creates what the migrations lack.
 */
function migrate(): void {
  execFileSync('npm', ['run', '--silent', 'upgrade-db'], {
    cwd: path.join(__dirname, '..'),
    env: process.env,
    stdio: ['ignore', 'ignore', 'inherit'],
    timeout: 180000,
  });
}

export async function mochaGlobalSetup(): Promise<void> {
  migrate();
  // Importar acá y no arriba: `lib/models` construye el Sequelize al importarse, y
  // para este punto `setup-env.ts` ya dejó las variables de conexión listas.
  const initializeDb = (await import('../lib/models')).default;
  await initializeDb();
}

export async function mochaGlobalTeardown(): Promise<void> {
  // En CI la base la provee el pipeline, así que no es nuestra para borrarla. Con
  // KEEP_DB=true el contenedor se deja vivo a propósito, para que la próxima corrida
  // lo reuse y arranque más rápido.
  if (
    process.env.CI === 'true' ||
    process.env.TEST_DATABASE === 'external' ||
    process.env.KEEP_DB === 'true'
  ) {
    return;
  }
  try {
    execFileSync('docker', ['rm', '-f', DB_CONTAINER], { stdio: 'ignore', timeout: 30000 });
    console.log('[tests] PostgreSQL detenido');
  } catch {
    // ya estaba detenido
  }
}
