import logger from '../logger';
import { CommandContext } from './types';
import { getTrustedPublisherId } from '../config';

/**
 * Resuelve QUIÉN es el actor de un comando, según por qué canal llegó.
 *
 *   si hay sobre                                -> el actor es ctx.actor.id
 *   si no, y ctx.caller == CORE_TRUSTED_PUBLISHER_ID  -> el actor es el declarado en el cuerpo
 *   en cualquier otro caso                      -> el actor es ctx.caller
 *
 * LA ESCALERA ESTÁ COPIADA DEL CONTRATO, no reinventada: es la misma que declara
 * `components/schemas/Actor` en `docs/apis/core.yaml` y el docblock de `Actor` en el paquete.
 * Ante cualquier diferencia entre este comentario y el YAML, MANDA EL YAML.
 *
 * POR QUÉ LA DEL SOBRE VA PRIMERA (S-029): cuando el sobre viene, sus `roles` y su `id` salen del
 * claim que la api YA VERIFICÓ criptográficamente contra Zitadel, y ese claim es MÁS FRESCO que
 * cualquier cosa persistida. Consultar otra fuente sería resolver la identidad dos veces desde dos
 * lugares, con la peor de las dos decidiendo.
 *
 * Y NO HAY `?? declaredActor` EN ESA RAMA, deliberadamente: si hay sobre, `actor.id` EXISTE —la
 * guarda de forma del despachador lo garantizó antes de armar el contexto— y si además vino un
 * campo de dominio, el despachador ya garantizó que ES EL MISMO VALOR o rechazó el comando (CA-6).
 * Un fallback ahí sería código muerto que sugiere un tercer estado que no existe.
 *
 * POR QUÉ HAY DOS RAMAS MÁS: el `user-id` del subject es el `sub` del service user del SERVICIO
 * que publica, no el de la persona (ADR-007), y la api usa UN ÚNICO service user para todas
 * sus personas. Así que cuando publica la api, la única fuente de la identidad de la persona
 * es el cuerpo —la api ya la autenticó contra Zitadel por JWT—; y cuando publica un servicio
 * externo no hay persona detrás: su identidad ES la del subject, avalada por el auth-callout
 * e infalsificable, y lo que declare en el cuerpo se IGNORA.
 *
 * LA COMPARTEN SIETE COMANDOS: `files.request-upload` (que la trajo al mundo en S-002) y los
 * seis de dominio que vinculan archivos —`requirements.new`, `requirements.{id}.edit`,
 * `requirements.{id}.comment`, `tasks.new`, `tasks.{id}.edit`, `tasks.{id}.comment`— a través
 * de `link-files.ts`. NO la dupliques ni la bifurques: si subir y vincular resolvieran la
 * identidad distinto, nadie podría vincular lo que subió. Por eso recibe el valor declarado en
 * vez de leer un campo con nombre fijo del payload.
 *
 * VIVE EN `commands/` —y ya no en `commands/files/`— justamente porque la comparten módulos
 * distintos: dejarla en `files/` obligaría a `requirements/` y `tasks/` a importar del módulo
 * de archivos, que es el acoplamiento que este movimiento (S-003) evita.
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
  if (ctx.actor) {
    // El claim que la api YA VERIFICÓ contra Zitadel, y que es MÁS FRESCO que la base.
    //
    // NO LOGUEA NADA, y es parte del criterio: el `warn` de abajo es de la rama externa y solo de
    // ahí. Un log acá pondría en rojo a `attachments.test.ts`, que afirma `warn.called === false`.
    return ctx.actor.id;
  }

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
