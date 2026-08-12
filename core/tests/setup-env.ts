/**
 * Se carga PRIMERO, vía `require` de .mocharc.json: antes que cualquier test y antes
 * que `src/`.
 *
 * `src/models/index.ts` construye el Sequelize al importarse, leyendo `process.env` en
 * ese momento. Por eso el contenedor tiene que estar listo acá y no en un
 * `mochaGlobalSetup`, que corre después de que Mocha ya cargó los tests.
 *
 *   CI=true    usa la base externa de las variables de entorno
 *   en local   levanta un PostgreSQL efímero en Docker
 */
import { execFileSync } from 'child_process';
import path from 'path';
import * as dotenv from 'dotenv';

process.env.TZ = 'UTC';
process.env.NODE_ENV = 'testing';

dotenv.config({ path: path.join(__dirname, '..', '.env.test') });

export const DB_CONTAINER = 'jiku-core-tests-db';
const DB_IMAGE = 'postgres:15.4-alpine3.18';

function docker(args: string[], timeout = 180000): string {
  return execFileSync('docker', args, { encoding: 'utf8', timeout }).trim();
}

/** Espera a que el puerto acepte conexiones. Síncrono a propósito. */
function waitForPort(port: number, timeoutMs = 60000): void {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      execFileSync(process.execPath, [
        '-e',
        `const s=require('net').connect(${port},'127.0.0.1');` +
          `s.on('connect',()=>{s.end();process.exit(0)});` +
          `s.on('error',()=>process.exit(1));s.setTimeout(1000,()=>process.exit(1));`,
      ]);
      return;
    } catch {
      execFileSync(process.execPath, ['-e', 'setTimeout(()=>{},500)']);
    }
  }
  throw new Error(`La base no respondió en ${timeoutMs}ms`);
}

function startDatabase(): void {
  try {
    const running = docker(['ps', '-q', '-f', `name=^${DB_CONTAINER}$`]);
    if (running) {
      const port = docker(['port', DB_CONTAINER, '5432/tcp']).split(':').pop() as string;
      process.env.POSTGRESQL_PORT = port;
      console.log(`[tests] reusando PostgreSQL en localhost:${port}`);
      return;
    }
    docker(['rm', '-f', DB_CONTAINER]);
  } catch {
    // no existe: se crea abajo
  }

  console.log('[tests] levantando PostgreSQL...');
  docker([
    'run', '-d', '--rm',
    '--name', DB_CONTAINER,
    '-e', 'POSTGRES_DB=gestionTest',
    '-e', 'POSTGRES_USER=test',
    '-e', 'POSTGRES_PASSWORD=testing',
    '-P',
    DB_IMAGE,
  ]);

  const port = docker(['port', DB_CONTAINER, '5432/tcp']).split(':').pop() as string;
  waitForPort(Number(port));
  process.env.POSTGRESQL_PORT = port;
  console.log(`[tests] PostgreSQL en localhost:${port}`);
}

if (process.env.CI !== 'true') {
  startDatabase();
  process.env.POSTGRESQL_HOST = '127.0.0.1';
  process.env.POSTGRESQL_DB = 'gestionTest';
  process.env.POSTGRESQL_USER = 'test';
  process.env.POSTGRESQL_PASSWORD = 'testing';
} else {
  console.log(`[tests] base externa: ${process.env.POSTGRESQL_HOST}:${process.env.POSTGRESQL_PORT}`);
}
