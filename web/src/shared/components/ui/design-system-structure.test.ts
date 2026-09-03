import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Barrido transversal (Task 10 de S-054) sobre los ocho componentes de datos y
// navegación: tokens, foco y composición de clases. Complementa
// `design-system-foundations.test.ts` (S-052/S-053), que cubre los componentes base.

const UI_DIR = __dirname;

const NEW_COMPONENTS = [
  'Table',
  'Stepper',
  'Avatar',
  'SidebarNav',
  'ViewHeader',
  'Tabs',
  'Pagination',
  'WeekNav',
] as const;

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

describe('TS-76: ningún componente nuevo suprime el foco sin reemplazo', () => {
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

describe('TS-77: los ocho componentes consumen tokens, no hex literales', () => {
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

describe('TS-79: los tokens de avatar resuelven a los semánticos del spec', () => {
  it('--avatar-bg resuelve a var(--bg-inverse) y --avatar-text a var(--text-inverse)', () => {
    const source = fs.readFileSync(
      path.resolve(UI_DIR, '../../../styles/_component.scss'),
      'utf-8'
    );
    expect(source).toMatch(/--avatar-bg:\s*var\(--bg-inverse\)/);
    expect(source).toMatch(/--avatar-text:\s*var\(--text-inverse\)/);
  });
});

describe('TS-80: ningún componente nuevo usa template strings para clases condicionales', () => {
  it.each(NEW_COMPONENTS)('%s compone clases condicionales con cn(), no con template strings', (component) => {
    const source = readComponentTsx(component);
    expect(source).not.toMatch(/\$\{styles\.[a-zA-Z]+\}/);
  });
});

describe('TS-78: los ocho componentes tienen su archivo de test', () => {
  it.each(NEW_COMPONENTS)('%s tiene %s.test.tsx', (component) => {
    expect(fs.existsSync(path.join(UI_DIR, component, `${component}.test.tsx`))).toBe(true);
  });
});
