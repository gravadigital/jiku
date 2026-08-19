// @vitest-environment node
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * TS-11 — verificación negativa de CA-2: el endpoint de subida vive bajo `/api/opus/*`,
 * así que el proxy catch-all lo cubre y NO debe existir ningún handler propio para él.
 */
describe('árbol de route handlers bajo src/app/api/opus', () => {
  const opusDir = join(process.cwd(), 'src/app/api/opus');

  it('el único handler bajo api/opus sigue siendo el catch-all', () => {
    const entries = readdirSync(opusDir);
    expect(entries).toEqual(['[...path]']);
    expect(readdirSync(join(opusDir, '[...path]'))).toEqual(['route.ts']);
  });

  it('no existe un handler propio para el POST de subida', () => {
    expect(() => statSync(join(opusDir, 'attachments/route.ts'))).toThrow();
    expect(() => statSync(join(opusDir, 'attachments'))).toThrow();
  });
});
