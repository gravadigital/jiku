import 'mocha';
import 'should';
import { readFileSync } from 'fs';
import path from 'path';

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

  // TS-22: ninguna clave '503' o '504' apunta a otro componente. Es lo que impide que una
  // operación "declare el 504" con una respuesta inline que diga otra cosa: el texto se escribe
  // UNA vez, en el componente compartido, y las operaciones solo lo referencian.
  it('TS-22: ninguna clave 503 o 504 referencia otro componente', () => {
    const huerfanas = specLines().filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("'503':")) {
        return !trimmed.includes("#/components/responses/BusUnavailable");
      }
      if (trimmed.startsWith("'504':")) {
        return !trimmed.includes("#/components/responses/GatewayTimeout");
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
