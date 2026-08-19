import 'mocha';
import 'should';
import { httpStatusFor } from '../../lib/utils/bus/protocol';

describe('httpStatusFor', () => {
  // Los dos códigos que emite `files.{fileId}.request-download` (S-005). Sin su entrada en
  // el mapa caerían en el 500 genérico del fallback y CA-7 / CA-8 serían imposibles de
  // cumplir por más correcto que sea el handler.
  it('mapea file_not_found a 404', () => {
    httpStatusFor('file_not_found').should.equal(404);
  });

  it('mapea file_not_available a 404', () => {
    httpStatusFor('file_not_available').should.equal(404);
  });

  // TS-38 / TS-39: los dos rechazos de la política de subida que emite
  // `files.request-upload` (core, S-002). Son 400 porque describen una ENTRADA rechazada.
  it('mapea file_type_not_allowed a 400', () => {
    httpStatusFor('file_type_not_allowed').should.equal(400);
  });

  it('mapea file_too_large a 400', () => {
    httpStatusFor('file_too_large').should.equal(400);
  });

  // TS-40: el más fácil de mapear mal. `file_not_owned` es 403 y NO 400: describe un
  // permiso, no una entrada malformada.
  it('mapea file_not_owned a 403, no a 400', () => {
    httpStatusFor('file_not_owned').should.equal(403);
    httpStatusFor('file_not_owned').should.not.equal(400);
  });

  // TS-43: la regla de ADR-002 enunciada de una sola vez. Un código nuevo sin entrada en el
  // mapa cae en el `|| 500` y el usuario ve un error genérico donde el contrato promete uno
  // entendible.
  it('no deja caer ninguno de los cinco códigos de archivos en el 500 genérico', () => {
    const codes = [
      'file_type_not_allowed',
      'file_too_large',
      'file_not_owned',
      'file_not_found',
      'file_not_available',
    ];
    codes.forEach((code) => {
      httpStatusFor(code).should.not.equal(500);
    });
  });

  // TS-44: el fallback sigue vivo — agregar entradas no lo rompió.
  it('mantiene el fallback a 500 para un código desconocido', () => {
    httpStatusFor('codigo_inexistente').should.equal(500);
  });

  it('no cambia el status de los códigos ya mapeados', () => {
    httpStatusFor('invalid_fields').should.equal(400);
    httpStatusFor('user_not_found').should.equal(404);
    httpStatusFor('internal_error').should.equal(500);
    httpStatusFor(undefined).should.equal(500);
  });
});
