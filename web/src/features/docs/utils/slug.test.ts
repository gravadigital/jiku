import { describe, it, expect } from 'vitest';
import { normalizeFileName, slugifyFileName } from './slug';

describe('slugifyFileName (TS-19)', () => {
  it.each([
    ['Guía de despliegue', 'guia-de-despliegue.md'],
    ['  Hola, Mundo!!  ', 'hola-mundo.md'],
    ['Ñandú 2026', 'nandu-2026.md'],
    ['', ''],
    ['---', ''],
  ])('%j → %j', (input, expected) => {
    expect(slugifyFileName(input)).toBe(expected);
  });
});

describe('normalizeFileName (TS-20)', () => {
  it.each([
    ['guia', 'guia.md'],
    ['guia.md', 'guia.md'],
    ['  guia.MD ', 'guia.MD'],
  ])('%j → %j', (input, expected) => {
    expect(normalizeFileName(input)).toBe(expected);
  });
});
