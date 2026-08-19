import { sequelize } from '../models';
import logger from '../logger';
import { CommandRegistry } from '../commands/registry';
import { ErrorCode, Reply, callerFromSubject, commandFromSubject, failure } from '@jiku/nats-protocol';

/**
 * Traduce un mensaje del bus a la ejecución de un comando.
 *
 * Es el único lugar donde se maneja la transacción: commit si el comando responde
 * `success`, rollback en cualquier otro caso. Los comandos no la abren ni la cierran, y
 * así no pueden dejar una escritura a medias.
 *
 * Nunca lanza: un comando que falla se traduce a un `Reply` de error, porque del otro
 * lado hay una request esperando respuesta. Quedarse sin contestar dejaría a la api
 * esperando hasta su timeout.
 */
/**
 * Claves del `data` de un reply cuyo valor NUNCA puede llegar al log.
 *
 * Una URL prefirmada lleva la firma: da acceso al contenido del objeto sin ninguna credencial,
 * durante todo su TTL. Loguearla convierte el archivo de log en un repositorio de accesos
 * anónimos, así que se redacta incluso bajo `LOG_COMMANDS`, que es una traza de diagnóstico y
 * no una excepción a la regla.
 */
const REDACTED_REPLY_KEYS = ['uploadUrl', 'downloadUrl'];

/** Reemplaza por un marcador los valores sensibles del reply, solo para el log. */
function redactReply(reply: Reply): Reply {
  const data = reply.data;
  if (!data || typeof data !== 'object') {
    return reply;
  }

  const redacted: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  let touched = false;
  for (const key of REDACTED_REPLY_KEYS) {
    if (key in redacted) {
      redacted[key] = '[redacted]';
      touched = true;
    }
  }

  return touched ? { ...reply, data: redacted } : reply;
}

export class Dispatcher {
  constructor(private registry: CommandRegistry) {}

  async dispatch(subject: string, raw: unknown): Promise<Reply> {
    const name = commandFromSubject(subject);
    const resolved = this.registry.resolve(name);

    if (!resolved) {
      logger.warn(`[dispatch] comando desconocido: ${name}`);
      return failure(ErrorCode.UNKNOWN_COMMAND, `Unknown command: ${name}`);
    }

    const { command, params } = resolved;

    // Traza de diagnóstico: con LOG_COMMANDS=true imprime cada comando y su payload.
    // Apagada por defecto porque el payload lleva datos de negocio.
    if (process.env.LOG_COMMANDS === 'true') {
      logger.info(`[cmd] ${name} <- ${JSON.stringify(raw)}`);
    }

    const validated = command.validate(raw);
    if ('error' in validated) {
      return validated.error;
    }

    const transaction = await sequelize.transaction();
    try {
      const reply = await command.execute(validated.value, {
        caller: callerFromSubject(subject),
        params,
        transaction,
      });

      if (reply.status === 'success') {
        await transaction.commit();
      } else {
        await transaction.rollback();
      }

      if (process.env.LOG_COMMANDS === 'true') {
        logger.info(`[cmd] ${name} -> ${JSON.stringify(redactReply(reply))}`);
      }
      return reply;
    } catch (error: any) {
      await transaction.rollback();
      logger.error(`[dispatch] ${name}: ${error.message}`);
      return failure(ErrorCode.INTERNAL_ERROR, 'Internal error');
    }
  }
}
