import 'mocha';
import 'should';
import { errorBody, httpStatusFor } from '../../lib/utils/bus/protocol';

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

  /**
   * S-017 (CA-13 punto 3, CA-14): el único código que agrega REQ-005, y el primero que emite
   * el DESPACHADOR de core y no un comando.
   *
   * En la práctica esta api nunca lo recibe —su canal está exento de la compuerta—, así que
   * estos cinco tests son lo único que sostiene la entrada del mapa. Sin ellos, el próximo
   * que lea "la api nunca lo recibe" la borra por código muerto, y el día que aparezca (una
   * rotación del service user que deje CORE_TRUSTED_PUBLISHER_ID desalineada) saldrá 500.
   */
  it('TS-5 (S-017): mapea caller_not_authorized a 403', () => {
    httpStatusFor('caller_not_authorized').should.equal(403);
  });

  // Las tres direcciones importan y cada una atrapa un error distinto: 400 sería tratarlo
  // como entrada inválida, 404 sería reusar el status de `user_not_found`, y 500 sería que la
  // entrada no está y cayó en el fallback.
  it('TS-6 (S-017): no es 400 ni 404 ni 500', () => {
    httpStatusFor('caller_not_authorized').should.not.equal(400);
    httpStatusFor('caller_not_authorized').should.not.equal(404);
    httpStatusFor('caller_not_authorized').should.not.equal(500);
  });

  // La igualdad es lo que documenta la relación: los dos describen un permiso y ninguno de los
  // dos lo emite un comando que esta api publique.
  it('TS-7 (S-017): comparte el 403 con file_not_owned, su precedente', () => {
    httpStatusFor('caller_not_authorized').should.equal(httpStatusFor('file_not_owned'));
    httpStatusFor('caller_not_authorized').should.equal(403);
  });

  // CA-9 del lado de la api: reusar `user_not_found` era la tentación —ya existe, ya está
  // mapeado— y está descartado por dos razones. Una de las dos es este 404.
  it('TS-8 (S-017): user_not_found sigue en 404 y es un código distinto', () => {
    httpStatusFor('user_not_found').should.equal(404);
    httpStatusFor('caller_not_authorized').should.equal(403);
    httpStatusFor('user_not_found').should.not.equal(httpStatusFor('caller_not_authorized'));
  });

  it('TS-9 (S-017): errorBody arma { code, message } sin remainingMinutes', () => {
    const body = errorBody({
      status: 'failure',
      errorCode: 'caller_not_authorized',
      errorMessage: 'Caller no autorizado',
    });
    body.should.deepEqual({
      code: 'caller_not_authorized',
      message: 'Caller no autorizado',
    });
  });

  /**
   * S-030 (CA-9, CA-10, CA-11): el único código que agrega REQ-007, y el TERCERO de los tres
   * lugares que exige la convención de errores. Los otros dos ya estaban escritos.
   *
   * ESTA API TODAVÍA NO LO RECIBE —sigue autorizando por su cuenta (CA-14)—, así que estos tests
   * son LO ÚNICO que sostiene la entrada del mapa. Sin ellos, el próximo que lea "la api nunca lo
   * recibe" la borra por código muerto, y el día que S-034 elimine `validateProjectPermissions`
   * todos esos rechazos salen 500.
   */
  it('TS-1 (S-030): mapea access_denied a 403', () => {
    httpStatusFor('access_denied').should.equal(403);
  });

  // Las tres direcciones atrapan errores distintos: 400 sería tratarlo como entrada inválida, 404
  // sería reusar el status de `user_not_found`, y 500 sería que la entrada no está y cayó en el
  // `|| 500` del fallback.
  it('TS-2 (S-030): no es 400 ni 404 ni 500', () => {
    httpStatusFor('access_denied').should.not.equal(400);
    httpStatusFor('access_denied').should.not.equal(404);
    httpStatusFor('access_denied').should.not.equal(500);
  });

  // La igualdad documenta la relación: los tres 403 del mapa describen un PERMISO, y ninguno de
  // los tres lo emite un comando que esta api publique.
  it('TS-3 (S-030): comparte el 403 con file_not_owned y caller_not_authorized', () => {
    httpStatusFor('access_denied').should.equal(403);
    httpStatusFor('file_not_owned').should.equal(403);
    httpStatusFor('caller_not_authorized').should.equal(403);
    httpStatusFor('access_denied').should.equal(httpStatusFor('file_not_owned'));
  });

  // CA-10 desde el cuerpo de la respuesta: comparten el status pero NO se fusionan. El `code` es
  // lo que distingue "¿tu rol habilita este método?" de "¿podés tocar ESTA entidad?", y es sobre
  // `code` que los dos frontends hacen `switch`.
  it('TS-4 (S-030): no se fusiona con caller_not_authorized: mismo status, code distinto', () => {
    const denied = errorBody({
      status: 'failure',
      errorCode: 'access_denied',
      errorMessage: 'No tenés permiso sobre esta entidad',
    });
    const notAuthorized = errorBody({
      status: 'failure',
      errorCode: 'caller_not_authorized',
      errorMessage: 'Caller no autorizado',
    });

    denied.should.deepEqual({
      code: 'access_denied',
      message: 'No tenés permiso sobre esta entidad',
    });
    notAuthorized.should.deepEqual({
      code: 'caller_not_authorized',
      message: 'Caller no autorizado',
    });
    String(denied.code).should.not.equal(String(notAuthorized.code));
    httpStatusFor('access_denied').should.equal(httpStatusFor('caller_not_authorized'));
  });

  // El rechazo de core viaja SIN `errorDetails` (el mensaje no puede llevar el proyecto ni la
  // entidad), así que el cuerpo tiene exactamente dos claves: nada de `remainingMinutes`.
  it('TS-5 (S-030): errorBody arma { code, message } y nada más', () => {
    const body = errorBody({
      status: 'failure',
      errorCode: 'access_denied',
      errorMessage: 'No tenés permiso sobre esta entidad',
    });
    body.should.deepEqual({
      code: 'access_denied',
      message: 'No tenés permiso sobre esta entidad',
    });
  });

  // El fallback sigue vivo: agregar una entrada no lo rompió.
  it('TS-6 (S-030): mantiene el fallback a 500 para un código desconocido y para undefined', () => {
    httpStatusFor('codigo_inexistente').should.equal(500);
    httpStatusFor(undefined).should.equal(500);
  });

  // CA-14 sobre el mapa: la entrada nueva no movió ninguna de las que ya estaban.
  it('TS-7 (S-030): ninguna entrada preexistente cambió de status', () => {
    httpStatusFor('invalid_fields').should.equal(400);
    httpStatusFor('user_not_found').should.equal(404);
    httpStatusFor('file_not_owned').should.equal(403);
    httpStatusFor('caller_not_authorized').should.equal(403);
    httpStatusFor('internal_error').should.equal(500);
  });

  // Los dos códigos que emite LA API —no core— siguen fuera del mapa (S-014 CA-5 intacto). EL 500
  // ES LA PRUEBA DE LA AUSENCIA, NO UN COMPORTAMIENTO DESEADO: no lo "arregles" agregándolos.
  it('TS-8 (S-030): gateway_timeout y service_unavailable siguen fuera del mapa', () => {
    httpStatusFor('gateway_timeout').should.equal(500);
    httpStatusFor('service_unavailable').should.equal(500);
  });

  /**
   * S-047 (CA-6, D-1): los tres códigos que emiten los comandos de edición de comentario de
   * core (`tasks.{id}.comment.{cid}.edit` y `requirements.{id}.comment.{cid}.edit`, S-046).
   * Son tres y no dos: `comment_not_found` también viajaba local hasta ahora (400) y sin su
   * entrada en el mapa pasaría de 400 a 500 al migrar la ruta a publicar el comando.
   */
  it('TS-20: mapea comment_not_owned a 403', () => {
    httpStatusFor('comment_not_owned').should.equal(403);
  });

  it('TS-21: mapea activity_not_editable a 400', () => {
    httpStatusFor('activity_not_editable').should.equal(400);
  });

  it('TS-22 (D-1): mapea comment_not_found a 400, no a 500', () => {
    httpStatusFor('comment_not_found').should.equal(400);
    httpStatusFor('comment_not_found').should.not.equal(500);
  });

  // Un código inventado sigue cayendo en el fallback: las tres entradas nuevas no lo rompieron.
  it('S-047: mantiene el fallback a 500 para un código inventado', () => {
    httpStatusFor('codigo_inventado_s047').should.equal(500);
  });

  // Ninguna entrada preexistente cambió de status con el agregado de esta story.
  it('S-047: ninguna entrada preexistente cambió de status', () => {
    httpStatusFor('invalid_fields').should.equal(400);
    httpStatusFor('user_not_found').should.equal(404);
    httpStatusFor('file_not_owned').should.equal(403);
    httpStatusFor('caller_not_authorized').should.equal(403);
    httpStatusFor('access_denied').should.equal(403);
    httpStatusFor('internal_error').should.equal(500);
  });
});
