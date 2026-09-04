import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Barrido transversal (Task 10 de S-054, extendido por T-9 de S-055) sobre los
// componentes de datos, navegación, feedback y contenido: tokens, foco y
// composición de clases. Complementa `design-system-foundations.test.ts`
// (S-052/S-053), que cubre los componentes base.

const UI_DIR = __dirname;

// Los ocho de S-054: datos y navegación.
const DATA_NAV_COMPONENTS = [
  'Table',
  'Stepper',
  'Avatar',
  'SidebarNav',
  'ViewHeader',
  'Tabs',
  'Pagination',
  'WeekNav',
] as const;

// Los seis de S-055: feedback y contenido (tres nuevos, tres migrados).
const FEEDBACK_COMPONENTS = [
  'EmptyState',
  'Dropzone',
  'Accordion',
  'Tooltip',
  'ConfirmDialog',
  'ToggleGroup',
] as const;

const NEW_COMPONENTS = [...DATA_NAV_COMPONENTS, ...FEEDBACK_COMPONENTS] as const;

const OLD_SYSTEM_TOKENS = [
  '--color-button',
  '--color-highlighted',
  '--radius-items',
  '--color-general-background',
  '--color-general-disabled',
  '--color-general-text',
  '--color-background',
  '--color-text-light',
];

function readModuleScss(component: string): string {
  return fs.readFileSync(path.join(UI_DIR, component, `${component}.module.scss`), 'utf-8');
}

function readComponentTsx(component: string): string {
  return fs.readFileSync(path.join(UI_DIR, component, `${component}.tsx`), 'utf-8');
}

describe('S-055 TS-80/TS-81: ningún componente nuevo suprime el foco sin reemplazo', () => {
  it.each(NEW_COMPONENTS)('%s no usa el mixin focus-ring (violeta) viejo', (component) => {
    const source = readModuleScss(component);
    expect(source).not.toMatch(/@include\s+focus-ring\b/);
  });

  it.each(NEW_COMPONENTS)(
    '%s no declara outline: none sin un box-shadow con --focus-ring acompañante',
    (component) => {
      const source = readModuleScss(component);
      // Cada bloque que contiene "outline: none" debe, en el mismo archivo, tener
      // al menos una referencia a --focus-ring (la implementación de este servicio
      // siempre empareja outline:none + box-shadow:var(--focus-ring) en el mismo
      // selector :focus-visible).
      if (/outline:\s*none/.test(source)) {
        expect(source).toMatch(/box-shadow:\s*var\(--focus-ring\)/);
      }
    }
  );
});

describe('S-055 TS-78/TS-79: los componentes consumen tokens, no hex literales', () => {
  it.each(NEW_COMPONENTS)('%s no contiene hexadecimales crudos en su CSS', (component) => {
    const source = readModuleScss(component);
    // Se descartan las líneas de comentario (// ...), donde puede aparecer un hex
    // como referencia documental (p. ej. "#12897A" citado desde el spec).
    const codeLines = source
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
    expect(codeLines).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it.each(NEW_COMPONENTS)('%s no referencia tokens del sistema anterior', (component) => {
    const source = readModuleScss(component);
    OLD_SYSTEM_TOKENS.forEach((token) => {
      expect(source).not.toContain(token);
    });
  });
});

describe('S-054 TS-79: los tokens de avatar resuelven a los semánticos del spec', () => {
  it('--avatar-bg resuelve a var(--bg-brand-deep) y --avatar-text a var(--text-inverse)', () => {
    const source = fs.readFileSync(
      path.resolve(UI_DIR, '../../../styles/_component.scss'),
      'utf-8'
    );
    // --bg-brand-deep, no --bg-inverse: el spec del DS dice "fondo azul oscuro" y ese azul
    // NO cambia entre modos. --bg-inverse en oscuro se remapea a la superficie del tema (lo
    // correcto para el overlay del modal y el fondo del tooltip), asi que el avatar perdia
    // su azul. --bg-brand-deep es la superficie de marca, fija en ambos modos.
    expect(source).toMatch(/--avatar-bg:\s*var\(--bg-brand-deep\)/);
    expect(source).toMatch(/--avatar-text:\s*var\(--text-inverse\)/);
  });
});

describe('S-055 TS-82: ningún componente nuevo usa template strings para clases condicionales', () => {
  it.each(NEW_COMPONENTS)('%s compone clases condicionales con cn(), no con template strings', (component) => {
    const source = readComponentTsx(component);
    expect(source).not.toMatch(/\$\{styles\.[a-zA-Z]+\}/);
  });
});

describe('S-055 TS-77: los componentes tienen su archivo de test', () => {
  it.each(NEW_COMPONENTS)('%s tiene %s.test.tsx', (component) => {
    expect(fs.existsSync(path.join(UI_DIR, component, `${component}.test.tsx`))).toBe(true);
  });
});

describe('S-055 TS-83/TS-84: los tokens de componente de S-055 quedaron declarados y resuelven a semánticos', () => {
  const componentScssSource = fs.readFileSync(
    path.resolve(UI_DIR, '../../../styles/_component.scss'),
    'utf-8'
  );

  const NEW_COMPONENT_TOKENS = [
    '--empty-radius',
    '--empty-bg',
    '--dropzone-text',
    '--dropzone-icon-size',
    '--dropzone-hover-border',
    '--accordion-radius',
    '--accordion-title',
    '--accordion-chevron',
    '--accordion-pending-mark',
    '--accordion-done-mark',
    '--toggle-bg',
    '--toggle-item-text',
    '--toggle-item-active-text',
    '--tooltip-radius',
    '--tooltip-font',
  ];

  it.each(NEW_COMPONENT_TOKENS)('%s está declarado en _component.scss', (token) => {
    expect(componentScssSource).toContain(`${token}:`);
  });

  it.each(NEW_COMPONENT_TOKENS)(
    '%s resuelve a var(--...) — nunca a un primitivo ni a un hex',
    (token) => {
      const line = componentScssSource
        .split('\n')
        .find((candidate) => candidate.trim().startsWith(`${token}:`));
      expect(line).toBeDefined();
      expect(line).toMatch(/:\s*var\(--[a-z0-9-]+\)/);
      expect(line).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  );
});
