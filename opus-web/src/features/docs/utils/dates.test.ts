import { formatDocDate } from './dates';

describe('formatDocDate', () => {
  it('TS-19: formatea DD/MM/AAAA', () => {
    expect(formatDocDate('2026-10-20T14:30:00.000Z')).toBe('20/10/2026');
  });

  it('una fecha inválida es "—"', () => {
    expect(formatDocDate('no-fecha')).toBe('—');
  });
});
