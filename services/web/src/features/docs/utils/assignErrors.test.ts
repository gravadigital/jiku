import { describe, expect, it } from 'vitest';
import { assignErrorToast, assignSuccessMessage } from './assignErrors';

describe('assignErrors', () => {
  it('éxito', () => {
    expect(assignSuccessMessage('Videoconferencia', 'Notas de reunión')).toBe(
      'Asignaste «Videoconferencia» a «Notas de reunión».'
    );
  });
  it('version_conflict → warning', () => {
    expect(assignErrorToast({ code: 'version_conflict' })).toEqual({
      level: 'warning',
      message: 'El documento cambió; se actualizó la fila.',
    });
  });
  it('document_locked con y sin nombre', () => {
    expect(
      assignErrorToast({ code: 'document_locked', details: { holderName: 'Luis Gómez' } }).message
    ).toBe('Luis Gómez lo está editando; probá en unos minutos.');
    expect(assignErrorToast({ code: 'document_locked' }).message).toBe(
      'Otra persona lo está editando; probá en unos minutos.'
    );
  });
  it('invalid_relation y el resto', () => {
    expect(assignErrorToast({ code: 'invalid_relation' }).message).toBe(
      'Ese proyecto no se puede asignar.'
    );
    for (const code of ['gateway_timeout', 'permission_denied', 'x']) {
      expect(assignErrorToast({ code })).toEqual({
        level: 'error',
        message: 'No se pudo asignar el proyecto. Intentá de nuevo.',
      });
    }
  });
});
