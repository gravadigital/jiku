import { describe, it, expect } from 'vitest';
import { formatDate } from './format-date';

describe('formatDate', () => {
  it('formatea un Date con día y mes abreviado', () => {
    expect(formatDate(new Date('2026-08-01T00:00:00Z'))).toBe('01 Aug');
  });

  it('devuelve "N / D" cuando no hay fecha', () => {
    expect(formatDate(null)).toBe('N / D');
    expect(formatDate(undefined)).toBe('N / D');
  });

  it('devuelve "N / D" cuando el Date es inválido', () => {
    expect(formatDate(new Date('no-es-una-fecha'))).toBe('N / D');
  });

  // La api devuelve las fechas como string ISO (`createdAt: {type: string, format: date-time}`),
  // y los tipos de `web` están escritos a mano: nada impide que un string llegue acá.
  it('acepta un string ISO, que es lo que la api devuelve en realidad', () => {
    expect(formatDate('2026-08-01T00:00:00Z' as unknown as Date)).toBe('01 Aug');
  });

  it('no explota con un string que no es una fecha', () => {
    expect(formatDate('cualquier cosa' as unknown as Date)).toBe('N / D');
  });
});
