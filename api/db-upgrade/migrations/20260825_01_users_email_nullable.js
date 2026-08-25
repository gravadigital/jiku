'use strict';

/**
 * `users.email` pasa a aceptar NULL, para que una IDENTIDAD DE SERVICIO pueda espejarse.
 *
 * POR QUE EXISTE. `users` es el espejo del proveedor de identidad, y desde REQ-005 lo puebla el
 * evento `{instance}.events.auth` que publica el auth-callout. Un MACHINE USER de Zitadel NO
 * TIENE direccion de correo: el endpoint `userinfo` no devuelve el claim `email` aunque
 * CALLOUT_IDP_ENRICH=profile este puesto, asi que el callout OMITE la clave. Con la columna en
 * NOT NULL el consumidor no tenia forma de escribir esa fila, y el sintoma era este, verificado
 * en el log de `core` con dos milisegundos de diferencia entre las dos lineas:
 *
 *   warn: [events] descartado: "email" is required
 *   warn: [auth] queries: caller no autorizado: 387842544790142978 -> meta.describe
 *
 * El evento se descarta, no queda fila, y las DOS COMPUERTAS del bus rechazan a esa identidad:
 * `authorizeCaller` responde `caller_not_authorized` a todo comando y la resolucion de clase
 * responde `unknown_caller` a toda consulta. Sin esta columna nullable no hay una sola fila con
 * `identity_type = 'service'` en la base, y con ella se caen cuatro cosas del producto: el canal
 * del publicador externo entero, el plano de consultas para la api, el INSERT de
 * `files.uploaded_by` (FK RESTRICT contra `users.id`) y la marca de identidad automatica de
 * S-019, que no tiene ninguna fila `service` que marcar.
 *
 * POR QUE NULL Y NO UN PLACEHOLDER. Se evaluo completar un valor sintetico en `core`
 * (`{id}@service.invalid`), que tiene precedente en este mismo esquema —`system@mail.com` en
 * 20240724_01 y `mail-bot@example.invalid` en 20260703_05— y no habria requerido migracion. Se
 * descarto: `users` es un ESPEJO, y NULL dice "no tiene" mientras un placeholder dice "tiene
 * esto". El precedente es de filas sembradas a mano, no de identidades espejadas.
 *
 * NO ES UN CAMBIO DE CONTRATO PARA NINGUNA PANTALLA. Ninguna respuesta HTTP que hoy devuelve
 * `email` lo hace de una identidad de servicio con la columna vacia, y NINGUN frontend renderiza
 * el email de un usuario que venga del backend: lo unico que se muestra es el de la SESION
 * PROPIA, que siempre es una persona. Los 16 `include` de la api que declaran
 * `attributes: [..., 'email', ...]` lo pasan tal cual.
 *
 * LA GUARDA DE `core` SIGUE EXIGIENDO EMAIL A UNA PERSONA. Esta migracion habilita la columna;
 * quien decide cuando puede faltar es el esquema Joi de `core/src/events/dispatcher.ts`, que lo
 * vuelve opcional SOLO con `identity_type === 'service'`. Una persona sin email sigue siendo un
 * descarte con su `warn`, porque ahi el faltante significa que el emisor esta mal configurado
 * (CALLOUT_IDP_ENRICH ausente) y ese diagnostico hay que conservarlo.
 *
 * SIN REESCRITURA DE TABLA Y SIN VENTANA DE MANTENIMIENTO. Soltar un NOT NULL es un cambio de
 * CATALOGO: PostgreSQL solo limpia `pg_attribute.attnotnull`, no toca una sola fila. El lock es
 * ACCESS EXCLUSIVE pero dura microsegundos, y la ventana coincide igual con el despliegue porque
 * las escrituras entran por `core`, que se despliega DESPUES de la migracion.
 *
 * SIN TRANSACCION EXPLICITA: es una sola sentencia, asi que no hay estado intermedio que
 * proteger. (sequelize-cli no abre una por migracion — ver la nota verificada de 20260824_02.)
 *
 * SIN BACKFILL: soltar el NOT NULL no cambia ninguna fila existente. Las 28 filas de personas
 * conservan su direccion, y las dos de sistema (`system-sub`, `system-mail-bot`) tambien.
 */
module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.query('ALTER TABLE users ALTER COLUMN email DROP NOT NULL;');
  },

  /**
   * REVERSIBLE, PERO NO INCONDICIONAL, y es lo unico que hay que saber de este `down`.
   *
   * Restaurar el NOT NULL falla si para entonces existe alguna fila con `email` en NULL — es
   * decir, si alguna identidad de servicio ya se espejo. PostgreSQL responde:
   *
   *   column "email" of relation "users" contains null values
   *
   * SE DEJA FALLAR A PROPOSITO. La alternativa seria completar esas filas con un valor
   * inventado antes del ALTER, y eso es exactamente lo que el `up` decidio no hacer: un `down`
   * que fabrica direcciones de correo para poder correr deja datos falsos en el espejo y nadie
   * se entera. El error nombra la columna y la tabla, asi que es diagnosticable.
   *
   * PARA REVERTIR DE VERDAD hay que decidir antes que pasa con esas filas —borrarlas, o
   * completarlas a mano con un criterio explicito— y recien despues correr el `down`. Las
   * identidades de servicio se vuelven a espejar solas en su proxima autenticacion contra el
   * bus, asi que borrarlas no pierde nada irrecuperable.
   */
  down: (queryInterface) => {
    return queryInterface.sequelize.query('ALTER TABLE users ALTER COLUMN email SET NOT NULL;');
  },
};
