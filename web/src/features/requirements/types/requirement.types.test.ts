import { describe, it, expect } from 'vitest';
import type { RequirementActivity, UpdateCommentPayload } from './requirement.types';

describe('requirement.types (S-048)', () => {
  it('TS-41: RequirementActivity acepta editedAt/editedBy poblados y null', () => {
    const edited: RequirementActivity = {
      id: 7,
      typeOfActivity: 'comment',
      previousValue: null,
      newValue: 'hola',
      visibilityLevel: 'internal',
      changedBy: 'u-1',
      changedByUser: { id: 'u-1', name: 'Lautaro Alvarez', email: null },
      createdAt: '2026-09-01T09:00:00.000Z',
      editedAt: '2026-09-01T10:00:00.000Z',
      editedBy: 'u-2',
    };

    const neverEdited: RequirementActivity = {
      ...edited,
      editedAt: null,
      editedBy: null,
    };

    expect(edited.editedAt).toBe('2026-09-01T10:00:00.000Z');
    expect(neverEdited.editedAt).toBeNull();
    expect(neverEdited.editedBy).toBeNull();
  });

  it('TS-3: UpdateCommentPayload no admite visibilityLevel (verificado en tiempo de compilación)', () => {
    const payload: UpdateCommentPayload = {
      comment: 'texto corregido',
      fileIds: [3, 9],
    };

    const withVisibility: UpdateCommentPayload = {
      comment: 'texto corregido',
      // @ts-expect-error -- visibilityLevel no es un campo de UpdateCommentPayload: la api lo
      // rechaza porque el joi del PATCH no lo declara y no tiene `.unknown(true)` (CA-8).
      visibilityLevel: 'public',
    };

    expect(payload.fileIds).toEqual([3, 9]);
    expect(withVisibility.comment).toBe('texto corregido');
  });

  it('UpdateCommentPayload permite omitir fileIds', () => {
    const payload: UpdateCommentPayload = { comment: 'solo texto' };

    expect(payload.fileIds).toBeUndefined();
  });
});
