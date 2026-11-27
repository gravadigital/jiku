import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const appDir = path.resolve(__dirname, '..');

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

// R-6: /docs/attachments/[id] (fuera del grupo) convive con (loggedin)/docs/[id]/page.tsx.
describe('ruteo de documentación (R-6)', () => {
  it('TS-46: el handler de adjuntos vive fuera de (loggedin) y la página dentro', () => {
    expect(existsSync(path.join(appDir, 'docs/attachments/[id]/route.ts'))).toBe(true);
    expect(existsSync(path.join(appDir, '(loggedin)/docs/[id]/page.tsx'))).toBe(true);
    const routes = walk(path.join(appDir, '(loggedin)/docs')).filter((f) =>
      /route\.[jt]sx?$/.test(f)
    );
    expect(routes).toEqual([]);
  });
});
