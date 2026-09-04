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
const cardModuleScss = readFileSync(
  join(root, 'src/shared/components/ui/Card/Card.module.scss'),
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

  it('TS-2: declara exactamente cuatro radios de superficie, sin intermedios', () => {
    // --radius-glyph (3px) queda FUERA de la cuenta a proposito: no es un radio de
    // superficie sino la esquina del glifo cuadrado de la etiqueta de card (10x10px). La
    // garantia que importa es que la escala de superficies siga cerrada en cuatro valores.
    const radii = Object.keys(ref).filter((k) => /^--radius-\d/.test(k));
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
      // Los rgba del acento son literales legitimos del tier: el DS los declara asi porque
      // son transparencias del verde agua, no un primitivo de color. .08 es --bg-active-subtle
      // (hover apenas perceptible) y .14/.16 son --bg-accent-soft (relleno con presencia
      // propia: subitem activo del sidebar y barra de proporcion), que agrego el handoff.
      const isAllowedLiteral =
        allowedLiterals.has(value) || /^rgba\(97,\s*204,\s*185,\s*\.(08|14|16)\)$/.test(value);
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

describe('Modo oscuro — capa semántica completa (S-059)', () => {
  // Bloque oscuro completo (no sólo los 4 que S-052 dejó preparados), aislado del :root base.
  const darkBlockMatch = semanticScss.match(/:root\[data-theme=['"]dark['"]\]\s*\{([^}]*)\}/);
  const darkBlock = darkBlockMatch ? darkBlockMatch[1] : '';
  const dark = extractDeclarations(darkBlock);

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

  it('S-059 TS-1: el bloque oscuro redeclara los 13 tokens de fondo/texto/borde', () => {
    const expectedKeys = [
      '--bg-canvas',
      '--bg-surface',
      '--bg-surface-sunken',
      '--bg-inverse',
      '--bg-action-disabled',
      '--bg-tint-neutral',
      '--text-primary',
      '--text-body',
      '--text-secondary',
      '--text-disabled',
      '--text-inverse',
      '--border-default',
      '--border-strong',
    ];
    for (const key of expectedKeys) {
      expect(dark[key], `${key} no está declarado en el bloque oscuro`).toBeDefined();
    }
  });

  it('S-059 TS-1b: el bloque oscuro redeclara los 12 tintes y bordes de estado, sin tocar los plenos', () => {
    const families = ['resolved', 'in-progress', 'review', 'urgent', 'analysis', 'neutral'];
    for (const family of families) {
      expect(dark[`--state-${family}-tint`], `--state-${family}-tint`).toBeDefined();
      expect(dark[`--state-${family}-border`], `--state-${family}-border`).toBeDefined();
      expect(dark[`--state-${family}-full`], `--state-${family}-full no debe redeclararse`).toBeUndefined();
    }
  });

  it('S-059 TS-1c: el bloque oscuro redeclara las sombras con valores que no son azul oscuro', () => {
    for (const key of ['--elevation-surface', '--elevation-raised', '--focus-ring']) {
      expect(dark[key], key).toBeDefined();
    }
    // Se resuelven a primitivos --shadow-dark-*, nunca a los --shadow-* claros sobre rgba(11,25,52,…)
    expect(dark['--elevation-surface']).not.toBe('var(--shadow-card)');
    expect(dark['--elevation-raised']).not.toBe('var(--shadow-active)');
  });

  it('S-059 TS-2: el acento NO se redeclara en el bloque oscuro', () => {
    // --text-link SALE de esta lista con el handoff de identidad. La regla del manual es que el
    // acento de FONDO no cambia entre modos, pero que el TEXTO verde sí: pasa al verde agua.
    // El verde profundo no alcanza AA sobre las superficies oscuras (3.79:1 sobre la superficie
    // de card), así que mantenerlo fijo era un fallo de contraste, no una fidelidad. El caso
    // tiene su propia cobertura en styles/dark-mode-tints.test.ts, que mide el ratio.
    const accentTokens = [
      '--bg-action-primary',
      '--bg-active',
      '--border-action',
      '--border-focus',
      '--border-required',
      '--text-on-action',
    ];
    for (const token of accentTokens) {
      expect(dark[token], `${token} no debería redeclararse en oscuro`).toBeUndefined();
    }
  });

  it('el texto verde sí cambia en oscuro: --text-link pasa al verde agua', () => {
    expect(dark['--text-link']).toBe('var(--color-aqua)');
  });

  it('S-059 TS-2b: el bloque oscuro queda plano, sin reglas anidadas (regex de TS-8 captura hasta focus-ring)', () => {
    expect(darkBlock).toMatch(/--focus-ring:\s*[^;]+;/);
  });

  it('S-059 TS-3: los valores oscuros resuelven a los primitivos --color-dark-* del DS, no a inversiones', () => {
    expect(dark['--bg-canvas']).toBe('var(--color-dark-canvas)');
    expect(dark['--bg-surface']).toBe('var(--color-dark-surface)');
    expect(dark['--text-primary']).toBe('var(--color-dark-text)');
    // --text-body deja de ser el mismo blanco del título: el handoff le da un valor propio
    // (--color-dark-body), como en claro el cuerpo tampoco es el azul oscuro del título.
    expect(dark['--text-body']).toBe('var(--color-dark-body)');
  });

  it('S-059 TS-6: ningún token de OLD_SYSTEM_TOKENS aparece en el bloque oscuro', () => {
    for (const token of OLD_SYSTEM_TOKENS) {
      expect(darkBlock.includes(token), `${token} no debería aparecer en el bloque oscuro`).toBe(
        false
      );
    }
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
  // --login-panel-* son la geometría del panel decorativo del login: la única superficie del
  // sistema con radio propio (22px) fuera de la escala cerrada de cuatro radios. No hay un
  // semántico intermedio al que apuntar —no existe una "intención" compartida para una pieza
  // única— y crear uno sería un alias de un solo consumidor. Los primitivos viven en su propio
  // bloque del tier 1, deliberadamente fuera del namespace --radius-* para no romper TS-2.
  const documentedPrimitiveExceptions = new Set([
    '--nav-item-icon',
    // Los cuatro --login-* son la geometria y los espaciados de la pantalla de login: una
    // pieza unica del sistema, sin un rol compartido al que apuntar. Crear un semantico para
    // cada uno seria un alias de un solo consumidor. Ver el bloque del panel en el tier 1.
    '--login-panel-radius',
    '--login-panel-inset',
    '--login-stack',
    '--login-header-stack',
  ]);

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
    // --bg-accent-soft, no --bg-active-subtle: el handoff pide "fondo --accent-soft" para el
    // subitem activo, y ese rol es un relleno con presencia propia (.14/.16), distinto del
    // hover apenas perceptible de --bg-active-subtle (.08) que consumen doce controles.
    expect(comp['--nav-subitem-active-bg']).toBe('var(--bg-accent-soft)');
    expect(comp['--nav-wordmark']).toBe('var(--text-wordmark-family)');
  });
});

describe('Modo oscuro — fugas fuera de la capa semántica (S-059)', () => {
  const bodyRuleMatch = globalsScss.match(/html,\s*\nbody\s*\{([^}]*)\}/);
  const bodyRule = bodyRuleMatch ? bodyRuleMatch[1] : '';

  const spanRuleMatch = globalsScss.match(/(?:^|\n)span\s*\{([^}]*)\}/);
  const spanRule = spanRuleMatch ? spanRuleMatch[1] : '';

  const componentDarkBlockMatch = componentScss.match(
    /:root\[data-theme=['"]dark['"]\]\s*\{([^}]*)\}/
  );
  const componentDark = componentDarkBlockMatch
    ? extractDeclarations(componentDarkBlockMatch[1])
    : {};
  // El :root base de _component.scss, aislado del bloque oscuro (para no pisar el valor claro).
  const componentBaseRootMatch = componentScss.match(/^:root\s*\{([\s\S]*?)\n\}/m);
  const componentBase = componentBaseRootMatch
    ? extractDeclarations(componentBaseRootMatch[1])
    : {};

  it('S-059 TS-7: html/body pintan el fondo con --bg-canvas, no con el token viejo', () => {
    expect(bodyRule).toMatch(/background-color:\s*var\(--bg-canvas\);/);
    expect(bodyRule).not.toMatch(/--color-general-background/);
  });

  it('S-059 TS-8: html/body declaran color de texto tokenizado', () => {
    expect(bodyRule).toMatch(/color:\s*var\(--text-body\);/);
  });

  it('S-059 TS-8b: la regla de elemento span ya no existe', () => {
    // S-059 se limito a sacarle el --color-text-dark y dejo el `font-size: 1.25rem` anotado
    // como "deuda de modo claro fuera de alcance". Esa deuda resulto ser un defecto con
    // impacto en todo el producto: ponia 20px en TODO <span>, y como los componentes del DS
    // declaran su tipografia en el contenedor, el span interno se la comia — el texto de un
    // Badge de estado renderizaba a 20px en vez de los 11px de su propia clase.
    //
    // La regla se dio de baja completa. Un span que necesite tamano propio lo declara en el
    // modulo de su componente.
    expect(spanRule).toBe('');
  });

  it('S-059 TS-5: _component.scss redeclara --nav-item-icon en el bloque oscuro', () => {
    expect(componentDark['--nav-item-icon']).toBe('var(--color-dark-primary)');
    // En claro sigue apuntando al primitivo grafito, sin cambios.
    expect(componentBase['--nav-item-icon']).toBe('var(--color-graphite)');
  });

  it('S-059 TS-4: Card ya no necesita override oscuro', () => {
    // El bloque `:root[data-theme='dark'] .card` se retiro, y con el los tokens
    // --card-bg-dark / --card-border-dark.
    //
    // No aportaba nada al fondo: --card-bg-dark resolvia al mismo --bg-surface que --card-bg,
    // y la superficie por modo ya la resuelven los tiers. Lo que si hacia era romper dos cosas
    // por especificidad (0,2,1 contra la 0,1,0 de una clase suelta): con `border: none`
    // borraba el borde de TODA card en oscuro —incluido el rojo de 1,5px de la card vencida—
    // y pisaba el fondo azul de la card de metrica destacada.
    const comp = extractDeclarations(componentScss);
    expect(comp['--card-border-dark']).toBeUndefined();
    expect(comp['--card-bg-dark']).toBeUndefined();
    expect(cardModuleScss).not.toMatch(/:root\[data-theme=['"]dark['"]\]\s*\.card\s*\{/);
  });

  it('S-059 TS-8d: el guardia de :root de globals.scss (TS-13) sigue vigente', () => {
    const rootBlocks = globalsScss.match(/(?<!\[data-theme=['"]dark['"]\]\s*)^:root\s*\{/gm);
    expect(rootBlocks).toBeNull();
  });

  it('S-059 TS-37: el magenta descontinuado (--color-button) no sobrevive en los overrides de terceros', () => {
    const datepickerSelectedMatch = globalsScss.match(
      /\.react-datepicker__day--selected\s*\{([^}]*)\}/
    );
    const navigationMatch = globalsScss.match(/\.react-datepicker__navigation\s*\{([^}]*)\}/);

    expect(datepickerSelectedMatch).not.toBeNull();
    expect(navigationMatch).not.toBeNull();
    expect(datepickerSelectedMatch![1]).not.toMatch(/--color-button/);
    expect(navigationMatch![1]).not.toMatch(/--color-button/);
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
