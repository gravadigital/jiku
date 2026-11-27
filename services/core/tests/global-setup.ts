/**
 * Fixture global de Mocha. El arranque de la base ocurre antes, en `setup-env.ts`.
 * Acá se crea el esquema una vez para toda la corrida y se apaga el contenedor al final.
 */
import { execFileSync } from 'child_process';
import { DB_CONTAINER } from './setup-env';

export async function mochaGlobalSetup(): Promise<void> {
  // La misma validación de arranque que corre `src/index.ts`. Los comandos de `files`
  // resuelven la identidad contra `CORE_TRUSTED_PUBLISHER_ID`, que `.env.test` provee: sin
  // esta llamada `getTrustedPublisherId()` lanzaría y la causa quedaría lejos del síntoma.
  const { loadConfig } = await import('../src/config');
  loadConfig();

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

  // El rol de SOLO LECTURA de las consultas. Va acá y no en `setup-env.ts` porque
  // `GRANT SELECT ON ALL TABLES` necesita que las tablas EXISTAN, y las crea el `sync()` de
  // arriba. Idempotente: con KEEP_DB=true el contenedor sobrevive entre corridas.
  const readUser = process.env.POSTGRESQL_READ_USER as string;
  const readPassword = process.env.POSTGRESQL_READ_PASSWORD as string;
  const database = process.env.POSTGRESQL_DB as string;

  await sequelize.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${readUser}') THEN
        CREATE ROLE "${readUser}" LOGIN PASSWORD '${readPassword}';
      END IF;
    END $$;
  `);
  // SELECT y nada más. Un GRANT de más acá convierte CA-5 en un test que no prueba nada.
  // El nombre de la base va ENTRE COMILLAS DOBLES: es `gestionTest`, con mayúscula, y sin
  // comillas Postgres lo pasa a minúsculas y el GRANT falla con "database does not exist".
  await sequelize.query(`GRANT CONNECT ON DATABASE "${database}" TO "${readUser}"`);
  await sequelize.query(`GRANT USAGE ON SCHEMA public TO "${readUser}"`);
  await sequelize.query(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${readUser}"`);
  // La interpolación es aceptable acá y SOLO acá: los valores vienen de `.env.test`, no de
  // entrada de usuario, y `CREATE ROLE` no acepta parámetros. En `src/` la regla es la
  // opuesta: listas blancas para nombres, parámetros para valores.
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
