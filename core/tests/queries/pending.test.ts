import 'mocha';
import 'should';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { dispatchQuery } from '../helpers/dispatch';
import { PROJECT_MAIN, createWorld, destroyWorld } from './task-fixtures';

/**
 * LO QUE **NO** CAMBIÓ (CA-19) Y LA GENERICIDAD DEL MOTOR (CA-2).
 *
 * Son las dos declaraciones que cierran S-024: `comments.*` sigue sin contrato hasta S-025, y
 * ninguna línea del motor conoce un recurso. La segunda es el criterio de aceptación más
 * importante de la story, y acá deja de ser una revisión manual del diff.
 */

const QUERIES_DIR = join(__dirname, '..', '..', 'src', 'queries');

describe('queries/pending — lo que S-024 NO cambió (CA-19)', () => {
  before(async () => {
    await createWorld([PROJECT_MAIN]);
  });

  after(async () => {
    await destroyWorld();
  });

  it('TS-60 · `comments.list` y `comments.get` SIGUEN en `pendingContract`', async () => {
    const list = await dispatchQuery('comments.list', {});
    const get = await dispatchQuery('comments.get', { id: 1 });

    for (const [reply, pattern] of [
      [list, 'comments.list'],
      [get, 'comments.get'],
    ] as const) {
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('unknown_command');
      reply.errorMessage!.should.equal(
        `La consulta ${pattern} todavía no tiene contrato definido`
      );
    }
  });

  it('TS-61 · `pending.ts` SIGUE EXISTIENDO y los dos `comments/` lo importan', () => {
    // Se elimina en S-028, cuando no quede ningún endpoint sin contrato. Mientras quede uno, el
    // stub se queda.
    existsSync(join(QUERIES_DIR, 'pending.ts')).should.be.true();

    for (const file of ['comments-list.ts', 'comments-get.ts']) {
      const source = readFileSync(join(QUERIES_DIR, 'comments', file), 'utf8');
      source.should.containEql('pendingContract');
    }
  });

  it('los seis endpoints nuevos SÍ salieron de `pendingContract`', () => {
    for (const [folder, files] of [
      ['clients', ['clients-list.ts', 'clients-get.ts']],
      ['projects', ['projects-list.ts', 'projects-get.ts']],
      ['requirements', ['requirements-list.ts', 'requirements-get.ts']],
    ] as const) {
      for (const file of files) {
        const source = readFileSync(join(QUERIES_DIR, folder, file), 'utf8');

        // Se mira el IMPORT y no la palabra: los comentarios de `projects/` mencionan el stub para
        // decir que lo dejaron atrás, y eso es documentación, no dependencia.
        source.should.not.containEql("from '../pending'");
        // Y son DECLARATIVOS: delegan en el motor y no arman SQL.
        source.should.not.containEql('SELECT');
      }
    }
  });
});

/**
 * EL GATE DE CA-2: EL MOTOR NO CONOCE RECURSOS.
 *
 * Un `if (recurso === 'requirements')` dentro de `src/queries/engine/` es la señal de que la
 * abstracción se rompió. Corregirla acá cuesta tres recursos; corregirla en S-028 cuesta
 * dieciocho, y por eso el chequeo es automático y no una lectura del diff.
 */
describe('queries/engine — la genericidad del motor (CA-2, S-024)', () => {
  const RESOURCE_NAMES = ['clients', 'projects', 'requirements', 'tasks', 'comments'];

  it('TS-59 · ninguna línea del motor nombra un recurso', () => {
    const engineDir = join(QUERIES_DIR, 'engine');
    const offenders: string[] = [];

    for (const file of readdirSync(engineDir).filter((name) => name.endsWith('.ts'))) {
      const source = readFileSync(join(engineDir, file), 'utf8');

      source.split('\n').forEach((line, index) => {
        for (const resource of RESOURCE_NAMES) {
          // El literal ENTRECOMILLADO es lo que delata la rama por recurso. Los comentarios que
          // mencionan un recurso para explicar un porqué no son el problema: el problema es que el
          // motor DECIDA por nombre.
          if (line.includes(`'${resource}'`) || line.includes(`"${resource}"`)) {
            offenders.push(`${file}:${index + 1} -> ${line.trim()}`);
          }
        }
      });
    }

    offenders.should.deepEqual([]);
  });

  it('el motor tampoco importa ninguna ficha', () => {
    const engineDir = join(QUERIES_DIR, 'engine');

    for (const file of readdirSync(engineDir).filter((name) => name.endsWith('.ts'))) {
      const source = readFileSync(join(engineDir, file), 'utf8');

      // La ficha llega SIEMPRE por parámetro (`resource: ResourceSpec`): un import de un recurso
      // concreto sería la misma rotura por otra puerta.
      source.should.not.match(/from '\.\.\/(clients|projects|requirements|tasks|comments)\//);
    }
  });
});
