import { describe, it, expect } from 'vitest';
import { buildWorkedTimePayload } from './buildWorkedTimePayload';
import type { TargetSelection } from '../types/worked-time.types';

const sel = (over: Partial<TargetSelection>): TargetSelection => ({
  projectId: null,
  requirementId: null,
  objectiveId: null,
  ...over,
});

describe('buildWorkedTimePayload — S-055', () => {
  // TS-8: Payload solo proyecto
  it('TS-8: solo proyecto → { date, minutes, projectId } sin objectiveId ni requirementId', () => {
    const payload = buildWorkedTimePayload(sel({ projectId: 3 }), '2026-06-26', 60);
    expect(payload).toEqual({ date: '2026-06-26', minutes: 60, projectId: 3 });
    expect(payload).not.toHaveProperty('objectiveId');
    expect(payload).not.toHaveProperty('requirementId');
  });

  // TS-9: Payload requisito
  it('TS-9: proyecto + requisito → incluye requirementId, sin objectiveId', () => {
    const payload = buildWorkedTimePayload(
      sel({ projectId: 3, requirementId: 5 }),
      '2026-06-26',
      60
    );
    expect(payload).toEqual({ date: '2026-06-26', minutes: 60, projectId: 3, requirementId: 5 });
    expect(payload).not.toHaveProperty('objectiveId');
  });

  // TS-10: Payload objetivo (no envía requirementId aunque haya uno sincronizado)
  it('TS-10: proyecto + requisito + objetivo → incluye objectiveId, sin requirementId', () => {
    const payload = buildWorkedTimePayload(
      sel({ projectId: 3, requirementId: 8, objectiveId: 10 }),
      '2026-06-26',
      60
    );
    expect(payload).toEqual({ date: '2026-06-26', minutes: 60, projectId: 3, objectiveId: 10 });
    expect(payload).not.toHaveProperty('requirementId');
  });

  // TS-11: Payload objetivo sin requisito
  it('TS-11: proyecto + objetivo (sin requisito) → incluye objectiveId', () => {
    const payload = buildWorkedTimePayload(
      sel({ projectId: 3, objectiveId: 10 }),
      '2026-06-26',
      60
    );
    expect(payload).toEqual({ date: '2026-06-26', minutes: 60, projectId: 3, objectiveId: 10 });
    expect(payload).not.toHaveProperty('requirementId');
  });

  it('incluye personId cuando se pasa (admin carga por otra persona)', () => {
    const payload = buildWorkedTimePayload(sel({ projectId: 3 }), '2026-06-26', 60, 42);
    expect(payload).toEqual({ date: '2026-06-26', minutes: 60, projectId: 3, personId: 42 });
  });

  it('devuelve null si no hay projectId (destino mínimo inválido)', () => {
    expect(buildWorkedTimePayload(null, '2026-06-26', 60)).toBeNull();
    expect(buildWorkedTimePayload(sel({}), '2026-06-26', 60)).toBeNull();
  });

  it('usa resolvedProjectId cuando la selección no tiene projectId (derivado del requisito/objetivo)', () => {
    const payload = buildWorkedTimePayload(
      sel({ projectId: null, requirementId: 5 }),
      '2026-06-26',
      60,
      undefined,
      7
    );
    expect(payload).toEqual({ date: '2026-06-26', minutes: 60, projectId: 7, requirementId: 5 });
  });

  it('resolvedProjectId tiene prioridad sobre selection.projectId', () => {
    const payload = buildWorkedTimePayload(
      sel({ projectId: 3, objectiveId: 10 }),
      '2026-06-26',
      60,
      undefined,
      99
    );
    expect(payload).toEqual({ date: '2026-06-26', minutes: 60, projectId: 99, objectiveId: 10 });
  });
});
