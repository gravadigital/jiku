import fs from 'node:fs';
import path from 'node:path';

// TS-111/TS-112/TS-115 (S-060, T7): globals.scss no declara custom properties (el :root
// duplicado ya no existe) y las reglas globales de tipografía h1/h2/p (font-family legacy,
// tamaños y peso fuera de escala) se dieron de baja — cada vista resuelve su tipografía con
// tokens semánticos sobre clase propia.
const GLOBALS_PATH = path.resolve(__dirname, 'globals.scss');

const OLD_SYSTEM_TOKENS = [
  '--font-primary',
  '--color-error',
  '--color-text-muted',
  '--radius-buttons',
  '--color-general-title',
  '--color-button',
  '--color-surface-light',
  '--color-general-text',
  '--color-general-border',
  '--font-size-base',
  '--spacing-sm',
  '--spacing-md',
  '--spacing-lg',
];

describe('globals.scss — cierre de deuda de tokens (T7)', () => {
  const source = fs.readFileSync(GLOBALS_PATH, 'utf-8');

  it('TS-111: no declara ninguna custom property (el :root duplicado ya no existe)', () => {
    expect(source).not.toMatch(/^\s*--[a-z][a-z0-9-]*\s*:/m);
  });

  it('TS-112: no queda ninguna regla global desnuda de h1', () => {
    expect(source).not.toMatch(/^h1\s*\{/m);
  });

  it('TS-112: no queda ninguna regla global desnuda de h2', () => {
    expect(source).not.toMatch(/^h2\s*\{/m);
  });

  it('TS-112: no queda ninguna regla global desnuda de p (fuera del reset universal)', () => {
    // El selector universal de reset (línea 10-22) incluye "p" en su lista, eso es
    // legítimo (reset, no una regla de tipografía con valores). Lo que no debe existir es
    // un bloque "p {" standalone con font-family/size/weight propios.
    expect(source).not.toMatch(/^p\s*\{/m);
  });

  it.each(OLD_SYSTEM_TOKENS)('no consume el token legacy %s', (token) => {
    expect(source).not.toContain(token);
  });

  it('no lleva hex literal', () => {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('TS-115: no declara --font-ui (nombre inexistente; el correcto es --font-family-ui)', () => {
    expect(source).not.toMatch(/--font-ui\b/);
  });
});
