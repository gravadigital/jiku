import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import 'should';

/**
 * LOS GATES ESTRUCTURALES DE S-073: CA-10 y CA-13.
 *
 * Son las dos propiedades que se rompen por OMISIÓN: nadie escribe un diff que diga "ahora el
 * proceso de envío conoce los tipos" — lo que pasa es que alguien agrega un `if` y nadie lo nota
 * en la revisión. El precedente es `contract-closure.test.ts:TS-87` (el gate de la genericidad
 * del motor de consultas) y `notifications.test.ts:TS-33` (el gate hermano de S-071, que este
 * test EXTIENDE a `dispatch/`).
 */

const DISPATCH_DIR = join(__dirname, '..', '..', 'src', 'notifications', 'dispatch');
const COMMANDS_DIR = join(__dirname, '..', '..', 'src', 'commands');
const DISPATCHER_FILE = join(__dirname, '..', '..', 'src', 'bus', 'dispatcher.ts');
const INDEX_FILE = join(__dirname, '..', '..', 'src', 'index.ts');
const REPO_ROOT = join(__dirname, '..', '..', '..');

/**
 * El código SIN COMENTARIOS, con el mismo criterio que `codeOf()` en `attachments.test.ts:687`.
 *
 * Lo que la propiedad dice es que `dispatch/` no CONOCE tipos —no que no los mencione al
 * explicarse—: este módulo necesita explicar EN COMENTARIOS por qué no conoce tipos (ver
 * `run-cycle.ts`, `claim-batch.ts`), y con la variante de S-071 (que no despoja comentarios) ni
 * siquiera podría nombrarlos al explicarse. El gate va sobre lo que se EJECUTA.
 */
function codeOf(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

function tsFilesIn(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => join(dir, name));
}

/**
 * LA LISTA PROHIBIDA para `dispatch/` (CA-10): los cuatro `type` de notificación, los cuatro
 * identificadores de `template`, y las palabras de recurso de dominio que la story nombra.
 *
 * SE ROMPE POR OMISIÓN: agregar un quinto tipo de notificación en `registry.ts` (por ejemplo
 * "tarea asignada") OBLIGA a agregar su `type` y su `template` acá también, o el gate queda
 * VERDE mientras `dispatch/` podría nombrarlo sin que nadie se entere — mismo criterio que
 * `RESOURCE_NAMES` en `contract-closure.test.ts`.
 */
const FORBIDDEN_STRINGS = [
  // Los cuatro `type` de notificación (registry.ts).
  'requirement.created',
  'requirement.resolved',
  'requirement.reopened',
  'requirement.comment.created',
  // Los cuatro identificadores de `template` (registry.ts).
  'requirement-created',
  'requirement-resolved',
  'requirement-reopened',
  'requirement-comment-created',
  // Recursos de dominio, exigidos por la story.
  'requirement',
  'objective',
  'task',
];

describe('notifications/dispatch — los gates estructurales de S-073', () => {
  it('TS-34 · ninguna línea de dispatch/ nombra un tipo ni un recurso de dominio', () => {
    const offenders: string[] = [];

    for (const file of tsFilesIn(DISPATCH_DIR)) {
      const code = codeOf(file);
      code.split('\n').forEach((line, index) => {
        for (const forbidden of FORBIDDEN_STRINGS) {
          if (line.includes(`'${forbidden}'`) || line.includes(`"${forbidden}"`)) {
            offenders.push(`${file}:${index + 1} -> ${line.trim()}`);
          }
        }
      });
    }

    offenders.should.deepEqual([]);
  });

  it('TS-35 · dispatch/ no importa ninguna plantilla concreta', () => {
    const offenders: string[] = [];

    for (const file of tsFilesIn(DISPATCH_DIR)) {
      const code = codeOf(file);
      if (/from\s+['"]\.\.\/templates\/requirement-/.test(code)) {
        offenders.push(file);
      }
    }

    offenders.should.deepEqual([]);
  });

  it('TS-22 · no se usa setInterval en dispatch/', () => {
    const offenders: string[] = [];

    for (const file of tsFilesIn(DISPATCH_DIR)) {
      const code = codeOf(file);
      if (code.includes('setInterval')) {
        offenders.push(file);
      }
    }

    offenders.should.deepEqual([]);
  });

  it('TS-42 · ningún comando ni el despachador tocan SMTP', () => {
    const offenders: string[] = [];

    function commandFiles(dir: string): string[] {
      return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          return commandFiles(full);
        }
        return entry.name.endsWith('.ts') ? [full] : [];
      });
    }

    const filesToCheck = [...commandFiles(COMMANDS_DIR), DISPATCHER_FILE];

    for (const file of filesToCheck) {
      const code = codeOf(file);
      if (
        code.includes('nodemailer') ||
        /from\s+['"].*notifications\/dispatch/.test(code) ||
        code.includes('SMTP_HOST') ||
        code.includes('SMTP_FROM')
      ) {
        offenders.push(file);
      }
    }

    offenders.should.deepEqual([]);
  });
});

describe('index.ts — arranque y parada del scheduler (CA-7)', () => {
  it('TS-23 · el arranque va después de host.start(), la parada antes de host.stop()', () => {
    const code = codeOf(INDEX_FILE);

    const hostStartPos = code.indexOf('await host.start()');
    const startLoopPos = code.indexOf('startDispatchLoop()');
    const stopLoopPos = code.indexOf('stopDispatchLoop()');
    const hostStopPos = code.indexOf('host.stop()');

    [hostStartPos, startLoopPos, stopLoopPos, hostStopPos].forEach((pos) => {
      (pos >= 0).should.be.true();
    });

    (startLoopPos > hostStartPos).should.be.true();
    (stopLoopPos < hostStopPos).should.be.true();
  });
});

describe('deploy — gates documentales de las seis variables (CA-11, CA-12)', () => {
  it('TS-37 · las seis están en deploy/.env.dist, SMTP_PASSWORD vacía', () => {
    const content = readFileSync(join(REPO_ROOT, 'deploy', '.env.dist'), 'utf8');

    for (const variable of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM', 'OPUS_URL']) {
      content.should.containEql(variable);
    }

    const passwordLine = content.split('\n').find((line) => line.startsWith('SMTP_PASSWORD='));
    (passwordLine !== undefined).should.be.true();
    passwordLine!.should.equal('SMTP_PASSWORD=');
  });

  it('TS-38 · las seis están en los tres docker-compose, bloque core:', () => {
    for (const file of ['docker-compose.yml', 'docker-compose.dev.yml', 'docker-compose.local.yml']) {
      const content = readFileSync(join(REPO_ROOT, 'deploy', file), 'utf8');
      for (const variable of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM', 'OPUS_URL']) {
        content.should.containEql(`${variable}=`);
      }
    }
  });

  it('TS-39 · las seis están en core/README.md, tabla Configuration', () => {
    const content = readFileSync(join(REPO_ROOT, 'core', 'README.md'), 'utf8');
    for (const variable of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM', 'OPUS_URL']) {
      content.should.containEql(variable);
    }
  });
});
