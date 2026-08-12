/**
 * Se carga PRIMERO, vía `require` de .mocharc.json: antes que cualquier test y antes
 * que `lib/`.
 *
 * Por qué no alcanza con un `mochaGlobalSetup`: `lib/models/index.ts` construye el
 * Sequelize en el momento en que se importa el módulo, leyendo `process.env` ahí
 * mismo. El fixture global corre DESPUÉS de que Mocha cargó los archivos de test —y
 * con ellos `lib/`—, así que para entonces la conexión ya quedó apuntando al host de
 * `.env.test` (`database`, que solo resuelve dentro de CI).
 *
 * Acá el entorno se prepara antes de eso:
 *   CI=true      usa la base externa que ya definen las variables de entorno
 *   en local     levanta un PostgreSQL efímero en Docker, de forma síncrona
 *
 * El contenedor se apaga en `mochaGlobalTeardown` (tests/global-setup.ts).
 */
import { execFileSync } from 'child_process';
import path from 'path';
import * as dotenv from 'dotenv';
import { setBus } from '../lib/utils/bus';
import { fakeBus } from './mocks/bus';

process.env.TZ = 'UTC';
process.env.NODE_ENV = 'testing';

dotenv.config({ path: path.join(process.cwd(), '.env.test') });

// Las rutas de escritura publican comandos a core. En los tests el bus se reemplaza por
// un doble que registra qué se publicó y devuelve la respuesta que cada test indique,
// sin levantar NATS. Ver tests/mocks/bus.ts
setBus(fakeBus);

// El doble es único para toda la corrida, así que un `failWith` o una respuesta fija de
// un archivo se filtraría a los siguientes. Este root hook lo evita: corre antes que el
// `beforeEach` de cada archivo, así que un test que necesite un comportamiento
// particular lo declara en el suyo.
export const mochaHooks = {
  beforeEach() {
    fakeBus.reset();
  },
};

export const DB_CONTAINER = 'jiku-api-tests-db';
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
  // Reusar el contenedor si quedó vivo de una corrida anterior acelera el arranque.
  try {
    const running = docker(['ps', '-q', '-f', `name=^${DB_CONTAINER}$`]);
    if (running) {
      const port = docker(['port', DB_CONTAINER, '5432/tcp']).split(':').pop() as string;
      process.env.POSTGRESQL_PORT = port;
      console.log(`[tests] reusando PostgreSQL en localhost:${port}`);
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
