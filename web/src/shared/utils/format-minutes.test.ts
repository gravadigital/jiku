import { describe, it, expect } from 'vitest';
import { formatMinutes } from './format-minutes';

describe('formatMinutes', () => {
  it('TS-7: formatea 90 minutos como "1h 30m"', () => {
    expect(formatMinutes(90)).toBe('1h 30m');
  });

  it('TS-8: formatea 0 minutos como "0h 0m"', () => {
    expect(formatMinutes(0)).toBe('0h 0m');
  });

  it('formatea minutos que son un múltiplo exacto de 60', () => {
    expect(formatMinutes(120)).toBe('2h 0m');
  });

  it('formatea minutos menores a 60', () => {
    expect(formatMinutes(45)).toBe('0h 45m');
  });
});
