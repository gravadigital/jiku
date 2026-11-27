import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const scssPath = path.resolve(__dirname, './styles.module.scss');
const content = fs.readFileSync(scssPath, 'utf8');

describe('login/styles.module.scss — T7/T8 (CA-1)', () => {
  it('TS-70: no contiene --color-general-primary ni #FF3C3C', () => {
    expect(content).not.toMatch(/--color-general-primary/);
    expect(content).not.toMatch(/#FF3C3C/i);
  });

  it('TS-71: no contiene tokens del sistema viejo (--font-primary, --color-general-title, --color-text-placeholder, --radius-items)', () => {
    expect(content).not.toMatch(/--font-primary\b/);
    expect(content).not.toMatch(/--color-general-title\b/);
    expect(content).not.toMatch(/--color-text-placeholder\b/);
    expect(content).not.toMatch(/--radius-items\b/);
  });

  it('TS-71: no quedan clases .inputSection, .inputBox ni .error sin consumidor', () => {
    expect(content).not.toMatch(/\.inputSection/);
    expect(content).not.toMatch(/\.inputBox/);
    expect(content).not.toMatch(/^\.error\b/m);
  });

  it('TS-73: no referencia loginBackground.png ni el gradiente descontinuado', () => {
    expect(content).not.toMatch(/loginBackground/);
    expect(content).not.toMatch(/#EB1433/i);
    expect(content).not.toMatch(/#FEAE97/i);
  });
});
