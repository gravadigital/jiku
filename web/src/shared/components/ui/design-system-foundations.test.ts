import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// Verificación transversal de la CA-6: los seis componentes fundacionales de S-053
// (Button, Input, Select, Loader, Badge, Card) consumen tokens del Design System y usan
// el anillo de foco nuevo, sin arrastrar hex crudos ni referencias al sistema viejo.

const UI_DIR = __dirname;
const COMPONENTES = ['Button', 'Input', 'Select', 'Loader', 'Badge', 'Card'] as const;

// Loader es un indicador no interactivo (spec Loader v2.0.0): no tiene estado de foco
// propio, así que queda fuera de la verificación de anillo de foco.
const COMPONENTES_INTERACTIVOS = ['Button', 'Input', 'Select', 'Badge', 'Card'] as const;

const HEX_REGEX = /#[0-9a-fA-F]{3,8}\b/;
const TOKENS_VIEJOS = [
  '--color-button',
  '--color-highlighted',
  '--radius-items',
  '--radius-cards',
  '--color-general-',
];

// Tokens de componente (tier 3) que la capa de tokens de S-052 declara resolviendo,
// directa o transitivamente, a --focus-ring (tier 2). Consumir cualquiera de estos
// cumple la regla "usar box-shadow: var(--focus-ring)", vía el tier que corresponde.
const FOCUS_RING_TOKENS = ['--focus-ring', '--button-focus', '--input-focus-ring'];

function readModule(nombre: string): string {
  return fs.readFileSync(path.join(UI_DIR, nombre, `${nombre}.module.scss`), 'utf-8');
}

describe('Componentes base — tokens y foco (TS-56, TS-57)', () => {
  it.each(COMPONENTES)('%s tiene su módulo de estilos', (nombre) => {
    expect(fs.existsSync(path.join(UI_DIR, nombre, `${nombre}.module.scss`))).toBe(true);
  });

  it.each(COMPONENTES)('%s no contiene hexadecimales crudos (TS-57)', (nombre) => {
    const source = readModule(nombre);
    expect(source).not.toMatch(HEX_REGEX);
  });

  it.each(COMPONENTES)('%s no referencia tokens del sistema viejo (TS-57)', (nombre) => {
    const source = readModule(nombre);
    for (const tokenViejo of TOKENS_VIEJOS) {
      expect(source).not.toContain(tokenViejo);
    }
  });

  it.each(COMPONENTES)('%s no usa el mixin focus-ring viejo (TS-56)', (nombre) => {
    const source = readModule(nombre);
    expect(source).not.toMatch(/@include\s+focus-ring/);
  });

  it.each(COMPONENTES_INTERACTIVOS)(
    '%s referencia --focus-ring (directo o vía token de componente) en su estado de foco (TS-56)',
    (nombre) => {
      const source = readModule(nombre);
      const referenciaAlgunToken = FOCUS_RING_TOKENS.some((token) =>
        source.includes(`var(${token})`),
      );
      expect(referenciaAlgunToken).toBe(true);
    },
  );

  it.each(COMPONENTES_INTERACTIVOS)(
    '%s no declara outline: none sin un box-shadow de foco acompañante (TS-56)',
    (nombre) => {
      const source = readModule(nombre);
      const outlineNoneMatches = source.match(/outline:\s*none/g) ?? [];
      if (outlineNoneMatches.length > 0) {
        const tieneBoxShadowDeFoco = FOCUS_RING_TOKENS.some((token) =>
          source.includes(`box-shadow: var(${token})`),
        );
        expect(tieneBoxShadowDeFoco).toBe(true);
      }
    },
  );

  it.each(COMPONENTES)('%s tiene su archivo de test propio (TS-58)', (nombre) => {
    expect(fs.existsSync(path.join(UI_DIR, nombre, `${nombre}.test.tsx`))).toBe(true);
  });
});
