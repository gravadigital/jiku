import { describe, it, expect } from 'vitest';
import { extractHeadings } from './documentHeadings';

describe('extractHeadings (TS-7)', () => {
  it('niveles 1 y 2 con id y línea', () => {
    expect(extractHeadings('# Contexto\n\nTexto.\n\n## Decisiones\n\nMás texto.\n')).toEqual([
      { level: 1, text: 'Contexto', id: 'contexto', line: 1 },
      { level: 2, text: 'Decisiones', id: 'decisiones', line: 5 },
    ]);
  });
  it('repetidos con sufijo y sin nivel 3', () => {
    const result = extractHeadings('# Notas\n## Notas\n### Sub\n');
    expect(result.map((h) => h.id)).toEqual(['notas', 'notas-2']);
  });
  it('ignora bloques cercados y quita acentos', () => {
    expect(extractHeadings('```\n# No\n```\n## Sección única\n')).toEqual([
      { level: 2, text: 'Sección única', id: 'seccion-unica', line: 4 },
    ]);
  });
  it('quita marcadores de énfasis', () => {
    const [h] = extractHeadings('## **Plan** de _acción_\n');
    expect(h).toMatchObject({ text: 'Plan de acción', id: 'plan-de-accion' });
  });
  it('sin espacio no es encabezado', () => {
    expect(extractHeadings('#SinEspacio\n')).toEqual([]);
  });
});
