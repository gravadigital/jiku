import { describe, it, expect } from 'vitest';
import {
  SHARES_LOAD_FAILED_MESSAGE,
  describeCreateShareError,
  revokeShareErrorMessage,
} from './shareErrors';

const e = (code: string) => ({ code, message: 'x', status: 400 });

describe('shareErrors', () => {
  it('TS-12: mapeo de errores del alta', () => {
    expect(describeCreateShareError(e('secret_warning_not_acknowledged'))).toEqual({
      state: 'secret',
    });
    expect(describeCreateShareError(e('sharing_blocked'))).toEqual({ state: 'blocked' });
    expect(describeCreateShareError(e('share_expiry_invalid'))).toEqual({
      field: 'El vencimiento no es válido. Elegí entre 7 y 180 días.',
    });
    expect(describeCreateShareError(e('sharing_not_configured'))).toEqual({
      notice: 'Compartir no está habilitado en esta instalación.',
    });
    expect(describeCreateShareError(e('module_unavailable'))).toEqual({
      notice:
        'La documentación no está disponible en este momento. Probá de nuevo en unos minutos.',
    });
    expect(describeCreateShareError(e('permission_denied'))).toEqual({
      notice: 'No tenés permiso para compartir este documento.',
    });
    expect(describeCreateShareError(e('gateway_timeout'))).toEqual({
      notice: 'No se pudo crear el link. Intentá de nuevo.',
    });
  });

  it('mensajes de lista y revocación', () => {
    expect(SHARES_LOAD_FAILED_MESSAGE).toBe('No se pudieron cargar los links.');
    expect(revokeShareErrorMessage(e('share_not_found'))).toBeNull();
    expect(revokeShareErrorMessage(e('module_unavailable'))).toBe(
      'La documentación no está disponible en este momento. Probá de nuevo en unos minutos.'
    );
    expect(revokeShareErrorMessage(e('gateway_timeout'))).toBe(
      'No se pudo revocar el link. Intentá de nuevo.'
    );
  });
});
