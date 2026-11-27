import fs from 'node:fs';
import path from 'node:path';

// TS-110 (S-060, T7): los 24 consumos de tokens legacy de _mixins.scss migrados a tokens
// semánticos — cierra la raíz de la deuda de tipografía/espaciado/color que se propagaba a
// cualquier componente que usara @include heading-2, tag-base, etc.
const MIXINS_PATH = path.resolve(__dirname, '_mixins.scss');

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

describe('_mixins.scss — cierre de deuda de tokens legacy (T7)', () => {
  const source = fs.readFileSync(MIXINS_PATH, 'utf-8');

  it.each(OLD_SYSTEM_TOKENS)('no consume el token legacy %s', (token) => {
    expect(source).not.toContain(token);
  });

  it('no lleva hex literal (ni siquiera como default de un mixin)', () => {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('no queda el magenta descontinuado como default de icon-tint', () => {
    const magentaPattern = new RegExp('#DA2C6' + '[AB]', 'i');
    expect(source).not.toMatch(magentaPattern);
  });
});
