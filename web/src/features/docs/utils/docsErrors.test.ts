import { describe, it, expect } from 'vitest';
import {
  attachmentErrorMessage,
  describeCreateError,
  saveValidationMessage,
  savedMessage,
} from './docsErrors';

describe('describeCreateError (TS-16)', () => {
  it('permission_denied va junto al selector de visibilidad', () => {
    expect(describeCreateError({ code: 'permission_denied' })).toEqual({
      notice: 'Solo la conducción puede crear un documento restringido.',
      target: 'visibility',
    });
  });
  it('el resto va al formulario', () => {
    expect(describeCreateError({ code: 'invalid_relation' })).toEqual({
      notice: 'El proyecto o el cliente elegido ya no existe. Elegí otro.',
      target: 'form',
    });
    expect(describeCreateError({ code: 'frontmatter_invalid', message: 'topics' })).toEqual({
      notice: 'Las propiedades no son válidas: topics.',
      target: 'form',
    });
    expect(describeCreateError({ code: 'module_unavailable' })).toEqual({
      notice: 'La documentación no está disponible en este momento. Probá de nuevo en unos minutos.',
      target: 'form',
    });
    expect(describeCreateError({ code: 'gateway_timeout' })).toEqual({
      notice: 'No se pudo crear el documento. Intentá de nuevo.',
      target: 'form',
    });
  });
  it('already_exists lo resuelve el diálogo como éxito', () => {
    expect(describeCreateError({ code: 'already_exists' })).toBeNull();
  });
});

describe('saveValidationMessage', () => {
  it('textos verbatim con el detalle del módulo', () => {
    expect(
      saveValidationMessage({ code: 'frontmatter_invalid', message: 'falta cerrar ---' })
    ).toBe('Las propiedades no son válidas: falta cerrar ---.');
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
    expect(savedMessage(7, [], true)).toBe('Guardaste la versión 7. Quedó protegida.');
    expect(savedMessage(7, ['possible_secret_detected'], true)).toBe(
      'Guardaste la versión 7. Revisalo: parece contener una clave o un token.'
    );
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
