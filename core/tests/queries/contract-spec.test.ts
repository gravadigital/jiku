import 'mocha';
import 'should';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { registry as commandRegistry } from '../../src/commands';
import { queryRegistry } from '../../src/queries';
import { RESOURCE_NAMES } from '../../src/queries/resources';

/**
 * `docs/apis/core-queries.yaml` — LA SPEC CONTRA EL CÓDIGO (S-028, Task 6).
 *
 * EL DOCUMENTO ES LA FUENTE DE VERDAD y el código lo sigue, pero eso NO significa que el documento
 * pueda quedar desfasado sin que nadie se entere: el desfasaje más probable es el más barato de
 * atrapar —un endpoint registrado sin canal, o un recurso sin sus listas blancas—, y es lo que estos
 * tests fijan.
 *
 * NO SE PARSEA EL YAML CON UNA LIBRERÍA: `js-yaml` no es dependencia declarada de `core`, y
 * agregarla para tres aserciones sería pagar una dependencia por un `grep`. Lo que se lee es la
 * INDENTACIÓN de las claves de primer nivel de cada sección, que es lo que el documento promete.
 */

const SPEC_PATH = join(__dirname, '..', '..', '..', 'docs', 'apis', 'core-queries.yaml');
const COMMANDS_SPEC_PATH = join(__dirname, '..', '..', '..', 'docs', 'apis', 'core.yaml');

function spec(): string {
  return readFileSync(SPEC_PATH, 'utf8');
}

/** Las claves con DOS espacios de indentación que siguen a una sección de primer nivel. */
function keysUnder(source: string, section: string): string[] {
  const start = source.indexOf(`\n${section}:\n`);
  start.should.be.above(-1, `la sección ${section} no existe`);

  const rest = source.slice(start + section.length + 3);
  const end = rest.search(/\n[A-Za-z]/);
  const block = end === -1 ? rest : rest.slice(0, end);

  // Las llaves entran en el patrón porque los canales de COMANDO llevan `{param}`
  // (`clients.{id}.edit`); los de consulta no llevan ninguno, y esa diferencia es del contrato.
  return [...block.matchAll(/^ {2}([A-Za-z][\w.{}-]*):/gm)].map(([, key]) => key);
}

describe('docs/apis/core-queries.yaml — la spec del contrato de consultas (S-028, Task 6)', () => {
  it('TS-93 · existe y es AsyncAPI 2.6, igual que `core.yaml` (CA-15)', () => {
    // MISMO FORMATO Y POR EL MISMO MOTIVO: `core` no expone HTTP, y una spec OpenAPI tendría que
    // inventar rutas que no existen.
    spec().should.match(/^asyncapi: '2\.6\.0'/);
  });

  it('TS-94 · declara los 23 canales, 1:1 con `queryRegistry.patterns()` (CA-15)', () => {
    // ES EL DESFASAJE MÁS PROBABLE y el más barato de atrapar: registrar el endpoint 24 y olvidar el
    // canal deja la spec mintiendo por omisión, que es la peor forma de mentir de un contrato.
    keysUnder(spec(), 'channels').should.deepEqual(queryRegistry.patterns());
  });

  it('TS-95 · declara las cinco listas blancas de los 16 recursos (CA-15)', () => {
    const source = spec();
    const resources = keysUnder(source, 'x-resources');

    resources.should.deepEqual([...RESOURCE_NAMES]);

    for (const name of resources) {
      const block = source.slice(source.indexOf(`\n  ${name}:\n`));
      const own = block.slice(0, block.indexOf('\n\n  ') + 1 || undefined);

      for (const declared of ['sortable:', 'defaultSort:', 'externalScope:']) {
        own.includes(declared).should.be.true(`${name} no declara ${declared}`);
      }
      // Un recurso con discriminador declara `base`/`includable`/`filterable` POR VARIANTE: su ficha
      // no está completa hasta que la variante se resuelve.
      /\n {4}(base|discriminator):/
        .test(own)
        .should.be.true(`${name} no declara ni base ni discriminador`);
    }
  });

  it('TS-96 · documenta la excepción de agregación de `requirements.tags` (CA-15)', () => {
    const source = spec();

    source.should.containEql('ONLY aggregation in the contract');
    source.should.containEql('DECLARED, BOUNDED EXCEPTION');
    // Y que la forma reservada para la v2 SIGUE FUERA: sin esta frase, el próximo recurso agregado
    // cita a éste como precedente.
    source.should.containEql('`*.summary`');
    source.should.containEql('It is not a precedent');
  });

  it('TS-97 · documenta la lista blanca cerrada de `settings` y la traducción de H-1 (CA-15, CA-19)', () => {
    const source = spec();

    for (const key of [
      'hours-per-day',
      'upload-url-ttl-seconds',
      'download-url-ttl-seconds',
      'file-max-size-bytes',
      'file-allowed-extensions',
      'file-allowed-mime-types',
    ]) {
      source.should.containEql(key);
    }
    source.should.containEql('`hours_per_day`');
    source.should.containEql('UNDERSCORES in the database');
  });

  it('documenta que `meta.describe` se DERIVA, y el procedimiento de verificación cruzada', () => {
    const source = spec();

    source.should.containEql('Derived, not maintained');
    // El procedimiento vale la pena escrito aunque no se automatice: es la única mitigación del
    // riesgo "el YAML y las fichas divergen", y es barato de escribir y caro de reconstruir.
    source.should.containEql('mechanical verification');
    source.should.containEql("nats req 'dev.<user-id>.jiku-queries.v1.meta.describe'");
  });

  it('corrige el conteo de recursos: 16, no 18', () => {
    spec().should.containEql('16 resources, not 18');
  });
});

describe('docs/apis/core.yaml — la nota de las consultas al día (S-028, CA-16)', () => {
  it('TS-98 · ya no dice que el contrato de consultas no existe', () => {
    const source = readFileSync(COMMANDS_SPEC_PATH, 'utf8');

    source.should.not.containEql('todavía no tiene contrato definido');
    source.should.not.containEql('Until that story lands');
    source.should.not.containEql('core/src/queries/pending.ts` is deleted');
    source.should.containEql('That contract now EXISTS and lives in `docs/apis/core-queries.yaml`');
  });

  it('TS-98 · la frase que SE QUEDA sigue estando: el contrato de consultas es de otra spec', () => {
    const source = readFileSync(COMMANDS_SPEC_PATH, 'utf8');

    // "OUT OF SCOPE … and that is permanent" sigue siendo cierto y correcto: este archivo es el
    // contrato de los COMANDOS.
    source.should.containEql('OUT OF SCOPE');
    source.should.containEql('this file stays the contract of the commands');
  });

  it('TS-99 · los 20 canales de comandos siguen intactos (CA-16)', () => {
    const source = readFileSync(COMMANDS_SPEC_PATH, 'utf8');

    keysUnder(source, 'channels').should.have.length(20);
  });
});

/**
 * LA DOCUMENTACIÓN DE ARQUITECTURA DE `core` AL DÍA (S-028, Task 7).
 *
 * ES EL RIESGO MÁS PROBABLE DE UNA ÚLTIMA STORY: los 23 endpoints ya funcionan y el manifiesto se
 * siente accesorio. Pero un `overview.md` que dice "17 comandos" y "core no sabe de roles" describe
 * un servicio que **ya no es el que corre**, y alguien va a usar la segunda frase para razonar sobre
 * seguridad.
 */
describe('docs/architectures/core — la documentación describe el servicio que existe (S-028, Task 7)', () => {
  const ARCH_DIR = join(__dirname, '..', '..', '..', 'docs', 'architectures', 'core');

  function arch(...parts: string[]): string {
    return readFileSync(join(ARCH_DIR, ...parts), 'utf8');
  }

  it('TS-100 · el manifiesto declara la superficie de consultas (CA-17)', () => {
    const manifest = arch('manifest.yaml');

    manifest.should.match(/^ {2}- queries\b/m);
    // Y deja explícito que la lista dejó de describir solo `src/commands/`: sin la aclaración, un
    // lector queda buscando `src/commands/queries/`, que no existe.
    manifest.should.containEql('YA NO DESCRIBE SOLO `src/commands/`');
    manifest.should.containEql('src/queries/');
  });

  it('TS-101 · las 12 convenciones del manifiesto siguen resolviendo a archivos existentes (CA-17)', () => {
    const declared = [
      ...arch('manifest.yaml').matchAll(/^ {2}- (\w[\w-]*)\s*(?:#.*)?$/gm),
    ]
      .map(([, name]) => name)
      .filter((name) => existsSync(join(ARCH_DIR, 'conventions', `${name}.md`)));

    declared.should.have.length(12);
  });

  it('TS-102 · `overview.md` dice VEINTE comandos, y son los del registro (CA-18)', () => {
    const overview = arch('overview.md');

    overview.should.not.containEql('17 comandos');
    overview.should.containEql('**20 comandos**');
    // El número se verifica contra el CÓDIGO, no contra otro documento: es el mismo tipo de dato
    // que ya se desactualizó una vez.
    commandRegistry.patterns().should.have.length(20);
  });

  it('TS-103 · `overview.md` describe el plano de consultas (CA-18)', () => {
    const overview = arch('overview.md');

    for (const claim of [
      '23 consultas sobre 16 recursos',
      'jiku-queries',
      'solo lectura',
      'NO abre transacción',
      'meta.describe',
    ]) {
      overview.should.containEql(claim);
    }
  });

  it('TS-104 · `overview.md` ACOTA al plano de comandos la frase sobre roles (CA-18)', () => {
    const overview = arch('overview.md');

    // La corrección más importante del documento: hoy la frase sin acotar es INCORRECTA.
    overview.should.containEql('## En el plano de COMANDOS, core no sabe de roles');
    overview.should.containEql('## En el plano de CONSULTAS, core SÍ lee roles');
    overview.should.containEql('users.roles');
    overview.should.containEql('caller_not_authorized');
    overview.should.containEql('unknown_caller');
  });

  it('TS-105 · `overview.md` referencia `core-queries.yaml` (CA-18)', () => {
    arch('overview.md').should.containEql('../../apis/core-queries.yaml');
  });

  it('TS-106 · `contract-translation.md` recoge las SEIS traducciones de solo lectura (CA-19)', () => {
    const convention = arch('conventions', 'contract-translation.md');

    for (const pair of [
      '`body` | `new_value`',
      '`authorId` | `changed_by`',
      '`taskId` | `objective_id`',
      '`task_comment` ↔ `objective_comment`',
      '`priorityValue`',
      '`hours-per-day`',
    ]) {
      convention.should.containEql(pair);
    }
  });

  it('TS-107 · `contract-translation.md` dice que ninguna se filtra a `@jiku/models` (CA-19)', () => {
    const convention = arch('conventions', 'contract-translation.md');

    convention.should.containEql('NO se filtra a `@jiku/models`');
    convention.should.containEql('**Ninguna traducción se filtra a `@jiku/models`**');
    // Y la regla 4 ya no manda al archivo equivocado para el plano de consultas.
    convention.should.containEql('`docs/apis/core-queries.yaml`');
  });
});

/**
 * TS-108 · EL FLUJO PASA A `Active`.
 *
 * La condición estaba escrita en el propio documento: pasa a `Active` cuando TODOS sus pasos existan
 * en el código, no cuando exista el primero.
 */
describe('docs/flows/consulta-por-el-bus.md — el flujo cerrado (S-028, TS-108)', () => {
  const FLOW = join(__dirname, '..', '..', '..', 'docs', 'flows', 'consulta-por-el-bus.md');

  it('TS-108 · `status: Active` y la tabla entera en "Implementado" (CA-1)', () => {
    const flow = readFileSync(FLOW, 'utf8');

    flow.should.match(/^status: Active$/m);
    flow.should.match(/^\*\*Status:\*\* Active$/m);
    flow.should.not.containEql('status: Draft');

    // Las filas de LA TABLA DE ESTADO, acotada a su sección: el documento tiene varias tablas más
    // —el catálogo de errores, los recortes por recurso— y un regex sobre el archivo entero las
    // barrería todas.
    const section = flow.slice(
      flow.indexOf('### Estado de implementación'),
      flow.indexOf('### Los tres endpoints que NO recorren')
    );
    const rows = [...section.matchAll(/^\| \d[^|]*\|([^|]*)\|/gm)].map(([, state]) => state.trim());
    rows.length.should.be.above(8);
    rows.should.matchEach((state: string) => {
      state.should.containEql('Implementado');
    });
  });

  it('deja escrito que `pending.ts` ya no existe y que tres endpoints no recorren los mismos pasos', () => {
    const flow = readFileSync(FLOW, 'utf8');

    flow.should.containEql('`core/src/queries/pending.ts` ya no existe');
    flow.should.containEql('Los tres endpoints que NO recorren estos pasos igual que el resto');
    // Y la advertencia que SE QUEDA: sigue siendo cierta y es la que justifica que la cobertura de
    // tests sea la única red.
    flow.should.containEql('no tiene ningún caller en producción');
  });
});
