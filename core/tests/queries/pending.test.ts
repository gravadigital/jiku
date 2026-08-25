import 'mocha';
import 'should';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, sep } from 'path';
import { queryRegistry } from '../../src/queries';
import { dispatchQuery } from '../helpers/dispatch';
import { PROJECT_MAIN, createWorld, destroyWorld } from './task-fixtures';

/**
 * EL STUB SIN CONTRATO Y LA GENERICIDAD DEL MOTOR.
 *
 * S-025 sacó a `comments.list` y `comments.get` de `pendingContract`, así que **ningún endpoint
 * registrado lo usa ya**. El archivo `pending.ts` SOBREVIVE IGUAL hasta S-028 (CA-17), que es la
 * story que cierra el contrato y lo elimina — eliminarlo antes sería adelantar el alcance de otra
 * story, y `queryRegistry` todavía no tiene los 18 recursos.
 *
 * El gate del motor es lo que hace de este trabajo un motor y no tres endpoints: NINGUNA línea de
 * `src/queries/engine/` puede decidir por nombre de recurso.
 */

const QUERIES_DIR = join(__dirname, '..', '..', 'src', 'queries');

describe('queries/pending — el stub sin consumidores (S-025, CA-17)', () => {
  before(async () => {
    await createWorld([PROJECT_MAIN]);
  });

  after(async () => {
    await destroyWorld();
  });

  it('TS-80 · `pending.ts` SIGUE EXISTIENDO y exporta `pendingContract`', () => {
    // SE ELIMINA EN S-028, no acá: esta story lo deja SIN CONSUMIDORES, que es otra cosa.
    // Adelantarlo sería tomar el alcance de la story que cierra el contrato.
    existsSync(join(QUERIES_DIR, 'pending.ts')).should.be.true();
    readFileSync(join(QUERIES_DIR, 'pending.ts'), 'utf8').should.containEql(
      'export function pendingContract'
    );
  });

  it('TS-81 · NINGÚN archivo de `queries/*/` importa ya `pendingContract`', () => {
    for (const [folder, files] of [
      ['clients', ['clients-list.ts', 'clients-get.ts']],
      ['projects', ['projects-list.ts', 'projects-get.ts']],
      ['requirements', ['requirements-list.ts', 'requirements-get.ts']],
      ['tasks', ['tasks-list.ts', 'tasks-get.ts']],
      ['comments', ['comments-list.ts', 'comments-get.ts']],
      ['activity', ['activity-list.ts']],
      ['subscriptions', ['subscriptions-list.ts']],
    ] as const) {
      for (const file of files) {
        const source = readFileSync(join(QUERIES_DIR, folder, file), 'utf8');

        // Se mira el IMPORT y no la palabra: los comentarios que mencionan el stub para decir que
        // lo dejaron atrás son documentación, no dependencia.
        source.should.not.containEql("from '../pending'");
        // Y son DECLARATIVOS: delegan en el motor y no arman SQL.
        source.should.not.containEql('SELECT');
      }
    }
  });

  it('TS-81 · ningún endpoint registrado responde ya "todavía no tiene contrato definido"', async () => {
    // Un payload válido MÍNIMO por patrón: los tres recursos de S-025 exigen `entityType`, y un
    // `get` sin `id` muere en la validación del contrato — que es justamente del otro lado del
    // stub.
    const payloads: Record<string, unknown> = {
      'comments.list': { filter: { entityType: 'task', entityId: 1 } },
      'comments.get': { id: 1, entityType: 'task' },
      'activity.list': { filter: { entityType: 'task', entityId: 1 } },
      'subscriptions.list': { filter: { entityType: 'task', entityId: 1 } },
    };

    for (const pattern of queryRegistry.patterns()) {
      const reply = await dispatchQuery(pattern, payloads[pattern] ?? {});

      JSON.stringify({ pattern, reply }).should.not.containEql('todavía no tiene contrato definido');
    }
  });

  it('TS-82 · el registro tiene los DOCE patrones esperados, en el orden del contrato', () => {
    queryRegistry.patterns().should.deepEqual([
      'clients.list',
      'clients.get',
      'projects.list',
      'projects.get',
      'requirements.list',
      'requirements.get',
      'tasks.list',
      'tasks.get',
      'comments.list',
      'comments.get',
      'activity.list',
      'subscriptions.list',
    ]);
  });
});

/**
 * EL GATE DE CA-2: EL MOTOR NO CONOCE RECURSOS.
 *
 * Un `if (recurso === 'requirements')` dentro de `src/queries/engine/` es la señal de que la
 * abstracción se rompió. Corregirla acá cuesta tres recursos; corregirla en S-028 cuesta
 * dieciocho, y por eso el chequeo es automático y no una lectura del diff.
 */
describe('queries/engine — la genericidad del motor (S-024, S-025)', () => {
  const RESOURCE_NAMES = [
    'clients',
    'projects',
    'requirements',
    'tasks',
    'comments',
    // Los tres de S-025. Si el motor supiera que existen, la abstracción se rompió: S-027 vuelve a
    // necesitar la traducción de `entityType` y S-028 deriva `meta.describe` de estas fichas.
    'activity',
    'subscriptions',
  ];

  it('TS-83 · ninguna línea del motor nombra un recurso', () => {
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
      source.should.not.match(
        /from '\.\.\/(clients|projects|requirements|tasks|comments|activity|subscriptions)\//
      );
    }
  });
});

/**
 * TS-84 · LA TRADUCCIÓN DE `entityType`, EN UN SOLO LUGAR.
 *
 * S-027 (`attachments.list`) va a importar EXACTAMENTE este mapa. Si los nombres de tabla y de
 * columna aparecieran escritos a mano en una ficha, las dos traducciones podrían divergir sin que
 * nada lo diga — y la que se equivoca devuelve las filas de la otra entidad.
 */
describe('queries/entity-type — la traducción en un solo lugar (S-025, TS-84)', () => {
  const TRANSLATED = [
    'objective_activity',
    'requirement_activity',
    'objectives_subscriptors',
    'requirement_subscriptors',
    'objective_comment',
    'requirement_comment',
  ];

  /**
   * LAS DOS DECLARACIONES QUE PRECEDEN A S-025 Y NO SON ESTA TRADUCCIÓN.
   *
   * `tasks-spec.ts` y `requirements-spec.ts` nombran `objective_activity` /
   * `requirement_activity` y las dos tablas de suscripción para declarar SUS PROPIAS RELACIONES
   * —los comentarios y los suscriptores DE UNA TAREA o DE UN REQUISITO—, que es otra cosa: ahí la
   * tabla no se elige, está fijada por el recurso. La traducción que S-025 concentra es la que
   * DECIDE la tabla a partir de un valor del contrato, y esa vive en un solo lugar.
   */
  const LEGACY = [`tasks${sep}tasks-spec.ts`, `requirements${sep}requirements-spec.ts`];

  it('los nombres traducidos SOLO aparecen en `entity-type.ts`', () => {
    const offenders: string[] = [];

    for (const file of queryFiles()) {
      if (file.endsWith(`${sep}entity-type.ts`) || LEGACY.some((tail) => file.endsWith(tail))) {
        continue;
      }
      // Sobre el CÓDIGO, no sobre el texto crudo: los comentarios de las fichas nombran las tablas
      // para explicar la asimetría plural/singular, y eso es documentación, no una segunda copia.
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');

      for (const name of TRANSLATED) {
        if (code.includes(name)) {
          offenders.push(`${file} -> ${name}`);
        }
      }
    }

    offenders.should.deepEqual([]);
  });

  it('las tres fichas de S-025 leen los nombres del mapa compartido', () => {
    for (const [folder, file] of [
      ['comments', 'comments-spec.ts'],
      ['activity', 'activity-spec.ts'],
      ['subscriptions', 'subscriptions-spec.ts'],
    ] as const) {
      const source = readFileSync(join(QUERIES_DIR, folder, file), 'utf8');
      source.should.containEql("from '../entity-type'");
      source.should.containEql('ENTITY_TABLES');
    }
  });
});

/** Todos los `.ts` de `core/src/queries/`. */
function queryFiles(dir = QUERIES_DIR): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return queryFiles(full);
    }
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}
