import 'mocha';
import 'should';
import { readFileSync } from 'fs';
import path from 'path';
import { PORTAL_DOC_FIELDS } from '../../lib/modules/docs/query';

/**
 * Test de DOCUMENTACIÓN, no de código, y por eso vale la pena: CA-12 se enuncia sobre
 * `docs/apis/api.yaml` —no sobre el modelo compartido ni sobre el ENUM de PostgreSQL—, así que
 * este es el único control que impide que alguien reponga un valor eliminado al editar el spec.
 *
 * NO USA UN PARSER DE YAML A PROPÓSITO: `js-yaml` no es dependencia declarada de la api (llega
 * transitivamente, que es distinto), y agregar una dependencia de producción para leer un
 * archivo de documentación no se justifica. El bloque `enum:` de este schema es plano y con un
 * valor por línea: leerlo con una expresión regular es suficiente y no suma superficie.
 *
 * Vive en `tests/utils/` porque no necesita base de datos: corre con `npm run test:unit`.
 */
describe('docs/apis/api.yaml — contrato de adjuntos', () => {
  const SPEC_PATH = path.join(__dirname, '../../../docs/apis/api.yaml');

  /** Extrae los valores ACTIVOS del bloque `enum:` de un schema. Ignora los comentados. */
  function enumValuesOf(schemaName: string): string[] {
    const spec = readFileSync(SPEC_PATH, 'utf8');
    const lines = spec.split('\n');

    const schemaIndex = lines.findIndex((line) => line.trim() === `${schemaName}:`);
    schemaIndex.should.be.above(-1, `no se encontró el schema ${schemaName} en api.yaml`);

    const enumIndex = lines.findIndex((line, index) => index > schemaIndex && line.trim() === 'enum:');
    enumIndex.should.be.above(-1, `${schemaName} no declara un bloque enum`);

    const values: string[] = [];
    for (let index = enumIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      // Un item activo del enum: `        - valor`. Un comentado (`# - valor`) NO matchea, que
      // es exactamente lo que este test tiene que distinguir.
      const match = /^\s+- ([a-z_]+)\s*$/.exec(line);
      if (match) {
        values.push(match[1]);
        continue;
      }
      // Una línea comentada dentro del bloque no lo termina: los cinco valores eliminados
      // quedaron documentados así a propósito.
      if (line.trim().startsWith('#')) {
        continue;
      }
      break;
    }
    return values;
  }

  // TS-47 (CA-12): exactamente cinco valores. La lista es literal y ordenada a propósito: un
  // `containEql` por valor dejaría pasar un sexto repuesto por error, que es el modo de fallo
  // que este test existe para atrapar.
  it('AttachmentEntityType tiene exactamente los cinco valores del rediseño', () => {
    enumValuesOf('AttachmentEntityType').should.deepEqual([
      'project',
      'requirement',
      'objective',
      'requirement_comment',
      'objective_comment',
    ]);
  });

  it('AttachmentEntityType no declara ninguno de los cinco valores eliminados', () => {
    const values = enumValuesOf('AttachmentEntityType');
    ['comment', 'comment_draft', 'requirement_draft', 'objective_draft', 'stage']
      .forEach((removed) => {
        values.should.not.containEql(removed);
      });
  });
});

/**
 * Los tres modos de falla del bus en el spec (S-014, CA-11).
 *
 * `docs/apis/api.yaml` ya declara el desdoblamiento 503/504 en las 26 operaciones que publican
 * un comando. Lo que hace este describe es BLINDARLO: 26 operaciones es mucha superficie
 * mecánica, y un spec que documenta 503 donde el servicio devuelve 504 es peor que uno que no
 * documenta nada.
 *
 * MISMO MOLDE QUE EL DESCRIBE DE ARRIBA: cuenta líneas, no parsea YAML. Los `$ref` del spec
 * están escritos en una sola línea y con formato uniforme, así que un `split('\n')` + `filter`
 * alcanza. No se agrega `js-yaml`.
 */
describe('docs/apis/api.yaml — los modos de falla del bus (S-014)', () => {
  const SPEC_PATH = path.join(__dirname, '../../../docs/apis/api.yaml');
  const BUS_UNAVAILABLE_REF = "'503': { $ref: '#/components/responses/BusUnavailable' }";
  const GATEWAY_TIMEOUT_REF = "'504': { $ref: '#/components/responses/GatewayTimeout' }";
  const MODULE_UNAVAILABLE_REF = "'503': { $ref: '#/components/responses/ModuleUnavailable' }";
  const MODULE_GATEWAY_TIMEOUT_REF = "'504': { $ref: '#/components/responses/ModuleGatewayTimeout' }";

  function specLines(): string[] {
    return readFileSync(SPEC_PATH, 'utf8').split('\n');
  }

  function countLinesWith(needle: string): number {
    return specLines().filter((line) => line.includes(needle)).length;
  }

  // TS-20: LA INVARIANTE Y EL ANCLA, en dos aserciones distintas y a propósito. La igualdad es
  // la regla —toda operación que puede dar 503 puede dar 504, porque las dos fallas son
  // alcanzables desde el mismo `catch`—; el 28 es el estado de hoy (S-047: `api.yaml` ya
  // documentaba los dos endpoints de edición de comentario con 503/504 antes de que el código
  // los publicara por el bus — 26 + 2 = 28). Si mañana se agrega una operación que publica un
  // comando, el número correcto pasa a 29 y este test tiene que fallar por la razón útil
  // ("agregaste un 503 sin su 504"), no por un literal desactualizado.
  it('TS-20: toda operación con 503 declara también 504', () => {
    const busUnavailable = countLinesWith(BUS_UNAVAILABLE_REF);
    const gatewayTimeout = countLinesWith(GATEWAY_TIMEOUT_REF);

    busUnavailable.should.equal(gatewayTimeout);
    busUnavailable.should.equal(28);
  });

  // S-078 · TS-47: el par propio de las rutas de módulo (su texto no describe a core).
  it('S-078 · TS-47 (S-079: 23/23; S-094: 26/26): las rutas de módulo declaran el par 503/504 de módulo', () => {
    const unavailable = countLinesWith(MODULE_UNAVAILABLE_REF);
    const timeout = countLinesWith(MODULE_GATEWAY_TIMEOUT_REF);

    unavailable.should.equal(timeout);
    unavailable.should.equal(26); // S-094: + relations, suggested-relations, suggestions
  });

  // TS-22: ninguna clave '503' o '504' apunta a otro componente. Es lo que impide que una
  // operación "declare el 504" con una respuesta inline que diga otra cosa: el texto se escribe
  // UNA vez, en el componente compartido, y las operaciones solo lo referencian.
  it('TS-22: ninguna clave 503 o 504 referencia otro componente', () => {
    const huerfanas = specLines().filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("'503':")) {
        return !trimmed.includes("#/components/responses/BusUnavailable")
          && !trimmed.includes("#/components/responses/ModuleUnavailable")
          // S-080: la ruta pública no responde JSON, sino una página HTML genérica.
          && !trimmed.includes("#/components/responses/PublicDocsUnavailable");
      }
      if (trimmed.startsWith("'504':")) {
        return !trimmed.includes("#/components/responses/GatewayTimeout")
          && !trimmed.includes("#/components/responses/ModuleGatewayTimeout");
      }
      return false;
    });

    huerfanas.should.have.length(0, `claves 503/504 con otro $ref: ${huerfanas.join(' | ')}`);
  });

  // TS-21: los dos componentes existen con su `example`. El `message` del 504 es el copy
  // aprobado por la revisión UX: afirmarlo acá es lo que impide que el spec y el servicio
  // divergan en el texto que ve la persona.
  describe('TS-21: los dos componentes de respuesta', () => {
    /** Las líneas del bloque de un componente de `components/responses`, hasta el siguiente. */
    function componentBlock(name: string): string[] {
      const lines = specLines();
      const start = lines.findIndex((line) => line.trim() === `${name}:`);
      start.should.be.above(-1, `no se encontró el componente ${name} en api.yaml`);

      const indent = (lines[start].match(/^\s*/) as RegExpMatchArray)[0].length;
      const block: string[] = [];
      for (let index = start + 1; index < lines.length; index += 1) {
        const line = lines[index];
        const isNewSibling =
          line.trim() !== '' && (line.match(/^\s*/) as RegExpMatchArray)[0].length <= indent;
        if (isNewSibling) {
          break;
        }
        block.push(line);
      }
      return block;
    }

    it('BusUnavailable trae el example de service_unavailable', () => {
      const block = componentBlock('BusUnavailable').join('\n');
      block.should.match(/code: service_unavailable/);
      block.should.match(/message: El servicio no está disponible en este momento/);
    });

    it('GatewayTimeout trae el example de gateway_timeout con el copy aprobado', () => {
      const block = componentBlock('GatewayTimeout').join('\n');
      block.should.match(/code: gateway_timeout/);
      block.should.match(/message: La operación tardó demasiado/);
    });

    // La causa del 503 quedó ACOTADA a "no hay ningún suscriptor": mencionar el timeout ahí es
    // exactamente la conflación que esta story vino a deshacer.
    it('BusUnavailable no se atribuye el timeout', () => {
      const description = componentBlock('BusUnavailable')
        .join('\n')
        .split('content:')[0];
      description.should.match(/no hay ningún suscriptor/i);
      description.should.match(/No cubre el timeout/i);
    });

    // El 504 dice que la operación PUDO haber ocurrido. Es el riesgo asumido de ADR-002, que esta
    // story no resuelve: el spec es el lugar donde queda dicho.
    it('GatewayTimeout avisa que la operación pudo haber ocurrido', () => {
      const description = componentBlock('GatewayTimeout')
        .join('\n')
        .split('content:')[0];
      description.should.match(/PUDO HABER OCURRIDO/);
    });
  });
});

/**
 * Test de DOCUMENTACIÓN, no de código, y por eso vale la pena: CA-15 se enuncia sobre EL CONTRATO
 * —"`Actor` está descrito una sola vez, en `components/schemas/Actor` de `core.yaml`, y no
 * repetido en los 20 canales"—, así que este es el único control que impide que alguien borre la
 * nota del sobre al editar el spec por otra razón. El contenido ya está escrito: esto lo sostiene.
 *
 * Mismo molde que el bloque de arriba: se lee el archivo y se busca con expresiones regulares, sin
 * sumar un parser de YAML que no es dependencia declarada de la api.
 */
describe('docs/apis/api.yaml — el sobre de identidad (S-029)', () => {
  const SPEC_PATH = path.join(__dirname, '../../../docs/apis/api.yaml');

  it('declara la clave reservada `actor` con sus cinco campos y remite a core.yaml', () => {
    const spec = readFileSync(SPEC_PATH, 'utf8');

    spec.should.match(/EL SOBRE DE IDENTIDAD/);
    spec.should.match(/\{ id, roles, name\?, username\?, email\? \}/);
    // La referencia, no la copia: repetir el schema acá es exactamente lo que CA-15 prohíbe.
    spec.should.match(/components\/schemas\/Actor/);
  });

  it('deja dicho que el sobre sale del claim y no de una lectura a `users`', () => {
    const spec = readFileSync(SPEC_PATH, 'utf8');

    // Es la mitad exigente de CA-14, y la que un "arreglo" bienintencionado rompe primero.
    spec.should.match(/CON EL CLAIM YA VERIFICADO y no con una\n#\s+lectura a `users`/);
    spec.should.match(/[Ss]olo el publicador de confianza puede transportarla/);
  });
});

/**
 * Test de DOCUMENTACIÓN, no de código, y por eso vale la pena: el contenido de REQ-007 en el spec
 * YA ESTÁ ESCRITO —se actualizó de una sola vez durante el diseño—, así que este es el único
 * control que impide que alguien borre el bloque al editar el spec por otra razón.
 *
 * El tercer test fija EL LÍMITE MÁS FÁCIL DE CRUZAR del requerimiento: las 28 rutas GET conservan
 * `x-roles` como regla vigente. Quitárselo sin que nadie lo aplique del otro lado ABRIRÍA la
 * lectura, y ninguna story de REQ-007 lo hace.
 *
 * Mismo molde que los bloques de arriba: se lee el archivo y se busca con expresiones regulares,
 * sin sumar un parser de YAML que no es dependencia declarada de la api.
 */
describe('docs/apis/api.yaml — la api deja de autorizar (S-030)', () => {
  const SPEC_PATH = path.join(__dirname, '../../../docs/apis/api.yaml');

  it('TS-13: declara que `x-roles` cambió de significado y que NO se elimina del spec', () => {
    const spec = readFileSync(SPEC_PATH, 'utf8');

    spec.should.match(/REQ-007 — LA API DEJA DE AUTORIZAR, Y `x-roles` CAMBIA DE SIGNIFICADO/);
    spec.should.match(/`x-roles` NO SE ELIMINA DE ESTE SPEC/);
    // El significado nuevo: documenta a quién autoriza CORE, no lo que la api verifica.
    spec.should.match(/DOCUMENTACIÓN DE QUÉ ROL AUTORIZA `core` en su mapa rol -> comando/);
  });

  it('TS-14: declara el código nuevo, su status y la consecuencia de omitirlo', () => {
    const spec = readFileSync(SPEC_PATH, 'utf8');

    spec.should.match(/UN CÓDIGO NUEVO EN `STATUS_BY_ERROR_CODE`: `access_denied` -> 403/);
    // La consecuencia es la mitad que importa: sin la entrada cae en el fallback de
    // `httpStatusFor` y el frontend trata un rechazo de permisos como error de servidor.
    spec.should.match(/\|\| 500/);
  });

  it('TS-15: sigue diciendo que las 28 rutas GET conservan el rol', () => {
    const spec = readFileSync(SPEC_PATH, 'utf8');

    spec.should.match(/28 rutas `GET` los CONSERVAN/);
    // Y por qué: quitarles el rol sin que nadie lo aplique del otro lado abre la lectura.
    spec.should.match(/ABRIRÍA LA LECTURA/);
  });
});

describe('docs/apis/api.yaml — contrato de módulos (S-077)', () => {
  const SPEC_PATH = path.join(__dirname, '../../../docs/apis/api.yaml');

  /** El bloque de un path de 2 espacios hasta el siguiente path (o divisor de sección). */
  function pathBlock(spec: string, name: string): string {
    const lines = spec.split('\n');
    const start = lines.findIndex((line) => line === `  ${name}:`);
    start.should.be.above(-1, `api.yaml no declara ${name}`);
    const out: string[] = [];
    for (let i = start + 1; i < lines.length; i += 1) {
      if (/^  \S/.test(lines[i]) || /^  # =/.test(lines[i]) || /^\S/.test(lines[i])) break;
      out.push(lines[i]);
    }
    return out.join('\n');
  }

  it('S-077 · TS-58: /modules y /opus/modules declaran x-jiku-module y roles', () => {
    const spec = readFileSync(SPEC_PATH, 'utf8');
    ['/modules', '/opus/modules'].forEach((name) => {
      const block = pathBlock(spec, name);
      block.should.match(/x-jiku-module: docs/);
      block.should.match(/x-roles: \[admin, user, external-user\]/);
    });
  });

  it('S-078 · TS-46: las once rutas de documentación declaran x-jiku-module y roles', () => {
    const spec = readFileSync(SPEC_PATH, 'utf8');
    const internal = ['/docs/documents', '/docs/documents/{id}', '/docs/documents/{id}/versions', '/docs/search',
      '/docs/documents/{id}/suggested-relations', '/docs/suggestions', '/docs/topics', '/docs/folders', '/docs/folders/{id}', '/docs/attachments/{id}'];
    const portal = ['/opus/docs/documents', '/opus/docs/documents/{id}',
      '/opus/docs/documents/{documentId}/attachments/{id}'];
    // S-087: la ruta vieja del adjunto del portal ya no se declara.
    spec.should.not.match(/^  \/opus\/docs\/attachments\/\{id\}:$/m);
    internal.concat(portal).forEach((name) => {
      const block = pathBlock(spec, name);
      block.should.match(/x-jiku-module: docs/, name);
      block.should.match(
        internal.includes(name) ? /x-roles: \[admin, user\]/ : /x-roles: \[external-user, admin, user\]/,
        name
      );
      block.should.match(/'503': \{ \$ref: '#\/components\/responses\/ModuleUnavailable' \}/, name);
      block.should.match(/'504': \{ \$ref: '#\/components\/responses\/ModuleGatewayTimeout' \}/, name);
    });
  });

  it('S-077 · TS-58: components de módulo', () => {
    const spec = readFileSync(SPEC_PATH, 'utf8');
    const componentBlock = (name: string): string => {
      const start = spec.indexOf(`\n    ${name}:`);
      start.should.be.above(-1, `components no declara ${name}`);
      const rest = spec.slice(start + 1);
      const next = rest.slice(1).search(/\n {4}\S/);
      return next === -1 ? rest : rest.slice(0, next + 1);
    };
    componentBlock('ModuleNotInstalled').should.match(/code: module_not_installed/);
    componentBlock('ModuleUnavailable').should.match(/code: module_unavailable/);
    spec.should.match(/\n {4}ModuleError:/);
    spec.should.match(/\n {4}ModulesResponse:/);
  });

  it('S-079 · TS-47: las trece rutas de escritura declaran el módulo, roles, 409 (solo donde el contrato de jiku-docs lo produce) y el par 503/504', () => {
    const spec = readFileSync(SPEC_PATH, 'utf8');
    const ops: Array<[string, string, boolean]> = [
      ['/docs/documents', 'post', true], ['/docs/documents/{id}', 'put', true], ['/docs/documents/{id}', 'delete', true],
      ['/docs/documents/{id}/move', 'post', true], ['/docs/documents/{id}/restore', 'post', true],
      ['/docs/documents/{id}/lock', 'post', true], ['/docs/documents/{id}/unlock', 'post', true],
      ['/docs/documents/{id}/relations', 'post', true], // S-094
      ['/docs/attachments', 'post', true], ['/docs/attachments/{id}/confirm', 'post', false],
      ['/docs/documents/{id}/shares', 'get', false], ['/docs/documents/{id}/shares', 'post', true],
      ['/docs/shares/{id}', 'delete', false],
    ];
    ops.forEach(([name, verb, conflict]) => {
      const whole = '\n' + pathBlock(spec, name);
      const start = whole.indexOf(`\n    ${verb}:`);
      start.should.be.above(-1, `${name} no declara ${verb}`);
      const rest = whole.slice(start + 1);
      const next = rest.slice(1).search(/\n {4}\S/);
      const block = next === -1 ? rest : rest.slice(0, next + 1);
      const label = `${verb} ${name}`;
      block.should.match(/x-jiku-module: docs/, label);
      block.should.match(/x-roles: \[admin, user\]/, label);
      block.should.match(/'503': \{ \$ref: '#\/components\/responses\/ModuleUnavailable' \}/, label);
      block.should.match(/'504': \{ \$ref: '#\/components\/responses\/ModuleGatewayTimeout' \}/, label);
      if (conflict) block.should.match(/'409': \{ \$ref: '#\/components\/responses\/ModuleConflict' \}/, label);
      else block.should.not.match(/'409'/, label);
    });
  });

  it('S-079 · TS-48: ModuleConflict y el encabezado', () => {
    const spec = readFileSync(SPEC_PATH, 'utf8');
    const start = spec.indexOf('\n    ModuleConflict:');
    start.should.be.above(-1, 'components no declara ModuleConflict');
    const rest = spec.slice(start + 1);
    const block = rest.slice(0, rest.slice(1).search(/\n {4}\S/) + 1);
    block.should.match(/code: version_conflict/);
    block.should.match(/currentVersion: 7/);
    block.should.match(/code: document_locked/);
    block.should.match(/holder: /);
    block.should.match(/via: human/);
    block.should.match(/expiresAt: /);
    // S-088: el encabezado cuenta operaciones: 92 desde S-094 (75 internas, 15 del portal, 2 públicas).
    spec.should.match(/las 92 operaciones/);
    spec.should.match(/cinco métodos/);
  });

  /** El bloque de una operación (`get`) dentro de un path. */
  function operation(spec: string, name: string, verb: string): string {
    const whole = '\n' + pathBlock(spec, name);
    const start = whole.indexOf(`\n    ${verb}:`);
    start.should.be.above(-1, `${name} no declara ${verb}`);
    const rest = whole.slice(start + 1);
    const next = rest.slice(1).search(/\n {4}\S/);
    return next === -1 ? rest : rest.slice(0, next + 1);
  }

  it('S-080 · TS-30: las dos operaciones públicas', () => {
    const spec = readFileSync(SPEC_PATH, 'utf8');
    ['/p/docs/{token}', '/p/docs/{token}/attachments/{id}'].forEach((name) => {
      const whole = pathBlock(spec, name);
      whole.should.match(/servers:\n\s+- url: '\{publicUrl\}'/, name);
      whole.should.match(/publicUrl: \{ default: 'http:\/\/127\.0\.0\.1:3100'/, name);
      const block = operation(spec, name, 'get');
      block.should.match(/x-jiku-module: docs/, name);
      block.should.match(/security: \[\]/, name);
      block.should.match(/pattern: '\^jds_\[A-Za-z0-9_-\]\{43\}\$'/, name);
      block.should.match(/'404': \{ \$ref: '#\/components\/responses\/PublicDocsNotFound' \}/, name);
      block.should.match(/'429': \{ \$ref: '#\/components\/responses\/PublicDocsTooManyRequests' \}/, name);
      block.should.match(/'503': \{ \$ref: '#\/components\/responses\/PublicDocsUnavailable' \}/, name);
      block.should.not.match(/x-roles/, name);
      block.should.not.match(/'401'/, name);
    });
    operation(spec, '/p/docs/{token}', 'get').should.match(/'200':[\s\S]*text\/html/);
    const attachment = operation(spec, '/p/docs/{token}/attachments/{id}', 'get');
    attachment.should.match(/'302':/);
    attachment.should.match(/Location:/);
    // Son las únicas con `security: []`.
    (spec.match(/^\s+security: \[\]$/gm) || []).length.should.equal(2);
  });

  it('S-080 · TS-31: componentes, encabezado e invariantes', () => {
    const spec = readFileSync(SPEC_PATH, 'utf8');
    ['PublicDocsNotFound', 'PublicDocsTooManyRequests', 'PublicDocsUnavailable'].forEach((name) => {
      const start = spec.indexOf(`\n    ${name}:`);
      start.should.be.above(-1, `components no declara ${name}`);
      const rest = spec.slice(start + 1);
      const block = rest.slice(0, rest.slice(1).search(/\n {4}\S/) + 1);
      block.should.match(/text\/html/, name);
      block.should.match(/Content-Security-Policy/, name);
      block.should.match(/X-Robots-Tag: noindex/, name);
    });
    spec.should.match(/idéntica para cualquier causa/);
    spec.should.match(/las 92 operaciones/);
    spec.should.not.match(/no queda una sola operación con `security: \[\]`/);
    // Los 503 de las rutas públicas no cuentan en los pares de core ni de módulo.
    const count = (needle: string) => spec.split('\n').filter((l) => l.includes(needle)).length;
    count("'503': { $ref: '#/components/responses/ModuleUnavailable' }").should.equal(26); // S-094
    count("'504': { $ref: '#/components/responses/ModuleGatewayTimeout' }").should.equal(26);
    count("'503': { $ref: '#/components/responses/BusUnavailable' }").should.equal(28);
    count("'504': { $ref: '#/components/responses/GatewayTimeout' }").should.equal(28);
  });

  const WRITES_413: Array<[string, string]> = [
    ['/docs/documents', 'post'], ['/docs/documents/{id}', 'put'],
    ['/docs/documents/{id}/move', 'post'], ['/docs/documents/{id}/restore', 'post'],
    ['/docs/documents/{id}/lock', 'post'], ['/docs/documents/{id}/unlock', 'post'],
    ['/docs/attachments', 'post'], ['/docs/attachments/{id}/confirm', 'post'],
    ['/docs/documents/{id}/shares', 'post'],
    ['/docs/documents/{id}/relations', 'post'], // S-094
  ];

  it('S-088 · TS-9 (CA-1): el encabezado coincide con las operaciones declaradas', () => {
    const spec = readFileSync(SPEC_PATH, 'utf8');
    const operations = spec.split('\n').filter((l) => /^    (get|post|put|delete|patch):$/.test(l)).length;
    operations.should.equal(92); // S-094: + 3 rutas de documentación
    const header = /las (\d+) operaciones/.exec(spec);
    (header !== null).should.be.true('el encabezado no dice "las N operaciones"');
    Number(header![1]).should.equal(operations);
    spec.should.not.match(/los 88 endpoints/);
  });

  it('S-088 · TS-10/TS-11/TS-12 (CA-2): las diez escrituras declaran 413 y el componente PayloadTooLarge', () => {
    const spec = readFileSync(SPEC_PATH, 'utf8');
    const line = "'413': { $ref: '#/components/responses/PayloadTooLarge' }";
    WRITES_413.forEach(([name, verb]) => {
      operation(spec, name, verb).should.containEql(line);
    });
    spec.split('\n').filter((l) => l.includes(line)).length.should.equal(10); // S-094: + relations
    (spec.match(/'413':/g) || []).length.should.equal(10);
    const start = spec.indexOf('\n    PayloadTooLarge:');
    start.should.be.above(-1, 'components no declara PayloadTooLarge');
    const rest = spec.slice(start + 1);
    const block = rest.slice(0, rest.slice(1).search(/\n {4}\S/) + 1);
    block.should.match(/code: payload_too_large/);
    block.should.match(/El cuerpo de la solicitud supera el límite permitido/);
    block.should.match(/#\/components\/schemas\/Error/);
    block.should.match(/768 KiB/);
    block.should.match(/no llama al bus/);
  });

  it('S-088 · TS-13/TS-14 (CA-4): DELETE /docs/shares/{id} no declara 400', () => {
    const spec = readFileSync(SPEC_PATH, 'utf8');
    const block = operation(spec, '/docs/shares/{id}', 'delete');
    const codes = (block.match(/^\s+'(\d{3})':/gm) || []).map((l) => l.trim().slice(1, 4));
    codes.should.deepEqual(['200', '401', '403', '404', '500', '503', '504']);
    spec.split('\n').filter((l) => l.includes("'400': { $ref: '#/components/responses/ModuleBadRequest' }"))
      .length.should.equal(21); // S-094: + relations, suggested-relations, suggestions
  });
});

/**
 * Test de DOCUMENTACIÓN (CA-4 y CA-5 de S-101 se enuncian sobre `docs/apis/api.yaml`): ata el
 * contrato del portal a lo que las rutas piden de verdad (`PORTAL_DOC_FIELDS`) y fija que el
 * contrato de la web diga que es pass-through de jiku-docs 1.3.0 y que las identidades son el
 * `sub` de Zitadel, que fue lo que llevó a la web a comparar contra el uuid de Jiku.
 * Sin parser de YAML, como el resto del archivo.
 */
describe('docs/apis/api.yaml — contrato de documentos 1.3.0 (S-101)', () => {
  const SPEC_PATH = path.join(__dirname, '../../../docs/apis/api.yaml');
  const SUB = 'El `sub` de Zitadel (no el uuid de Jiku)';

  function pathBlock(spec: string, name: string): string {
    const lines = spec.split('\n');
    const start = lines.findIndex((line) => line === `  ${name}:`);
    start.should.be.above(-1, `api.yaml no declara ${name}`);
    const out: string[] = [];
    for (let i = start + 1; i < lines.length; i += 1) {
      if (/^  \S/.test(lines[i]) || /^  # =/.test(lines[i]) || /^\S/.test(lines[i])) break;
      out.push(lines[i]);
    }
    return out.join('\n');
  }

  function operation(spec: string, name: string, verb: string): string {
    const whole = '\n' + pathBlock(spec, name);
    const start = whole.indexOf(`\n    ${verb}:`);
    start.should.be.above(-1, `${name} no declara ${verb}`);
    const rest = whole.slice(start + 1);
    const next = rest.slice(1).search(/\n {4}\S/);
    return next === -1 ? rest : rest.slice(0, next + 1);
  }

  function component(spec: string, name: string): string {
    const start = spec.indexOf(`\n    ${name}:`);
    start.should.be.above(-1, `components no declara ${name}`);
    const rest = spec.slice(start + 1);
    return rest.slice(0, rest.slice(1).search(/\n {4}\S/) + 1);
  }

  const line = (block: string, re: RegExp): string => {
    const found = block.split('\n').find((l) => re.test(l));
    (found !== undefined).should.equal(true, `no hay una línea que cumpla ${re}`);
    return found as string;
  };

  const read = (): string => readFileSync(SPEC_PATH, 'utf8');

  it('S-101 · TS-1 (CA-4): DocsPortalDocument declara los campos del portal como requeridos', () => {
    const block = component(read(), 'DocsPortalDocument');
    block.should.containEql('required: [id, title, version, visibility, createdAt, updatedAt]');
    block.should.containEql('visibility: { type: string, enum: [public] }');
  });

  it('S-101 · TS-2 (CA-4): el required coincide con PORTAL_DOC_FIELDS', () => {
    const block = component(read(), 'DocsPortalDocument');
    const m = /required: \[([^\]]+)\]/.exec(block);
    (m !== null).should.equal(true);
    (m as RegExpExecArray)[1].split(',').map((x) => x.trim()).should.deepEqual([...PORTAL_DOC_FIELDS]);
  });

  it('S-101 · TS-3 (CA-4): DocsPortalDocument no declara path, folderId ni fileName', () => {
    const block = component(read(), 'DocsPortalDocument');
    block.should.not.match(/^ {8}(path|folderId|fileName):/m);
    block.should.match(/^ {8}content:/m);
    block.should.match(/^ {8}contentUrl:/m);
    block.should.containEql("attachments: { type: array, items: { $ref: '#/components/schemas/DocsAttachment' }");
  });

  it('S-101 · TS-4 (CA-4): DocsPortalDocumentPage se apoya en el esquema del portal', () => {
    const block = component(read(), 'DocsPortalDocumentPage');
    block.should.containEql('required: [items, page]');
    block.should.containEql("items: { type: array, items: { $ref: '#/components/schemas/DocsPortalDocument' } }");
    block.should.containEql("page: { $ref: '#/components/schemas/DocsPageInfo' }");
  });

  it('S-101 · TS-5 (CA-4): el listado del portal responde DocsPortalDocumentPage', () => {
    const block = operation(read(), '/opus/docs/documents', 'get');
    block.should.containEql("schema: { $ref: '#/components/schemas/DocsPortalDocumentPage' }");
    block.should.not.containEql("#/components/schemas/DocsDocumentPage'");
  });

  it('S-101 · TS-6 (CA-4): el detalle del portal responde DocsPortalDocument', () => {
    const block = operation(read(), '/opus/docs/documents/{id}', 'get');
    block.should.containEql("schema: { $ref: '#/components/schemas/DocsPortalDocument' }");
    block.should.not.containEql("#/components/schemas/DocsDocument'");
  });

  it('S-101 · TS-7 (CA-5): DocsDocument se describe como pass-through de jiku-docs 1.3.0', () => {
    const block = component(read(), 'DocsDocument');
    const d = line(block, /^ {6}description:/);
    d.should.containEql('jiku-docs 1.3.0');
    d.should.containEql('clientRefs');
    d.should.containEql('projectRefs');
    d.should.containEql('Solo para la web');
    block.should.containEql("id: { type: string, pattern: '^[0-9A-HJKMNP-TV-Z]{26}$' }");
  });

  it('S-101 · TS-8 (CA-5): DocsDocument conserva path, folderId y fileName como pass-through', () => {
    const block = component(read(), 'DocsDocument');
    ['path', 'folderId', 'fileName'].forEach((f) => {
      block.should.match(new RegExp(`^ {8}${f}: \\{ type: string, description: "Pass-through de jiku-docs \\(CLI y sync\\)[^"]*La web no los muestra ni los usa \\(REQ-021\\)" \\}$`, 'm'));
    });
    line(block, /^ {8}fileName:/).should.containEql('solo en el detalle');
  });

  it('S-101 · TS-9 (CA-5): createdBy, updatedBy y lock.holder son el sub de Zitadel', () => {
    const block = component(read(), 'DocsDocument');
    block.split('\n').filter((l) => /(createdBy|updatedBy|holder): \{ type: string, description: /.test(l) && l.includes(SUB))
      .length.should.equal(3);
  });

  it('S-101 · TS-10 (CA-5): DocsVersion.author es el sub de Zitadel', () => {
    const block = component(read(), 'DocsVersion');
    line(block, /^ {8}author:/).trim().should.equal(`author: { type: string, description: "${SUB}" }`);
    line(block, /^ {8}authorName:/).should.containEql('nullable: true');
  });

  it('S-101 · TS-11 (CA-5): DocsSearchHit.path y DocsWriteResult.path/folderId/fileName son pass-through', () => {
    const spec = read();
    line(component(spec, 'DocsSearchHit'), /^ {8}path:/).should.containEql('Pass-through de jiku-docs; la web no lo usa');
    const w = component(spec, 'DocsWriteResult');
    line(w, /^ {8}path:/).should.containEql('Pass-through de jiku-docs; la web no lo usa');
    line(w, /^ {8}folderId:/).should.containEql('Pass-through de jiku-docs (>= 1.3.0); la web no lo usa');
    line(w, /^ {8}folderId:/).should.containEql("pattern: '^[0-9A-HJKMNP-TV-Z]{26}$'");
    line(w, /^ {8}fileName:/).should.containEql('Pass-through de jiku-docs (>= 1.3.0); la web no lo usa');
    w.should.containEql('required: [id, version]');
  });

  it('S-101 · TS-12 (CA-5): GET /docs/documents documenta los campos por defecto de 1.3.0', () => {
    const block = operation(read(), '/docs/documents', 'get');
    block.should.containEql('jiku-docs 1.3.0 verbatim');
    block.should.containEql('id, title, path, folderId, version, visibility, updatedAt, updatedBy, updatedByName, clients, projects');
    block.should.containEql("$ref: '#/components/schemas/DocsDocumentPage'");
  });

  it('S-101 · TS-13 (CA-5): detalle, búsqueda y alta de la web describen el pass-through', () => {
    const spec = read();
    const detail = operation(spec, '/docs/documents/{id}', 'get');
    detail.should.containEql('pass-through');
    detail.should.containEql('el `sub` de Zitadel');
    detail.should.containEql('DocsDocumentDetail');
    const search = operation(spec, '/docs/search', 'get');
    search.should.containEql('pass-through');
    search.should.containEql('DocsSearchResponse');
    const create = operation(spec, '/docs/documents', 'post');
    create.should.containEql('pass-through');
    create.should.containEql('DocsWriteResult');
  });

  it('S-101 · TS-14 (CA-5): los esquemas que siguen en uso se conservan', () => {
    const spec = read();
    ['DocsFolder', 'DocsFolderPage', 'DocsDocumentPage', 'DocsDocumentDetail'].forEach((n) => {
      spec.should.containEql(`\n    ${n}:`);
    });
    operation(spec, '/docs/folders', 'get').should.containEql("$ref: '#/components/schemas/DocsFolderPage'");
  });
});
