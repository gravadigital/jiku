import { describe, it, expect } from 'vitest';
import {
  metaVersionLabel,
  prunedLabel,
  titleOf,
  versionKindLabel,
  visibilityLabel,
} from './documentLabels';

const DOC = {
  version: 6,
  updatedAt: '2026-10-24T14:30:00.000Z',
  updatedBy: 'sub-ana',
  updatedByName: 'Ana Pérez',
};

describe('metaVersionLabel (TS-8)', () => {
  it('nombre del servicio, vos y sin nombre', () => {
    expect(metaVersionLabel(DOC, 'sub-yo')).toBe(
      'Versión 6 · actualizado 24/10/2026 14:30 por Ana Pérez'
    );
    expect(metaVersionLabel({ ...DOC, updatedBy: 'sub-yo' }, 'sub-yo')).toBe(
      'Versión 6 · actualizado 24/10/2026 14:30 por vos'
    );
    expect(metaVersionLabel({ ...DOC, updatedByName: null, updatedBy: 'sub-x' }, 'sub-yo')).toBe(
      'Versión 6 · actualizado 24/10/2026 14:30'
    );
  });
});

describe('etiquetas (TS-11)', () => {
  it('tipo de versión, compactadas, visibilidad y título', () => {
    expect(versionKindLabel('create')).toBe('Creación');
    expect(versionKindLabel('update')).toBe('Edición');
    expect(versionKindLabel('restore')).toBe('Restauración');
    expect(prunedLabel(3)).toBe('3 versiones intermedias compactadas.');
    expect(prunedLabel(1)).toBe('1 versión intermedia compactada.');
    expect(prunedLabel(0)).toBeNull();
    expect(prunedLabel(undefined)).toBeNull();
    expect(visibilityLabel('internal')).toBe('Interno');
    expect(visibilityLabel('public')).toBe('Visible para el cliente');
    expect(visibilityLabel('restricted')).toBe('Restringido');
    expect(titleOf({ title: '  ' })).toBe('Sin título');
    expect(titleOf({ title: ' Plan ' })).toBe('Plan');
  });
});
