import 'mocha';
import 'should';
import * as fs from 'fs';
import * as path from 'path';

/** Todos los `.ts` bajo `dir`, recursivo. */
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(full);
    }
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

/**
 * S-076 TS-19 · (gate) core no tiene ningún camino que purgue archivos.
 *
 * RF-11: jiku-docs sube archivos que NUNCA vincula a nada, y espera poder descargarlos mientras
 * estén activos. Hoy core no barre archivos sin vínculo. Si alguien agrega un barrido (o cualquier
 * escritura de `scheduled_for_deletion` / `deleted`), este test falla nombrando el archivo, para
 * que la decisión sea explícita y no un efecto colateral.
 *
 * Puro, sin base: lee `core/src/` con `fs` y quita los comentarios antes de buscar, igual que el
 * gate de `caller-class.test.ts`.
 */
describe('files · gate de retención (S-076 TS-19)', () => {
  it('ningún `.ts` de `core/src/` escribe un estado de purga de archivos', () => {
    const forbidden = [
      /RetentionStatus\.ScheduledForDeletion/,
      /RetentionStatus\.Deleted/,
      /['"]scheduled_for_deletion['"]/,
    ];
    const offenders: string[] = [];

    for (const file of sourceFiles(path.join(__dirname, '../../src'))) {
      const code = fs
        .readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      if (forbidden.some((pattern) => pattern.test(code))) {
        offenders.push(path.relative(path.join(__dirname, '../..'), file));
      }
    }

    offenders.should.deepEqual(
      [],
      `Una purga de archivos sin vínculo rompe a jiku-docs (RF-11): ${offenders.join(', ')}`
    );
  });
});
