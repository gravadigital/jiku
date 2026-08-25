import 'mocha';
import 'should';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, sep } from 'path';
import { QueryRegistry } from '../../src/queries/registry';
import { queryRegistry } from '../../src/queries';
import settingsList from '../../src/queries/settings/settings-list';
import { dispatchQuery } from '../helpers/dispatch';
import { PROJECT_MAIN, createWorld, destroyWorld } from './task-fixtures';

/**
 * EL CIERRE DEL CONTRATO (S-028, Task 5).
 *
 * Este archivo reemplaza a `pending.test.ts`, y el renombre no es cosmético: "pending" dejó de
 * nombrar algo que existe. Los cuatro bloques que aquel archivo tenía se mudaron enteros —solo el
 * primero cambió de sentido: donde afirmaba que `pending.ts` EXISTE, ahora afirma que NO.
 *
 * LO QUE SE VERIFICA ACÁ es que el contrato quedó cerrado: 23 patrones, todos con ficha, ninguno
 * respondiendo "todavía no tiene contrato definido", y el motor sin conocer un solo recurso.
 */

const SRC_DIR = join(__dirname, '..', '..', 'src');
const QUERIES_DIR = join(SRC_DIR, 'queries');
const TESTS_DIR = __dirname;

/** Los 23 del contrato, EN EL ORDEN DEL REGISTRO. Es la lista congelada de CA-1. */
const CONTRACT_PATTERNS = [
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
  // Los dos de S-027: los archivos en lectura. `attachments` no tiene `get` y `files` no tiene
  // `list`, y las dos ausencias SON el contrato.
  'attachments.list',
  'files.get',
  // Los seis de S-026. Ninguno tiene `get`.
  'people.list',
  'users.list',
  'worked-times.list',
  'unworked-times.list',
  'week-assigned-times.list',
  'project-permissions.list',
  // LOS TRES DE S-028, al final y en el orden en que el REQ los enumera.
  'requirements.tags',
  'settings.list',
  'meta.describe',
];

/** Un payload MÍNIMO VÁLIDO por patrón. Los que no están acá aceptan el cuerpo vacío. */
const MINIMAL_PAYLOADS: Record<string, unknown> = {
  'comments.list': { filter: { entityType: 'task', entityId: 1 } },
  'comments.get': { id: 1, entityType: 'task' },
  'activity.list': { filter: { entityType: 'task', entityId: 1 } },
  'subscriptions.list': { filter: { entityType: 'task', entityId: 1 } },
  'requirements.tags': { filter: { projectId: PROJECT_MAIN } },
};

describe('queries — el contrato cerrado (S-028, CA-1 y CA-2)', () => {
  before(async () => {
    await createWorld([PROJECT_MAIN]);
  });

  after(async () => {
    await destroyWorld();
  });

  it('TS-78 · `pending.ts` NO EXISTE (CA-2)', () => {
    // Su propio comentario lo declaraba TRANSITORIO. Mientras quedara un endpoint sin contrato el
    // stub tenía que existir; en cuanto no quedó ninguno, tenía que dejar de existir.
    existsSync(join(QUERIES_DIR, 'pending.ts')).should.be.false();
  });

  it('TS-79 · NINGÚN archivo de `src/` nombra `pendingContract` (CA-2)', () => {
    // SOBRE `src/` ENTERO, no sobre `src/queries/` ni sobre una lista literal de carpetas. La lista
    // se desactualiza sola, y acotarlo al módulo dejaría pasar un importador nuevo en `src/index.ts`
    // o en `src/bus/` — que es exactamente donde nadie lo buscaría.
    const offenders: string[] = [];

    for (const file of tsFiles(SRC_DIR)) {
      const source = readFileSync(file, 'utf8');
      if (
        source.includes("from './pending'") ||
        source.includes("from '../pending'") ||
        source.includes('pendingContract')
      ) {
        offenders.push(file);
      }
    }

    offenders.should.deepEqual([]);
  });

  it('TS-80 · `src/queries/index.ts` no lo importa (CA-2)', () => {
    readFileSync(join(QUERIES_DIR, 'index.ts'), 'utf8').should.not.match(/import .*pending/);
  });

  it('los archivos de recurso siguen siendo DECLARATIVOS: no arman SQL', () => {
    // La regla que sobrevive al stub: la ficha dice QUÉ se puede pedir y el motor sabe CÓMO. La
    // única excepción declarada es `requirements-tags.ts`, que colapsa filas y no entra en el molde
    // del motor —pero se arma sobre las MISMAS piezas: `PERMITTED_PROJECTS` y `selectRows`.
    const offenders: string[] = [];

    // SOBRE LOS ARCHIVOS DE ENDPOINT (`*-list.ts`, `*-get.ts`), que son los que delegan en el motor.
    // Una FICHA sí puede llevar SQL —`requirements.totalMinutes` es un `IncludableComputedSpec` con
    // dos subconsultas—, y eso es correcto: el SQL de la ficha es DATO declarado, no lógica del
    // endpoint. `requirements-tags.ts` es la excepción declarada y por eso no es un `*-list.ts`.
    for (const file of queryFiles()) {
      if (!file.endsWith('-list.ts') && !file.endsWith('-get.ts')) {
        continue;
      }
      if (readFileSync(file, 'utf8').includes('SELECT')) {
        offenders.push(file);
      }
    }

    offenders.should.deepEqual([]);
  });

  it('TS-82 · el registro tiene los VEINTITRÉS patrones, en el orden del contrato (CA-1)', () => {
    queryRegistry.patterns().should.deepEqual(CONTRACT_PATTERNS);
  });

  it('TS-83 · son exactamente 23 (CA-1)', () => {
    queryRegistry.patterns().should.have.length(23);
  });

  it('TS-84 · NINGUNO responde "todavía no tiene contrato definido" (CA-1, CA-2)', async () => {
    for (const pattern of queryRegistry.patterns()) {
      const reply = await dispatchQuery(pattern, MINIMAL_PAYLOADS[pattern] ?? {});

      JSON.stringify({ pattern, reply }).should.not.containEql('todavía no tiene contrato definido');
    }
  });

  it('TS-85 · NINGUNO responde `unknown_command` (CA-1)', async () => {
    for (const pattern of queryRegistry.patterns()) {
      const reply = await dispatchQuery(pattern, MINIMAL_PAYLOADS[pattern] ?? {});

      (reply.errorCode ?? '').should.not.equal('unknown_command', `${pattern}: ${JSON.stringify(reply)}`);
    }
  });

  it('TS-86 · CA-21: los 23 patrones tienen al menos un test que los ejerce', () => {
    // TOSCO PERO NECESARIO: al cerrar REQ-006 `bus.query()` sigue SIN CALLER, así que nada ejercita
    // el contrato en producción salvo los tests. Sin este gate, la cobertura del contrato se
    // degradaría en silencio.
    const sources = testFiles()
      .filter((file) => !file.endsWith(`${sep}contract-closure.test.ts`))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    const missing = queryRegistry
      .patterns()
      .filter((pattern) => !sources.includes(`dispatchQuery('${pattern}'`));

    missing.should.deepEqual([]);
  });

  it('TS-89 · registrar un patrón duplicado sigue lanzando', () => {
    (() => new QueryRegistry().registerAll([settingsList, settingsList])).should.throw(
      /patrón de consulta duplicado: settings\.list/
    );
  });
});

/**
 * EL GATE DE LA GENERICIDAD DEL MOTOR.
 *
 * Un `if (recurso === 'settings')` dentro de `src/queries/engine/` es la señal de que la abstracción
 * se rompió. Con dieciséis fichas encima, corregirlo tarde cuesta dieciséis recursos — y por eso el
 * chequeo es automático y no una lectura del diff.
 */
describe('queries/engine — la genericidad del motor, con los 16 recursos', () => {
  const RESOURCE_NAMES = [
    'clients',
    'projects',
    'requirements',
    'tasks',
    'comments',
    'activity',
    'subscriptions',
    'attachments',
    'files',
    'people',
    'users',
    'worked-times',
    'unworked-times',
    'week-assigned-times',
    'project-permissions',
    // EL ÚNICO GATE QUE SE ROMPE POR OMISIÓN: sin agregar el recurso nuevo, el gate sigue VERDE y el
    // motor podría nombrar `settings` sin que nadie se entere. Los listados congelados fallan
    // ruidosamente en cuanto se registra un endpoint; este no.
    'settings',
  ];

  it('TS-87 · ninguna línea del motor nombra un recurso', () => {
    const engineDir = join(QUERIES_DIR, 'engine');
    const offenders: string[] = [];

    for (const file of readdirSync(engineDir).filter((name) => name.endsWith('.ts'))) {
      const source = readFileSync(join(engineDir, file), 'utf8');

      source.split('\n').forEach((line, index) => {
        for (const resource of RESOURCE_NAMES) {
          if (line.includes(`'${resource}'`) || line.includes(`"${resource}"`)) {
            offenders.push(`${file}:${index + 1} -> ${line.trim()}`);
          }
        }
      });
    }

    offenders.should.deepEqual([]);
  });

  it('TS-88 · el motor tampoco importa ninguna ficha, ni el registro de recursos', () => {
    const engineDir = join(QUERIES_DIR, 'engine');

    for (const file of readdirSync(engineDir).filter((name) => name.endsWith('.ts'))) {
      const source = readFileSync(join(engineDir, file), 'utf8');

      // La ficha llega SIEMPRE por parámetro (`resource: ResourceSpec`).
      source.should.not.match(
        /from '\.\.\/(clients|projects|requirements|tasks|comments|activity|subscriptions|attachments|files|people|users|worked-times|unworked-times|week-assigned-times|project-permissions|settings|meta)\//
      );
      // `resources.ts` y `meta/` viven del lado que SÍ puede nombrar recursos: el motor no.
      source.should.not.match(/from '\.\.\/resources'/);
    }
  });
});

/**
 * LA TRADUCCIÓN DE `entityType`, EN UN SOLO LUGAR.
 *
 * Si los nombres de tabla y de columna aparecieran escritos a mano en una ficha, las dos
 * traducciones podrían divergir sin que nada lo diga — y la que se equivoca devuelve las filas de la
 * otra entidad.
 */
describe('queries/entity-type — la traducción en un solo lugar', () => {
  const TRANSLATED = [
    'objective_activity',
    'requirement_activity',
    'objectives_subscriptors',
    'requirement_subscriptors',
    'objective_comment',
    'requirement_comment',
  ];

  /** Las dos declaraciones que preceden a S-025 y NO son esta traducción. */
  const LEGACY = [`tasks${sep}tasks-spec.ts`, `requirements${sep}requirements-spec.ts`];

  it('los nombres traducidos SOLO aparecen en `entity-type.ts`', () => {
    const offenders: string[] = [];

    for (const file of queryFiles()) {
      if (file.endsWith(`${sep}entity-type.ts`) || LEGACY.some((tail) => file.endsWith(tail))) {
        continue;
      }
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

  it('las tres fichas con discriminador leen los nombres del mapa compartido', () => {
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

/** Todos los `.ts` bajo un directorio, recursivo. */
function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return tsFiles(full);
    }
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

/** Todos los `.ts` de `core/src/queries/`. */
function queryFiles(): string[] {
  return tsFiles(QUERIES_DIR);
}

/** Todos los `*.test.ts` de `core/tests/queries/`. */
function testFiles(dir = TESTS_DIR): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return testFiles(full);
    }
    return entry.name.endsWith('.test.ts') ? [full] : [];
  });
}
