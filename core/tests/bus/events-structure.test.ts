import 'mocha';
import 'should';
import * as fs from 'fs';
import * as path from 'path';

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

/**
 * Gates estructurales de S-063 (Task 7), con el mismo criterio que los que ya existen en el
 * codebase (*"ninguna línea de `src/queries/engine/` puede nombrar un recurso"*, *"`user-sync.ts`
 * no tiene ningún `User.create`/`User.findByPk`/`.update(` propio"*): un `grep` con nombre
 * explícito, para que quien lo rompa lea acá por qué existe.
 */
describe('bus/events-structure — gates estructurales de S-063', () => {
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
});
