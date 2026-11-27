import { describe, it, expect, vi, afterEach } from 'vitest';
import { ULID_PATTERN } from './docsUrlTransform';
import { newUlid } from './ulid';

describe('newUlid (TS-17)', () => {
  afterEach(() => vi.useRealTimers());

  it('genera 1000 ULID válidos y distintos', () => {
    const all = Array.from({ length: 1000 }, () => newUlid());
    for (const id of all) expect(id).toMatch(ULID_PATTERN);
    expect(new Set(all).size).toBe(1000);
  });

  it('los 10 primeros caracteres codifican Date.now()', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-24T14:00:00Z'));
    const a = newUlid();
    const b = newUlid();
    expect(a.slice(0, 10)).toBe(b.slice(0, 10));
    // Decodifica el prefijo y compara con el reloj.
    const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    const decoded = [...a.slice(0, 10)].reduce((n, c) => n * 32 + alphabet.indexOf(c), 0);
    expect(decoded).toBe(Date.now());
  });
});
