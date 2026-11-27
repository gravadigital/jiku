import { describe, it, expect } from 'vitest';
import { describeRestoreError, parseVersionParam, prunedDetailsOf } from './versionErrors';

describe('parseVersionParam (TS-14)', () => {
  it('solo enteros >= 1', () => {
    expect(parseVersionParam('4')).toBe(4);
    for (const bad of ['0', '-1', 'abc', '4.5', '04', null]) {
      expect(parseVersionParam(bad)).toBeNull();
    }
  });
});

describe('prunedDetailsOf', () => {
  it('devuelve details de version_pruned', () => {
    const details = { requestedVersion: 7, previousAvailable: 5, nextAvailable: null };
    expect(prunedDetailsOf({ code: 'version_pruned', details })).toEqual(details);
    expect(prunedDetailsOf({ code: 'version_pruned' })).toBeNull();
    expect(prunedDetailsOf({ code: 'document_not_found' })).toBeNull();
  });
});

describe('describeRestoreError (TS-13)', () => {
  it('un texto por code', () => {
    expect(describeRestoreError({ code: 'version_conflict' }, 5)).toBe(
      'El documento cambió mientras restaurabas; actualizamos el historial.'
    );
    expect(describeRestoreError({ code: 'version_pruned' }, 5)).toBe(
      'La versión 5 ya no se conserva.'
    );
    expect(
      describeRestoreError({ code: 'document_locked', details: { holderName: 'Luis Gómez' } }, 5)
    ).toBe('Luis Gómez lo está editando.');
    expect(describeRestoreError({ code: 'document_locked', details: {} }, 5)).toBe(
      'Otra persona lo está editando.'
    );
    expect(describeRestoreError({ code: 'module_unavailable' }, 5)).toBe(
      'La documentación no está disponible en este momento. Probá de nuevo en unos minutos.'
    );
    expect(describeRestoreError({ code: 'gateway_timeout' }, 5)).toBe(
      'No se pudo restaurar la versión 5. Intentá de nuevo.'
    );
  });
});
