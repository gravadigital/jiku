import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const root = join(__dirname, '..');

const referenceScss = readFileSync(join(root, 'src/styles/_reference.scss'), 'utf8');
const semanticScss = readFileSync(join(root, 'src/styles/_semantic.scss'), 'utf8');
const componentScss = readFileSync(join(root, 'src/styles/_component.scss'), 'utf8');
const indexScss = readFileSync(join(root, 'src/styles/index.scss'), 'utf8');
const globalsScss = readFileSync(join(root, 'src/app/globals.scss'), 'utf8');
const variablesScss = readFileSync(join(root, 'src/styles/_variables.scss'), 'utf8');
const layoutTsx = readFileSync(join(root, 'src/app/layout.tsx'), 'utf8');
const logoMd = readFileSync(
  join(root, '../docs/design-system/web/foundations/logo.md'),
  'utf8'
);

function grep(pattern: string, dir = 'src'): string {
  try {
    return execSync(`grep -rn -- ${JSON.stringify(pattern)} ${dir}`, {
      cwd: root,
      encoding: 'utf8',
    });
  } catch {
    // grep sale con 1 cuando no hay coincidencias
    return '';
  }
}

// Extrae { nombre: valor } de todas las declaraciones --custom-prop: valor; de un bloque de texto
function extractDeclarations(scss: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /(--[\w-]+):\s*([^;]+);/g;
  let match;
  while ((match = regex.exec(scss)) !== null) {
    result[match[1]] = match[2].trim();
  }
  return result;
}

describe('Tier 1 — Reference (S-052)', () => {
  const ref = extractDeclarations(referenceScss);

  it('TS-1: declara los primitivos de marca con sus hexadecimales exactos', () => {
    expect(ref['--color-aqua']).toBe('#61CCB9');
    expect(ref['--color-deep-blue']).toBe('#0B1934');
    expect(ref['--color-mist']).toBe('#F6F6F9');
    expect(ref['--color-graphite']).toBe('#626C78');
    expect(ref['--color-aqua-deep']).toBe('#12897A');
  });

  it('TS-2: declara exactamente cuatro radios, sin intermedios', () => {
    const radii = Object.keys(ref).filter((k) => /^--radius-/.test(k));
    expect(radii.sort()).toEqual(['--radius-10', '--radius-14', '--radius-8', '--radius-999']);
    expect(ref['--radius-8']).toBe('8px');
    expect(ref['--radius-10']).toBe('10px');
    expect(ref['--radius-14']).toBe('14px');
    expect(ref['--radius-999']).toBe('999px');
  });

  it('TS-3: declara las tres duraciones de motion', () => {
    expect(ref['--duration-fast']).toBe('150ms');
    expect(ref['--duration-base']).toBe('200ms');
    expect(ref['--duration-slow']).toBe('300ms');
  });

  it('TS-4: declara el z-index en el orden corregido dropdown < navbar < modal < tooltip', () => {
    expect(ref['--z-dropdown']).toBe('100');
    expect(ref['--z-navbar']).toBe('200');
    expect(ref['--z-modal']).toBe('300');
    expect(ref['--z-tooltip']).toBe('400');
  });

  it('el tier reference no contiene ninguna referencia var(--...): todo son literales', () => {
    // Sólo el bloque :root de este archivo, sin comentarios
    expect(referenceScss).not.toMatch(/:\s*var\(/);
  });
});

describe('Tier 2 — Semantic (S-052)', () => {
  const refNames = new Set(Object.keys(extractDeclarations(referenceScss)));
  // Sólo el bloque :root base (sin el data-theme='dark'), para no mezclar los dos.
  const baseRootMatch = semanticScss.match(/^:root\s*\{([\s\S]*?)\n\}/m);
  const sem = extractDeclarations(baseRootMatch![1]);

  const allowedLiterals = new Set(['transparent', 'none']);

  it('TS-5: todo valor del tier semántico es var(--<primitivo>), var(--<semantico hermano>) o un literal permitido', () => {
    const semNames = new Set(Object.keys(sem));
    for (const [name, value] of Object.entries(sem)) {
      const varMatch = value.match(/^var\((--[\w-]+)\)$/);
      if (varMatch) {
        // --state-neutral-text apunta a text.secondary (semántico hermano) por spec del DS.
        const isKnown = refNames.has(varMatch[1]) || semNames.has(varMatch[1]);
        expect(isKnown, `${name}: ${varMatch[1]} no está en reference ni en semantic`).toBe(true);
        continue;
      }
      const isAllowedLiteral = allowedLiterals.has(value) || /^rgba\(97,\s*204,\s*185,\s*\.08\)$/.test(value);
      expect(isAllowedLiteral, `${name}: valor inesperado "${value}"`).toBe(true);
    }
  });

  it('TS-5b: cero hexadecimales crudos en el tier semántico', () => {
    expect(semanticScss).not.toMatch(/#[0-9A-Fa-f]{3,6}/);
  });

  it('TS-6: el botón primario mapea a verde agua con texto azul oscuro', () => {
    expect(sem['--bg-action-primary']).toBe('var(--color-aqua)');
    expect(sem['--text-on-action']).toBe('var(--color-deep-blue)');
  });

  it('TS-7: el enlace verde usa el verde profundo, nunca el verde agua', () => {
    expect(sem['--text-link']).toBe('var(--color-aqua-deep)');
    expect(sem['--text-link']).not.toBe('var(--color-aqua)');
  });

  it('TS-8: el bloque de modo oscuro existe y no está activo por defecto', () => {
    expect(semanticScss).toMatch(/\[data-theme=['"]dark['"]\]/);

    const darkBlockMatch = semanticScss.match(/\[data-theme=['"]dark['"]\]\s*\{([^}]*)\}/);
    expect(darkBlockMatch).not.toBeNull();
    const darkBlock = darkBlockMatch![1];

    expect(darkBlock).toMatch(/--bg-canvas:\s*var\(--color-dark-canvas\);/);
    expect(darkBlock).toMatch(/--bg-surface:\s*var\(--color-dark-surface\);/);

    // Las mismas declaraciones no están en el :root base con el valor de modo oscuro
    expect(sem['--bg-canvas']).not.toBe('var(--color-dark-canvas)');
    expect(sem['--bg-surface']).not.toBe('var(--color-dark-surface)');

    // El acento no se redeclara en modo oscuro
    expect(darkBlock).not.toMatch(/--bg-action-primary/);
  });
});

describe('Tier 3 — Component (S-052)', () => {
  const semNames = new Set(Object.keys(extractDeclarations(semanticScss)));
  const comp = extractDeclarations(componentScss);

  // --size-*, --icon-* y --duration-* son primitivos ESTRUCTURALES/de motion (no de color) que
  // el propio tier component.md del DS referencia directo (button.height : size.40,
  // nav.icon.size : icon.22, loader.duration : duration.slow), sin pasar por un alias semántico:
  // no son "intención" como los colores, son medidas y tiempos fijos. Ver TS-10/TS-11 en el Story
  // Plan y el bloque verbatim de "Tokens — Tier 3 Component".
  const structuralPrimitiveException = /^var\(--(size|icon)-\d+\)$/;
  const namedStructuralPrimitiveException = new Set(['var(--duration-slow)']);

  // --nav-item-icon: color.graphite es una excepción documentada IGUAL en el bloque verbatim de
  // component.md del Story Plan (línea "nav.item.icon : color.graphite"): el DS mismo referencia
  // el primitivo de color directo, sin semántico intermedio. Anotado como inconsistencia menor de
  // la spec del DS (no hay `border.strong`-like semántico para "icono de estructura"), pero se
  // implementa verbatim porque no es criterio de esta story reabrir esa decisión (Task 7: "no
  // reabrir decisiones del DS").
  const documentedPrimitiveExceptions = new Set(['--nav-item-icon']);

  it('TS-9: todo valor del tier component es var(--<semantico>) (o excepciones estructurales documentadas), cero hex', () => {
    expect(componentScss).not.toMatch(/#[0-9A-Fa-f]{3,6}/);

    for (const [name, value] of Object.entries(comp)) {
      if (value === 'transparent' || value === 'none' || /^\d+px$/.test(value)) {
        continue;
      }
      if (
        structuralPrimitiveException.test(value) ||
        namedStructuralPrimitiveException.has(value) ||
        documentedPrimitiveExceptions.has(name)
      ) {
        continue;
      }
      const varMatch = value.match(/^var\((--[\w-]+)\)$/);
      expect(varMatch, `${name}: valor inesperado "${value}"`).not.toBeNull();
      expect(semNames.has(varMatch![1]), `${name}: ${varMatch![1]} no está en semantic`).toBe(
        true
      );
    }
  });

  it('TS-10: la familia button declara los tokens del DS', () => {
    expect(comp['--button-radius']).toBe('var(--radius-action)');
    expect(comp['--button-height']).toBe('var(--size-40)');
    expect(comp['--button-primary-bg']).toBe('var(--bg-action-primary)');
    expect(comp['--button-primary-text']).toBe('var(--text-on-action)');
    expect(comp['--button-focus']).toBe('var(--focus-ring)');
  });

  it('TS-11: la familia nav (sidebar) declara los tokens del DS', () => {
    expect(comp['--nav-item-height']).toBe('var(--size-48)');
    expect(comp['--nav-item-font']).toBe('var(--text-nav-item-family)');
    expect(comp['--nav-item-active-bar']).toBe('var(--bg-active)');
    expect(comp['--nav-subitem-active-bg']).toBe('var(--bg-active-subtle)');
    expect(comp['--nav-wordmark']).toBe('var(--text-wordmark-family)');
  });
});

describe('Índice de estilos (S-052)', () => {
  it('TS-12: forwardea los tres tiers en orden reference -> semantic -> component', () => {
    const order = ['reference', 'semantic', 'component'].map((name) =>
      indexScss.indexOf(`@forward '${name}';`)
    );
    expect(order.every((i) => i !== -1)).toBe(true);
    expect(order[0]).toBeLessThan(order[1]);
    expect(order[1]).toBeLessThan(order[2]);
  });
});

describe(':root duplicado eliminado de globals.scss (S-052)', () => {
  it('TS-13: cero bloques :root propios en globals.scss', () => {
    const rootBlocks = globalsScss.match(/(?<!\[data-theme=['"]dark['"]\]\s*)^:root\s*\{/gm);
    expect(rootBlocks).toBeNull();
  });

  it('TS-14: los 56 tokens borrados siguen declarados en _variables.scss con el mismo valor', () => {
    const expected: Record<string, string> = {
      '--box-shadow': '0 2px 6px -2px rgb(0 0 0 / 16%), 0 2px 6px 0 rgb(0 0 0 / 12%)',
      '--color-general-title': '#1F2633',
      '--color-general-background': '#F5F2F0',
      '--color-button': '#DA2C6A',
      '--color-status-activo': '#2EBE27',
      '--color-priority-3': '#FB6B03',
      '--color-link-primary': '#ed2c6c',
      '--radius-cards': '1rem',
    };
    const vars = extractDeclarations(variablesScss);
    for (const [name, value] of Object.entries(expected)) {
      expect(vars[name], `${name} no está en _variables.scss`).toBe(value);
    }
  });

  it('--color-table-text (único en _variables.scss) sigue disponible', () => {
    const vars = extractDeclarations(variablesScss);
    expect(vars['--color-table-text']).toBe('#626a81');
  });
});

describe('Tipografía Sora + Gabarito (S-052)', () => {
  it('TS-16: el layout raíz carga Sora como --font-display con peso 700', () => {
    expect(layoutTsx).toMatch(/import\s*\{[^}]*Sora[^}]*\}\s*from\s*'next\/font\/google'/);
    expect(layoutTsx).toMatch(/variable:\s*'--font-display'/);
    expect(layoutTsx).toMatch(/weight:\s*\[[^\]]*'700'[^\]]*\]/);
    expect(layoutTsx).toMatch(/subsets:\s*\['latin'\]/);
  });

  it('TS-17: el layout raíz carga Gabarito como --font-ui con los cuatro pesos', () => {
    expect(layoutTsx).toMatch(/import\s*\{[^}]*Gabarito[^}]*\}\s*from\s*'next\/font\/google'/);
    expect(layoutTsx).toMatch(/variable:\s*'--font-ui'/);
    expect(layoutTsx).toMatch(/weight:\s*\['400',\s*'500',\s*'600',\s*'700'\]/);
  });

  it('TS-18: Archivo ya no se importa desde next/font/google', () => {
    const hits = grep("Archivo");
    const fontImportHits = hits
      .split('\n')
      .filter((line) => line.includes("from 'next/font/google'") && line.includes('Archivo'));
    expect(fontImportHits).toEqual([]);
  });

  it('TS-19: el <body> expone las clases variable de Sora y Gabarito', () => {
    expect(layoutTsx).toMatch(/sora\.variable/);
    expect(layoutTsx).toMatch(/gabarito\.variable/);
  });

  it('TS-20: no queda ninguna referencia a var(--font) (variable inexistente)', () => {
    const hits = grep('var(--font)');
    expect(hits).toBe('');
  });
});

describe('Logo migrado a src/assets/ (S-052)', () => {
  it('TS-21: los cuatro (+1) SVG del logo viven en src/assets/ con tamaño > 0', () => {
    const assets = [
      'jikuLogo.svg',
      'jikuLogoDark.svg',
      'jikuLogoFull.svg',
      'jikuLogoFullDark.svg',
      'jikuSymbol.svg',
    ];
    for (const asset of assets) {
      const content = readFileSync(join(root, 'src/assets', asset), 'utf8');
      expect(content.length).toBeGreaterThan(0);
    }
  });

  it('TS-22: el SVG claro y el oscuro difieren sólo en el wordmark; el símbolo no cambia', () => {
    const light = readFileSync(join(root, 'src/assets/jikuLogo.svg'), 'utf8');
    const dark = readFileSync(join(root, 'src/assets/jikuLogoDark.svg'), 'utf8');

    expect(light).toContain('#0B1934');
    expect(light).toContain('#61CCB9');
    expect(light).not.toContain('#F6F6F9');

    expect(dark).toContain('#F6F6F9');
    expect(dark).toContain('#61CCB9');
    expect(dark).not.toContain('#0B1934');
  });

  it('TS-23: logoLayout ya no se referencia en ningún lado', () => {
    const hits = grep('logoLayout');
    expect(hits).toBe('');
  });
});

describe('Ficha de logo del DS corregida (S-052)', () => {
  it('TS-26: la ficha ya no dice que los archivos viven fuera del repositorio', () => {
    expect(logoMd).not.toMatch(/no viven en este repositorio/);
    expect(logoMd).toMatch(/web\/src\/assets\//);
  });
});

describe('Invariante de radios en los archivos nuevos (S-052)', () => {
  it('TS-27: los tres tiers sólo usan 8px, 10px, 14px o 999px como radio', () => {
    const allowedRadii = new Set(['8px', '10px', '14px', '999px']);
    for (const scss of [referenceScss, semanticScss, componentScss]) {
      const literalRadii = [...scss.matchAll(/--radius-(?:8|10|14|999):\s*([^;]+);/g)];
      for (const [, value] of literalRadii) {
        expect(allowedRadii.has(value.trim())).toBe(true);
      }
    }
  });
});
