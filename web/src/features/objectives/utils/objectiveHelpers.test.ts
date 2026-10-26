import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isOverdue } from './objectiveHelpers';

describe('isOverdue', () => {
  const PAST_DATE = new Date('2025-01-01');
  const FUTURE_DATE = new Date('2099-01-01');

  describe('estados cerrados (finalizado, cancelado)', () => {
    it('debe retornar false para estado finalizado con fecha pasada', () => {
      expect(isOverdue('finalizado', PAST_DATE)).toBe(false);
    });

    it('debe retornar false para estado cancelado con fecha pasada', () => {
      expect(isOverdue('cancelado', PAST_DATE)).toBe(false);
    });

    it('debe retornar false para estado finalizado con fecha nula', () => {
      expect(isOverdue('finalizado', null)).toBe(false);
    });
  });

  describe('estados abiertos (activo, backlog, en_revision)', () => {
    it('debe retornar true para estado activo con fecha pasada', () => {
      expect(isOverdue('activo', PAST_DATE)).toBe(true);
    });

    it('debe retornar true para estado backlog con fecha pasada', () => {
      expect(isOverdue('backlog', PAST_DATE)).toBe(true);
    });

    it('debe retornar true para estado en_revision con fecha pasada', () => {
      expect(isOverdue('en_revision', PAST_DATE)).toBe(true);
    });

    it('debe retornar false para estado activo con fecha futura', () => {
      expect(isOverdue('activo', FUTURE_DATE)).toBe(false);
    });

    it('debe retornar false para estado activo con fecha nula', () => {
      expect(isOverdue('activo', null)).toBe(false);
    });
  });
});

describe('S-092: isOverdue con fecha inválida', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 26, 10, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('TS-13: fecha inválida no es vencida', () => {
    expect(isOverdue('activo', 'abc')).toBe(false);
    expect(isOverdue('activo', '')).toBe(false);
    expect(isOverdue('activo', '31/12/2026')).toBe(false);
  });

  it('TS-14: fecha válida vencida es vencida', () => {
    expect(isOverdue('activo', '2026-10-21')).toBe(true);
  });
});
