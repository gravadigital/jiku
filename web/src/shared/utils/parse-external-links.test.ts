import { describe, it, expect, vi } from 'vitest';
import { parseExternalLinks } from './parse-external-links';

describe('parseExternalLinks', () => {
  it('TS-92: sin input devuelve una lista vacía', () => {
    expect(parseExternalLinks()).toEqual([]);
    expect(parseExternalLinks(undefined)).toEqual([]);
  });

  it('TS-92: parsea un JSON válido con tool, href y label', () => {
    const raw = JSON.stringify([{ tool: 'github', href: 'https://github.com/x', label: 'Código' }]);

    const result = parseExternalLinks(raw);

    expect(result).toHaveLength(1);
    expect(result[0].href).toBe('https://github.com/x');
    expect(result[0].label).toBe('Código');
    expect(result[0].icon).toBeDefined();
  });

  it('TS-92: filtra entradas sin href o sin label', () => {
    const raw = JSON.stringify([
      { tool: 'github', href: '', label: 'Sin href' },
      { tool: 'github', href: 'https://x', label: '' },
      { tool: 'github', href: 'https://ok', label: 'Ok' },
    ]);

    const result = parseExternalLinks(raw);

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Ok');
  });

  it('TS-92: un tool desconocido usa el ícono genérico', () => {
    const raw = JSON.stringify([{ tool: 'no-existe', href: 'https://x', label: 'X' }]);

    const [link] = parseExternalLinks(raw);

    // El ícono genérico es el mismo que el de 'github' — fallback declarado en la implementación.
    const known = parseExternalLinks(JSON.stringify([{ tool: 'github', href: 'https://x', label: 'X' }]));
    expect(link.icon).toBe(known[0].icon);
  });

  it('TS-92: un JSON mal formado no rompe y devuelve lista vacía', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(parseExternalLinks('{ esto no es json')).toEqual([]);

    spy.mockRestore();
  });
});
