import fs from 'node:fs';
import path from 'node:path';

// TS-115 (S-060, T7): --font-primary deja de existir como alias en _semantic.scss. El
// comentario que lo introdujo decía "durante la migración de los 117 módulos existentes" —
// esta story es la que cierra esa migración, así que el alias temporal se retira.
const SEMANTIC_PATH = path.resolve(__dirname, '_semantic.scss');

describe('_semantic.scss — baja del alias de compatibilidad (T7)', () => {
  const source = fs.readFileSync(SEMANTIC_PATH, 'utf-8');

  it('TS-115: no declara --font-primary como alias', () => {
    expect(source).not.toMatch(/--font-primary\s*:/);
  });
});
