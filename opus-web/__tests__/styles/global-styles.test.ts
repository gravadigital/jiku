import * as fs from 'fs';
import * as path from 'path';

const variablesPath = path.resolve(__dirname, '../../src/styles/_variables.scss');
const typographyPath = path.resolve(__dirname, '../../src/styles/_typography.scss');

let variablesContent: string;
let typographyContent: string;

beforeAll(() => {
  variablesContent = fs.readFileSync(variablesPath, 'utf-8');
  typographyContent = fs.readFileSync(typographyPath, 'utf-8');
});

describe('CA-1: Fuente base configurada', () => {
  // TS-1
  it('--font-family-sans incluye -apple-system como primera opción', () => {
    expect(variablesContent).toMatch(/--font-family-sans:\s*-apple-system/);
  });

  it('body aplica font-family: var(--font-family-sans)', () => {
    expect(typographyContent).toMatch(/font-family:\s*var\(--font-family-sans\)/);
  });
});

describe('CA-2: Tamaño base ≥ 16px', () => {
  // TS-2
  it('--font-size-base está definido como 1rem', () => {
    expect(variablesContent).toMatch(/--font-size-base:\s*1rem/);
  });

  it('body aplica font-size: var(--font-size-base)', () => {
    expect(typographyContent).toMatch(/font-size:\s*var\(--font-size-base\)/);
  });
});

describe('CA-3: Escala tipográfica completa', () => {
  // TS-3
  it('--font-size-xs está definido como 0.75rem', () => {
    expect(variablesContent).toMatch(/--font-size-xs:\s*0\.75rem/);
  });

  it('--font-size-sm está definido como 0.875rem', () => {
    expect(variablesContent).toMatch(/--font-size-sm:\s*0\.875rem/);
  });

  it('--font-size-base está definido como 1rem', () => {
    expect(variablesContent).toMatch(/--font-size-base:\s*1rem/);
  });

  it('--font-size-lg está definido como 1.125rem', () => {
    expect(variablesContent).toMatch(/--font-size-lg:\s*1\.125rem/);
  });

  it('--font-size-xl está definido como 1.25rem', () => {
    expect(variablesContent).toMatch(/--font-size-xl:\s*1\.25rem/);
  });
});

describe('CA-4: Variable de color hover de fila disponible', () => {
  // TS-4
  it('--color-surface-hover está definido como #eef2f7', () => {
    expect(variablesContent).toMatch(/--color-surface-hover:\s*#eef2f7/);
  });
});
