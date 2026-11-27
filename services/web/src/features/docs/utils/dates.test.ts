import { describe, it, expect } from 'vitest';
import { formatDateTime, formatDay, formatTime } from './dates';

describe('formatDateTime', () => {
  it('formatea DD/MM/AAAA HH:mm', () => {
    expect(formatDateTime('2026-10-24T14:30:00.000Z')).toBe('24/10/2026 14:30');
    expect(formatDateTime('2026-01-05T04:05:00.000Z')).toBe('05/01/2026 04:05');
  });
});

describe('formatTime', () => {
  it('formatea HH:mm con getters locales', () => {
    expect(formatTime('2026-10-24T14:05:00.000Z')).toBe('14:05');
  });
});

describe('formatDay', () => {
  it('DD/MM/AAAA', () => {
    expect(formatDay('2026-10-24T14:30:00.000Z')).toBe('24/10/2026');
  });
  it('vacío o inválido → "—"', () => {
    expect(formatDay(undefined)).toBe('—');
    expect(formatDay(null)).toBe('—');
    expect(formatDay('no-es-fecha')).toBe('—');
  });
});
