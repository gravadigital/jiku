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

  /**
   * S-014 (CA-5): los dos códigos que la api emite POR SU CUENTA no están —y no tienen que
   * estar— en este mapa.
   *
   * Este mapa traduce el `errorCode` DE UN REPLY DE CORE. `service_unavailable` y
   * `gateway_timeout` no vienen en ningún reply: los genera la api en el `catch` del bus,
   * cuando no hubo reply. Son dos mapas distintos y confundirlos es el error fácil de la
   * story: agregar `gateway_timeout` acá sería declarar que core lo emite, que es falso.
   */
  // TS-7: EL 500 DE ESTA ASERCIÓN ES LA PRUEBA DE LA AUSENCIA EN EL MAPA, NO UN
  // COMPORTAMIENTO DESEADO. No lo "arregles" agregando la entrada: eso es exactamente lo que
  // CA-5 prohíbe. Nadie llama a `httpStatusFor('gateway_timeout')` en producción, porque el
  // status del timeout lo pone `sendCommand` directo.
  it('TS-7: no tiene gateway_timeout en el mapa (lo emite la api, no core)', () => {
    httpStatusFor('gateway_timeout').should.equal(500);
  });

  // TS-8: `service_unavailable` tampoco está, por la misma razón y desde siempre. Es la
  // prueba de que la ausencia de `gateway_timeout` sigue el patrón que ya existía.
  it('TS-8: tampoco tiene service_unavailable, por la misma razón', () => {
    httpStatusFor('service_unavailable').should.equal(500);
  });

  // TS-9: el mapa no perdió ninguna entrada al desdoblar el 503/504. La rama del 504 vive en
  // `send-command.ts` y no toca `protocol.ts`.
  it('TS-9: conserva las entradas existentes tras el desdoblamiento 503/504', () => {
    httpStatusFor('invalid_fields').should.equal(400);
    httpStatusFor('user_not_found').should.equal(404);
    httpStatusFor('file_not_owned').should.equal(403);
    httpStatusFor('internal_error').should.equal(500);
  });
});
