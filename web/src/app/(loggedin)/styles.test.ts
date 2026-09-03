import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const scssPath = path.resolve(__dirname, './styles.module.scss');
const content = fs.readFileSync(scssPath, 'utf8');

describe('(loggedin)/styles.module.scss — T4/T8 (TS-56)', () => {
  it('el padding de .mainContainer resuelve a 32px vía token (var(--space-8)), no 1rem 2rem', () => {
    expect(content).toMatch(/padding:\s*var\(--space-8\)/);
    expect(content).not.toMatch(/padding:\s*1rem 2rem/);
  });

  it('no contiene tokens del sistema viejo (--color-surface-light, --color-general-background)', () => {
    expect(content).not.toMatch(/--color-surface-light\b/);
    expect(content).not.toMatch(/--color-general-background\b/);
  });

  it('no declara el ancho del sidebar en 290px (lo declara SidebarNav en 300px)', () => {
    expect(content).not.toMatch(/290px/);
  });
});
