/**
 * Configuración de infraestructura leída del entorno, con validación al arrancar.
 *
 * ESTE ES EL PRIMER ASSERT DE ARRANQUE DE `core`. La convención `env-config` declaraba que el
 * servicio no tenía ninguno y lo señalaba como deuda; S-002 la salda para
 * `CORE_TRUSTED_PUBLISHER_ID`, donde el modo de fallo es silencioso y grave (ver abajo).
 *
 * POR QUÉ SE LEE EN UNA FUNCIÓN Y NO AL IMPORTAR EL MÓDULO: `dotenv.config()` corre en las dos
 * primeras líneas de `src/index.ts`. Un módulo que lea `process.env` al importarse tendría el
 * mismo problema de orden que `models/index.ts`. Leerlo dentro de una función lo evita, y de
 * paso deja que los tests ejerciten la validación manipulando el entorno sin recargar módulos.
 */

let trustedPublisherId: string | null = null;
let opusUrl: string | null = null;

/**
 * Valida y cachea la configuración de arranque. La invoca `src/index.ts` después de
 * `dotenv.config()` y ANTES de `consumer.start()`, para que el fallo ocurra al arrancar y no
 * en el primer comando.
 *
 * Lanza si falta `CORE_TRUSTED_PUBLISHER_ID` u `OPUS_URL`.
 */
export function loadConfig(): void {
  const raw = process.env.CORE_TRUSTED_PUBLISHER_ID;

  // DELIBERADAMENTE SIN `|| ''` NI NINGÚN DEFAULT, rompiendo el patrón que el resto del
  // servicio usa en todos lados.
  //
  // Un default vacío haría que NINGÚN `caller` coincida con el publicador confiable, así que
  // todos caerían por la rama externa de `resolveActor`: `files.uploaded_by` pasaría a ser el
  // service user de la api en vez de la persona, y ningún usuario podría vincular lo que
  // subió. El único síntoma sería un `file_not_owned` en S-003 — que parece un problema de
  // permisos y no de configuración. La web se rompería en silencio.
  //
  // La cadena vacía es tan peligrosa como la ausencia, por eso el trim.
  if (raw === undefined || raw.trim() === '') {
    throw new Error(
      'Falta la variable de entorno CORE_TRUSTED_PUBLISHER_ID: es el `sub` del service user ' +
      'de la api y sin ella core no puede distinguir el canal de la api del de un publicador ' +
      'externo. Configurala antes de arrancar.'
    );
  }

  trustedPublisherId = raw.trim();

  // `OPUS_URL` (REQ-015, S-071): la base absoluta CON ESQUEMA del portal, para armar
  // `${OPUS_URL}/requirements/${id}` al encolar una notificación (CA-12). NO ES `OPUS_DOMAIN`
  // (deploy/.env.dist), que es el host del ingress consumido como `https://${OPUS_DOMAIN}` en
  // docker-compose — dos cosas distintas que conviene no unificar, porque unificarlas produce
  // mails con links rotos.
  //
  // SIN DEFAULT, DELIBERADAMENTE (RF-33): depende de cada instalación, y cualquier default
  // mandaría a todo el mundo un link al dominio equivocado. Un link roto en un mail ya enviado
  // no se corrige después.
  const rawOpusUrl = process.env.OPUS_URL;
  if (rawOpusUrl === undefined || rawOpusUrl.trim() === '') {
    throw new Error(
      'Falta la variable de entorno OPUS_URL: es la base absoluta con esquema del portal ' +
      '(por ejemplo https://opus.ejemplo.com) y sin ella el módulo de notificaciones no puede ' +
      'armar el link de una notificación al encolarla. Configurala antes de arrancar.'
    );
  }

  // SIN NORMALIZAR: no se le saca la barra final ni se le agrega esquema si falta. Un valor mal
  // formado tiene que ser visible en el primer mail de la instalación, no corregido a medias por
  // código que nadie revisó. Lo único que se valida acá es QUE ESTÉ.
  opusUrl = rawOpusUrl.trim();
}

/**
 * El `sub` del service user de la api. Lo consumen los comandos a través de `resolveActor`.
 *
 * Lanza si `loadConfig()` no corrió: es preferible a devolver un valor vacío, que reintroduce
 * el modo de fallo que el assert de arranque previene.
 */
export function getTrustedPublisherId(): string {
  if (trustedPublisherId === null) {
    throw new Error('La configuración no fue cargada: llamá a loadConfig() al arrancar');
  }
  return trustedPublisherId;
}

/**
 * La base absoluta del portal, para armar el link de una notificación al encolarla.
 *
 * Lanza si `loadConfig()` no corrió, por la misma razón que `getTrustedPublisherId()`. Un
 * comando NUNCA lee `process.env.OPUS_URL` directo (regla de `_base`): el módulo de
 * notificaciones consume este accesor.
 */
export function getOpusUrl(): string {
  if (opusUrl === null) {
    throw new Error('La configuración no fue cargada: llamá a loadConfig() al arrancar');
  }
  return opusUrl;
}

/** Solo para tests: descarta la configuración cargada. */
export function resetConfig(): void {
  trustedPublisherId = null;
  opusUrl = null;
}
