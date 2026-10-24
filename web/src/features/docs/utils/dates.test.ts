import { describe, it, expect } from 'vitest';
import { formatDateTime } from './dates';

describe('formatDateTime', () => {
  it('formatea DD/MM/AAAA HH:mm', () => {
    expect(formatDateTime('2026-10-24T14:30:00.000Z')).toBe('24/10/2026 14:30');
    expect(formatDateTime('2026-01-05T04:05:00.000Z')).toBe('05/01/2026 04:05');
  });
});
