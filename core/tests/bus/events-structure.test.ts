import 'mocha';
import 'should';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { eventsStreamSubject, INSTANCE } from '@jiku/nats-protocol';

/** Todos los archivos `.ts` bajo un directorio, recursivamente. */
function listTsFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listTsFiles(full);
    }
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

const COMMANDS_DIR = path.join(__dirname, '../../src/commands');
const SRC_DIR = path.join(__dirname, '../../src');
const TEMPLATES_DIR = path.join(__dirname, '../../../deploy/nats/auth-callout/templates');

/**
 * El patrón prohibido de ADR-008: el wildcard de eventos SIN la versión. Se arma reemplazando
 * `INSTANCE` por el placeholder de plantilla en `eventsStreamSubject()` (D-4) — nunca un literal
 * `'dev.events.v1.>'` a mano, porque `eventsStreamSubject()` es la única fuente de ese patrón.
 */
const VERSIONED_WILDCARD = eventsStreamSubject().replace(INSTANCE, '{{instance}}');
const UNVERSIONED_WILDCARD = '{{instance}}.events.>';

/**
 * Gates estructurales de S-063 y S-067 (Task 7 de S-063, Task 1 de S-067), con el mismo criterio
 * que los que ya existen en el codebase (*"ninguna línea de `src/queries/engine/` puede nombrar
 * un recurso"*, *"`user-sync.ts` no tiene ningún `User.create`/`User.findByPk`/`.update(`
 * propio"*): un `grep` con nombre explícito, para que quien lo rompa lea acá por qué existe.
 */
describe('bus/events-structure — gates estructurales de S-063 y S-067', () => {
  it('CA-4 / ADR-003 · NINGÚN archivo de src/commands/ publica ni importa el publicador', () => {
    const offenders: string[] = [];

    for (const file of listTsFiles(COMMANDS_DIR)) {
      const content = fs.readFileSync(file, 'utf-8');
      // `.publish(` cubriría tanto un `EventPublisher.publish()` como un `jetstream().publish()`.
      // `jetstream(` cubre el caso de que alguien evite el nombre `publish` importando el cliente
      // directo. El import del módulo del publicador es la tercera vía: ni siquiera IMPORTARLO.
      const publishesDirectly = /\.publish\(/.test(content);
      const usesJetstream = /jetstream\(/.test(content);
      const importsPublisher = /from ['"].*event-publisher['"]/.test(content);

      if (publishesDirectly || usesJetstream || importsPublisher) {
        offenders.push(path.relative(SRC_DIR, file));
      }
    }

    offenders.should.deepEqual(
      [],
      `Un comando DECLARA eventos en Reply.events, NUNCA publica (ADR-003). ` +
        `Archivos que violan esto: ${offenders.join(', ')}`
    );
  });

  it('CA-1 · el subject de un evento SOLO se arma con eventSubject()', () => {
    const offenders: string[] = [];
    // El patrón busca, LÍNEA POR LÍNEA (no todo el archivo, para no cruzar backticks de
    // comentarios y código como si fueran un solo template literal), un template string que
    // contenga el patrón `events.v1` o `events.${` — la forma en que una concatenación manual
    // del subject de eventos de dominio se vería en este codebase. `events.auth` (el evento
    // ENTRANTE, sin versión, S-016) queda deliberadamente afuera: no es del contrato de S-063.
    const MANUAL_SUBJECT_LINE = /`[^`]*events\.(v\d+|\$\{)[^`]*`/;

    for (const file of listTsFiles(SRC_DIR)) {
      // El archivo que llama al helper legítimamente (`emit-events.ts`, que SÍ usa
      // `eventSubject()`) queda afuera del barrido — es el único lugar donde el subject se arma,
      // y lo hace bien.
      if (file.endsWith(path.join('bus', 'emit-events.ts'))) {
        continue;
      }

      const lines = fs.readFileSync(file, 'utf-8').split('\n');
      if (lines.some((line) => MANUAL_SUBJECT_LINE.test(line))) {
        offenders.push(path.relative(SRC_DIR, file));
      }
    }

    offenders.should.deepEqual(
      [],
      `El subject de un evento se arma SOLO con eventSubject() (@jiku/nats-protocol). ` +
        `Archivos con una posible concatenación manual: ${offenders.join(', ')}`
    );
  });

  it('CA-1, CA-2 (S-067) · connector.yaml declara el wildcard CON versión, y NINGÚN template lo declara sin ella', () => {
    // Parsear, no `grep` de texto crudo: el propio encabezado de `connector.yaml` MENCIONA el
    // patrón prohibido para explicar por qué está prohibido, y un `grep` de texto lo tomaría como
    // ofensor. Es la trampa concreta de esta task (Implementation Notes, Task 1 de S-067).
    const connectorPath = path.join(TEMPLATES_DIR, 'connector.yaml');
    fs.existsSync(connectorPath).should.be.true(
      `Falta la plantilla de conector: ${connectorPath}`
    );
    const connector = yaml.load(fs.readFileSync(connectorPath, 'utf-8')) as {
      pub?: { allow?: string[] };
      sub?: { allow?: string[] };
    };

    (connector.sub?.allow || []).should.containEql(VERSIONED_WILDCARD);
    (connector.sub?.allow || []).should.not.containEql(UNVERSIONED_WILDCARD);
    // EL PERMISO DE JETSTREAM VA ACOTADO AL STREAM, NO ES `$JS.API.>`. El comodín entero es
    // administración completa de JetStream sobre la cuenta —borrar, vaciar y reconfigurar
    // CUALQUIER stream, JIKU_EVENTS incluido— y un conector es un LECTOR. Se enumera lo que un
    // consumidor durable usa y nada más (ADR-008 en el plano de JetStream).
    // `containEql` no acepta mensaje propio, así que la aserción va sobre el filtro: si la
    // línea prohibida está, el array no está vacío y el mensaje la nombra.
    (connector.pub?.allow || [])
      .filter((a) => a === '$JS.API.>')
      .should.deepEqual(
        [],
        'Un conector NO puede tener administración completa de JetStream: acotá el permiso al stream'
      );
    for (const subject of [
      '$JS.API.INFO',
      '$JS.API.CONSUMER.CREATE.JIKU_EVENTS.>',
      '$JS.API.CONSUMER.INFO.JIKU_EVENTS.>',
      '$JS.API.CONSUMER.MSG.NEXT.JIKU_EVENTS.>',
    ]) {
      (connector.pub?.allow || []).should.containEql(subject);
    }
    // Y NINGUNA LÍNEA DE ADMINISTRACIÓN DE STREAMS: ni borrar, ni vaciar, ni reconfigurar.
    const streamAdmin = (connector.pub?.allow || []).filter((a) =>
      a.startsWith('$JS.API.STREAM.')
    );
    streamAdmin.should.deepEqual(
      [],
      `Un conector no administra streams (borrar/vaciar/reconfigurar): ${streamAdmin.join(', ')}`
    );
    (connector.sub?.allow || []).should.containEql('_INBOX.{{user_id_hash}}.>');
    (connector.pub?.allow || []).should.not.containEql('_INBOX.{{user_id_hash}}.>');

    // La segunda mitad, la que hace de CA-2 una regla y no un párrafo: NINGÚN template puede
    // declarar el wildcard sin versión. Es lo que impide que la política se afloje copiando y
    // pegando un template dentro de seis meses.
    //
    // LA EXCEPCIÓN DE `observer.yaml` SE ELIMINÓ CON LA PLANTILLA. Era el rol de diagnóstico
    // local `bus-observer`, cuyo propósito ERA ver todo; al eliminarse el rol, la regla ya no
    // tiene excepciones y el chequeo recorre TODOS los templates del directorio.
    const offenders: string[] = [];
    for (const file of fs.readdirSync(TEMPLATES_DIR)) {
      if (!file.endsWith('.yaml')) {
        continue;
      }
      const doc = yaml.load(fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf-8')) as {
        pub?: { allow?: string[] };
        sub?: { allow?: string[] };
      };
      const allAllows = [...(doc.pub?.allow || []), ...(doc.sub?.allow || [])];
      if (allAllows.includes(UNVERSIONED_WILDCARD)) {
        offenders.push(file);
      }
    }

    offenders.should.deepEqual(
      [],
      `Ningún template puede declarar "${UNVERSIONED_WILDCARD}" ` +
        `(ADR-008): se comería {{instance}}.events.auth. Ofensores: ${offenders.join(', ')}`
    );
  });
});
