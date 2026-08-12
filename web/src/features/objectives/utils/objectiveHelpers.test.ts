import { describe, it, expect } from 'vitest';
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
