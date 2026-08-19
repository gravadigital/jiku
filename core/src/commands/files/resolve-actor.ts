import logger from '../../logger';
import { CommandContext } from '../types';
import { getTrustedPublisherId } from '../../config';

/**
 * Resuelve QUIÉN es el actor de un comando, según por qué canal llegó.
 *
 *   si ctx.caller == CORE_TRUSTED_PUBLISHER_ID  -> el actor es el declarado en el cuerpo
 *   si no                                       -> el actor es ctx.caller
 *
 * POR QUÉ HAY DOS RAMAS: el `user-id` del subject es el `sub` del service user del SERVICIO
 * que publica, no el de la persona (ADR-007), y la api usa UN ÚNICO service user para todas
 * sus personas. Así que cuando publica la api, la única fuente de la identidad de la persona
 * es el cuerpo —la api ya la autenticó contra Zitadel por JWT—; y cuando publica un servicio
 * externo no hay persona detrás: su identidad ES la del subject, avalada por el auth-callout
 * e infalsificable, y lo que declare en el cuerpo se IGNORA.
 *
 * S-003 COMPARTE ESTA FUNCIÓN para los seis comandos de dominio (`author` / `creator` /
 * `editor`). NO la dupliques ni la bifurques: si subir y vincular resolvieran la identidad
 * distinto, nadie podría vincular lo que subió. Por eso recibe el valor declarado en vez de
 * leer un campo con nombre fijo del payload.
 *
 * VIVE EN `commands/files/` PORQUE ES DONDE NACE. Cuando llegue S-003 y la compartan seis
 * comandos de otros módulos, conviene subirla a `commands/`; es un rename de una línea y no
 * hay motivo para anticiparlo.
 *
 * @param ctx          contexto del comando, con el `caller` ya resuelto del subject
 * @param declaredActor el actor que declara el cuerpo (`uploader`, `author`, `creator`, ...)
 * @param component    prefijo para el log de la rama externa, p. ej. `files.request-upload`
 * @returns el actor resuelto, o `undefined` si la rama de la api no produjo ninguno
 */
export function resolveActor(
  ctx: CommandContext,
  declaredActor: string | undefined,
  component: string
): string | undefined {
  if (ctx.caller === getTrustedPublisherId()) {
    // La api SIEMPRE lo manda (el contrato lo pone en `required`). Si llegara sin él,
    // devolver `undefined` deja que el comando responda `invalid_fields`, que es mucho más
    // legible que el `NOT NULL` violation e `internal_error` opaco del INSERT.
    return declaredActor;
  }

  // `warn` y no `error`: la rama externa no es un fallo, es el caso raro de hoy (RF-11). Su
  // ausencia haría que un CORE_TRUSTED_PUBLISHER_ID mal configurado se manifieste SOLO como
  // `file_not_owned` en S-003, que parece un problema de permisos y no de configuración.
  //
  // Se loguea el `caller` —un identificador de servicio— pero NUNCA el payload: la convención
  // `logging` prohíbe loguear datos de negocio fuera de LOG_COMMANDS.
  logger.warn(
    `[${component}] comando publicado por un caller externo: ${ctx.caller}. ` +
    'El actor se resuelve del subject y se ignora lo declarado en el cuerpo.'
  );

  return ctx.caller;
}

export default resolveActor;
