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
