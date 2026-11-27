import fs from 'node:fs';
import path from 'node:path';

// Los valores de modo oscuro del handoff de identidad (design_handoff_jiku_identity) son
// EXPLÍCITOS, no derivados. S-059 los había calculado con la fórmula del DS (tinte 12% / borde
// 26% del pleno, compuesto sobre --color-dark-surface), y esa derivación produjo dos defectos
// que estos tests fijan:
//
//   1. El TEXTO de cada familia de estado no se redeclaraba en oscuro, así que quedaba el
//      profundo del modo claro (#8A5405 ámbar, #1F01B9 violeta) sobre un tinte oscuro. Las seis
//      familias fallaban contraste AA — el violeta daba 1.38:1.
//   2. Los tintes derivados no coinciden con los del manual de marca, que declara un trío
//      propio por familia y por modo.
//
// El contraste se calcula acá y no se asume: es la razón de ser del cambio.
const REFERENCE_PATH = path.resolve(__dirname, '_reference.scss');
const SEMANTIC_PATH = path.resolve(__dirname, '_semantic.scss');

const relativeLuminance = (hex: string): number => {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};

const contrastRatio = (foreground: string, background: string): number => {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a
  );
  return (lighter + 0.05) / (darker + 0.05);
};

// Los tríos del handoff: tinte de fondo / borde / texto, por familia, en modo oscuro.
const DARK_TINTS = {
  green: { bg: '#12312D', border: '#1D4A43', text: '#61CCB9' },
  aqua: { bg: '#14322F', border: '#205049', text: '#A9E4DA' },
  amber: { bg: '#33240E', border: '#5A3F16', text: '#FEC97A' },
  red: { bg: '#351514', border: '#5C2320', text: '#FF8A84' },
  violet: { bg: '#1B1740', border: '#2E2769', text: '#A9A0FF' },
  graphite: { bg: '#232A38', border: '#313A4B', text: '#B9C0CC' },
} as const;

describe('modo oscuro — tintes del manual de marca', () => {
  const reference = fs.readFileSync(REFERENCE_PATH, 'utf-8');
  const semantic = fs.readFileSync(SEMANTIC_PATH, 'utf-8');

  const declaredValue = (source: string, token: string): string | null => {
    const match = new RegExp(`${token}\\s*:\\s*([^;]+);`).exec(source);
    return match ? match[1].trim() : null;
  };

  describe('tier 1 — los primitivos declaran los valores del handoff', () => {
    for (const [family, trio] of Object.entries(DARK_TINTS)) {
      it(`--color-dark-tint-${family} es ${trio.bg}`, () => {
        expect(declaredValue(reference, `--color-dark-tint-${family}`)?.toUpperCase()).toBe(
          trio.bg
        );
      });

      it(`--color-dark-tint-border-${family} es ${trio.border}`, () => {
        expect(declaredValue(reference, `--color-dark-tint-border-${family}`)?.toUpperCase()).toBe(
          trio.border
        );
      });

      it(`--color-dark-deep-${family} es ${trio.text} (el texto sí cambia en oscuro)`, () => {
        expect(declaredValue(reference, `--color-dark-deep-${family}`)?.toUpperCase()).toBe(
          trio.text
        );
      });
    }
  });

  describe('tier 2 — el texto de cada familia se redeclara en oscuro', () => {
    // El bloque :root[data-theme='dark'] completo, para no matchear el :root claro de arriba.
    const darkBlock = /:root\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/.exec(semantic)?.[1] ?? '';

    const FAMILY_BY_TOKEN = {
      'state-resolved-text': 'green',
      'state-in-progress-text': 'aqua',
      'state-review-text': 'amber',
      'state-urgent-text': 'red',
      'state-analysis-text': 'violet',
      'state-neutral-text': 'graphite',
    } as const;

    for (const [token, family] of Object.entries(FAMILY_BY_TOKEN)) {
      it(`--${token} apunta a --color-dark-deep-${family}`, () => {
        expect(darkBlock).toMatch(
          new RegExp(`--${token}\\s*:\\s*var\\(--color-dark-deep-${family}\\)`)
        );
      });
    }
  });

  describe('contraste AA del texto sobre su tinte', () => {
    for (const [family, trio] of Object.entries(DARK_TINTS)) {
      it(`${family}: ${trio.text} sobre ${trio.bg} alcanza 4.5:1`, () => {
        expect(contrastRatio(trio.text, trio.bg)).toBeGreaterThanOrEqual(4.5);
      });
    }
  });

  describe('superficies propias del modo oscuro', () => {
    it('--color-dark-sidebar es #0B1319 — el sidebar es más oscuro que el canvas', () => {
      expect(declaredValue(reference, '--color-dark-sidebar')?.toUpperCase()).toBe('#0B1319');
    });

    it('--color-dark-border es #2A3141, no la superficie', () => {
      // Antes --border-default resolvía a --color-dark-surface (#1B202C): el borde era del
      // mismo color que la card que enmarcaba, así que no separaba nada.
      expect(declaredValue(reference, '--color-dark-border')?.toUpperCase()).toBe('#2A3141');
    });

    it('--color-dark-row-alt es #161C27, distinto del canvas', () => {
      expect(declaredValue(reference, '--color-dark-row-alt')?.toUpperCase()).toBe('#161C27');
    });

    it('--color-dark-input-bg es #141A24', () => {
      expect(declaredValue(reference, '--color-dark-input-bg')?.toUpperCase()).toBe('#141A24');
    });

    it('--color-dark-body es #C6CCD8 — el cuerpo no es el mismo blanco que el título', () => {
      expect(declaredValue(reference, '--color-dark-body')?.toUpperCase()).toBe('#C6CCD8');
    });

    it('--border-default en oscuro resuelve al borde propio, no a la superficie', () => {
      const darkBlock = /:root\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/.exec(semantic)?.[1] ?? '';
      expect(darkBlock).toMatch(/--border-default\s*:\s*var\(--color-dark-border\)/);
      expect(darkBlock).not.toMatch(/--border-default\s*:\s*var\(--color-dark-surface\)/);
    });

    it('--text-link se redeclara en oscuro al verde agua (el texto verde sí cambia)', () => {
      const darkBlock = /:root\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/.exec(semantic)?.[1] ?? '';
      expect(darkBlock).toMatch(/--text-link\s*:\s*var\(--color-aqua\)/);
    });
  });

  describe('el acento no cambia entre modos', () => {
    const darkBlock = /:root\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/.exec(semantic)?.[1] ?? '';

    // Regla dura del handoff: "El acento nunca cambia entre modos". --text-link es la única
    // excepción declarada por el propio manual (el TEXTO verde pasa a #61CCB9 en oscuro).
    for (const token of [
      'bg-action-primary',
      'bg-active',
      'border-action',
      'border-focus',
      'border-required',
      'text-on-action',
    ]) {
      it(`--${token} no se redeclara en oscuro`, () => {
        expect(darkBlock).not.toMatch(new RegExp(`--${token}\\s*:`));
      });
    }
  });
});
