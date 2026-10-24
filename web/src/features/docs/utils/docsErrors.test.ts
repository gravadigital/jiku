import { describe, it, expect } from 'vitest';
import {
  attachmentErrorMessage,
  describeCreateError,
  saveValidationMessage,
  savedMessage,
} from './docsErrors';

describe('describeCreateError', () => {
  it('campo, aviso de módulo caído y error de sistema', () => {
    expect(describeCreateError({ code: 'already_exists' }).field).toMatch(/Ya hay un documento/);
    expect(describeCreateError({ code: 'file_name_invalid' }).field).toMatch(/no es válido/);
    expect(describeCreateError({ code: 'module_unavailable' }).notice).toMatch(
      /no está disponible/
    );
    expect(describeCreateError({ code: 'folder_not_found' }).notice).toBe(
      'No se pudo crear el documento. Intentá de nuevo.'
    );
  });
});

describe('saveValidationMessage', () => {
  it('textos verbatim con el detalle del módulo', () => {
    expect(
      saveValidationMessage({ code: 'frontmatter_invalid', message: 'falta cerrar ---' })
    ).toBe('El frontmatter no es válido: falta cerrar ---. Corregilo y volvé a guardar.');
    expect(saveValidationMessage({ code: 'invalid_relation', message: 'projects: 999' })).toBe(
      'Uno de los vínculos no existe: projects: 999.'
    );
    expect(saveValidationMessage({ code: 'content_too_large' })).toBe(
      'El documento supera los 256 KiB que se pueden guardar desde acá.'
    );
    expect(saveValidationMessage({ code: 'gateway_timeout' })).toBeNull();
  });
});

describe('savedMessage / attachmentErrorMessage', () => {
  it('con y sin aviso de secreto', () => {
    expect(savedMessage(7)).toBe('Guardaste la versión 7.');
    expect(savedMessage(7, ['possible_secret_detected'])).toBe(
      'Guardaste la versión 7. Revisalo: parece contener una clave o un token.'
    );
  });
  it('mapea adjuntos', () => {
    expect(attachmentErrorMessage({ code: 'attachment_type_not_allowed' })).toBe(
      'Ese tipo de archivo no está permitido.'
    );
    expect(attachmentErrorMessage({ code: 'attachment_too_large' })).toBe(
      'El archivo supera el tamaño máximo permitido.'
    );
    for (const code of ['expired_upload_url', 'attachments_not_configured', 'checksum_mismatch']) {
      expect(attachmentErrorMessage({ code })).toBe(
        'No se pudo adjuntar el archivo. Intentá de nuevo.'
      );
    }
  });
});
