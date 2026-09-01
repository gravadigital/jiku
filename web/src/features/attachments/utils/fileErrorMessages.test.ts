import { describe, it, expect } from 'vitest';
import { fileErrorMessage, commentErrorMessage } from './fileErrorMessages';

describe('fileErrorMessage', () => {
  it('traduce file_not_owned', () => {
    expect(fileErrorMessage({ code: 'file_not_owned' }, 'fallback')).toBe(
      'No podés adjuntar un archivo que subió otra persona'
    );
  });

  it('cae al fallback con un código desconocido', () => {
    expect(fileErrorMessage({ code: 'unknown' }, 'fallback')).toBe('fallback');
  });
});

describe('commentErrorMessage (S-048)', () => {
  // TS-39 (CA-10): traduce cada código de edición de comentario a su mensaje en español
  const cases: Array<[string, string]> = [
    ['comment_not_owned', 'No podés editar un comentario que no es tuyo'],
    ['activity_not_editable', 'Esta entrada no es un comentario y no se puede editar'],
    ['comment_not_found', 'El comentario ya no existe'],
    ['file_not_owned', 'No podés adjuntar un archivo que subió otra persona'],
    ['service_unavailable', 'El servicio no está disponible en este momento'],
    ['gateway_timeout', 'La operación tardó demasiado'],
  ];

  it.each(cases)('TS-39: %s -> "%s"', (code, expected) => {
    expect(commentErrorMessage({ code }, 'Hubo un error al editar el comentario')).toBe(expected);
  });

  // TS-40 (CA-10): cae al fallback con un error sin code
  it('TS-40: cae al fallback con un error sin code', () => {
    expect(commentErrorMessage(new Error('boom'), 'Hubo un error al editar el comentario')).toBe(
      'Hubo un error al editar el comentario'
    );
  });

  it('cae al fallback con un código desconocido', () => {
    expect(commentErrorMessage({ code: 'internal_error' }, 'Hubo un error al editar el comentario')).toBe(
      'Hubo un error al editar el comentario'
    );
  });
});
