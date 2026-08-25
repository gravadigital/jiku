import { Transaction } from 'sequelize';
import { IdentityType } from '@jiku/models';
import {
  Actor,
  ErrorCode,
  Reply,
  callerFromSubject,
  commandFromSubject,
  failure,
} from '@jiku/nats-protocol';
import { sequelize } from '../models';
import { authorizeCaller } from '../authorize-caller';
import logger from '../logger';
import { CommandRegistry } from '../commands/registry';
import { mirrorUser } from '../user-mirror';
import { extractActor } from './actor';

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

/**
 * Espeja en `users` la identidad del sobre, EN SU PROPIA TRANSACCIÓN.
 *
 * TRES RAZONES PARA QUE LA TRANSACCIÓN SEA PROPIA Y COMMITEE ANTES DE LA DEL COMANDO (D-3):
 *
 *  1. TIENE QUE SOBREVIVIR AL ROLLBACK DEL COMANDO, porque es un hecho sobre la IDENTIDAD y no
 *     sobre la operación. Una fila con `roles: []` cargada a mano queda corregida por cualquier
 *     comando de esa persona, INCLUSO UNO QUE DESPUÉS FALLE (CA-9).
 *  2. VAN EN SERIE, NUNCA ANIDADAS NI SIMULTÁNEAS. Una fila insertada en una transacción abierta
 *     es INVISIBLE para otra, así que sin este commit previo la FK
 *     `requirements.created_by -> users.id` fallaría igual y el espejo no serviría de nada.
 *  3. Es idempotente (alta o reemplazo por PK), así que una transacción corta propia no introduce
 *     ningún caso nuevo de consistencia.
 *
 * ESTO NO VIOLA ADR-003. La regla que ADR-003 protege es "un comando no puede dejar una escritura a
 * medias": acá el que escribe es EL DESPACHADOR —el dueño de las transacciones—, antes de abrir la
 * del comando y sobre una tabla que NINGÚN comando escribe. Ningún `execute()` ve, abre ni cierra
 * esta transacción. Y no es una segunda conexión: es el mismo `sequelize`, dos transacciones en
 * serie.
 *
 * LA CONSECUENCIA QUE ALGUIEN VA A LEER COMO BUG, Y NO LO ES: un comando rechazado por una regla de
 * dominio IGUAL ESCRIBE EN `users`. Es deliberado (CA-9) y se acepta SOLO para el publicador de
 * confianza — un caller no autorizado nunca llega acá, porque sin sobre no hay espejo y con sobre
 * la guarda de `extractActor` ya lo rechazó (CA-13).
 *
 * UN FALLO DEL ESPEJO NO RECHAZA EL COMANDO (D-P1): se loguea `error` y el despacho sigue. Tres
 * razones: "el despachador nunca lanza" (ADR-003) no admite un camino donde sí; rechazar
 * convertiría un hipo de `users` en una CAÍDA TOTAL DE ESCRITURA; y en esta story el espejo no
 * alimenta ninguna decisión —la compuerta sigue decidiendo por el caller del subject—, así que un
 * espejo fallado solo deja la fila desactualizada, que es el estado del que el producto ya vive hoy
 * cuando se pierde un evento. SI ALGUNA VEZ LA COMPUERTA LEE ESTA FILA PARA AUTORIZAR, HAY QUE
 * REVISAR ESTA DECISIÓN: un espejo no fatal se convertiría en un bypass silencioso.
 */
async function mirrorActor(actor: Actor): Promise<void> {
  // EN SU PROPIO `try`, y el precedente exacto está en `events/dispatcher.ts`: abrir una
  // transacción PUEDE FALLAR SOLA (pool agotado, base caída), y ese rechazo escaparía de
  // `dispatch()`.
  let transaction: Transaction;
  try {
    transaction = await sequelize.transaction();
  } catch (error: any) {
    logger.error(`[dispatch] espejo de ${actor.id}: ${error.message}`);
    return;
  }

  try {
    const outcome = await mirrorUser(
      {
        // EL SPREAD ACÁ SÍ, Y ES LA EXCEPCIÓN QUE CONFIRMA LA REGLA: `Actor` es una forma CERRADA
        // de cinco claves que el contrato declara, no un payload abierto como el del evento, y
        // `extractActor` ya descartó todo lo que no está en ella.
        //
        // Y ES LO QUE PROPAGA LA PRESENCIA: el espejo distingue "no vino" de "vino vacío" por
        // `hasOwnProperty`, y de eso depende que un sobre sin `name` no borre el nombre que la fila
        // ya tenía (CA-11). Enumerar los tres de perfil los volvería `undefined` PRESENTES y
        // rompería justo esa distinción.
        ...actor,
        // LITERAL, Y NUNCA DEL SOBRE. `Actor` no declara `identity_type` y no es un olvido: la api
        // autentica un JWT de usuario final y jamás de un machine user. Leerlo del cuerpo le daría
        // la capacidad de declarar que una persona es un servicio, que es superficie de seguridad
        // regalada a cambio de nada.
        identityType: IdentityType.Person,
      },
      'best-effort',
      transaction,
      'dispatch'
    );
    await transaction.commit();

    // Solo el ALTA se loguea, y solo con el id. Un `updated` por cada comando sería una línea de
    // log por cada escritura del producto; un alta es un hito real: una identidad que no estaba.
    if (outcome === 'created') {
      logger.info(`[dispatch] ${actor.id}: created`);
    }
  } catch (error: any) {
    // EL ROLLBACK NO PUEDE SER LA FUENTE DE UN RECHAZO: si lo que falló fue el `commit`, la
    // transacción ya terminó y `rollback()` sobre una terminada rechaza. Ese segundo rechazo
    // taparía el error original, que es el que hay que ver.
    await transaction.rollback().catch(() => undefined);
    logger.error(`[dispatch] espejo de ${actor.id}: ${error.message}`);
  }
}

export class Dispatcher {
  constructor(private registry: CommandRegistry) {}

  async dispatch(subject: string, raw: unknown): Promise<Reply> {
    const name = commandFromSubject(subject);
    // El caller se resuelve UNA VEZ y se reusa en el contexto del comando: antes se calculaba
    // inline dentro de la llamada a `execute`, y la compuerta lo necesita antes.
    const caller = callerFromSubject(subject);

    // EL SOBRE VA ANTES QUE LA COMPUERTA (S-029), y hay que leer por qué eso NO debilita nada.
    //
    // Este bloque NO TOCA LA BASE, NO RESUELVE EL MÉTODO y NO ABRE NINGUNA TRANSACCIÓN: es una
    // comparación de strings sobre el cuerpo. Y RECHAZA A TODO CALLER QUE NO SEA EL PUBLICADOR DE
    // CONFIANZA antes de mirar nada más, así que la propiedad que la compuerta protege —que un
    // caller no autorizado no llegue a consumir recursos ni a enterarse de qué comandos existen—
    // se conserva entera.
    //
    // Tiene que ir acá y no después porque los 20 esquemas Joi rechazan claves desconocidas: si el
    // sobre llegara a `command.validate()`, LOS 20 RESPONDERÍAN `invalid_fields`. Extraerlo acá es
    // lo que permite que ni un `execute()` se toque (CA-18).
    const extracted = extractActor(caller, raw);
    if ('error' in extracted) {
      return extracted.error;
    }
    const { actor, payload } = extracted;

    // EL ESPEJO, ANTES DE AUTORIZAR (CA-8, RF-9) y en su propia transacción, que COMMITEA antes de
    // que se abra la del comando. Sin sobre no hay espejo: ni una transacción de más ni una
    // consulta de más para el 100% del tráfico de hoy. Ver `mirrorActor` para el porqué completo.
    if (actor) {
      await mirrorActor(actor);
    }

    // LA COMPUERTA VA ANTES QUE EL RESTO (CA-6 de S-017), y las dos cosas que quedan detrás son el
    // motivo: `registry.resolve()` —un caller no autorizado no tiene por qué enterarse de si el
    // comando existe— y `sequelize.transaction()` —no consume una conexión del pool de escritura—.
    // Es el mismo criterio con que la validación de Joi corre antes de abrir la transacción.
    //
    // NO devuelve un booleano: devuelve el `Reply` de falla ya armado, o `null`. Así el código
    // del error, su mensaje y su log viven en UN solo lugar para los DOS planos.
    const denied = await authorizeCaller(caller, name, 'commands');
    if (denied) {
      return denied;
    }

    const resolved = this.registry.resolve(name);

    if (!resolved) {
      logger.warn(`[dispatch] comando desconocido: ${name}`);
      return failure(ErrorCode.UNKNOWN_COMMAND, `Unknown command: ${name}`);
    }

    const { command, params } = resolved;

    // Traza de diagnóstico: con LOG_COMMANDS=true imprime cada comando y su payload.
    // Apagada por defecto porque el payload lleva datos de negocio.
    //
    // SIGUE ACÁ, DESPUÉS DE LA COMPUERTA, y es deliberado: de un caller rechazado se registra
    // quién y qué método (en `[auth]`), NUNCA qué mandó.
    //
    // IMPRIME EL PAYLOAD YA SIN EL SOBRE, y no el `raw`: el sobre lleva `name`, `username` y
    // `email` de una persona, y agregarlos a una traza de diagnóstico sería sumar datos personales
    // al archivo de log sin que nadie lo pidiera.
    if (process.env.LOG_COMMANDS === 'true') {
      logger.info(`[cmd] ${name} <- ${JSON.stringify(payload)}`);
    }

    const validated = command.validate(payload);
    if ('error' in validated) {
      return validated.error;
    }

    const transaction = await sequelize.transaction();
    try {
      const reply = await command.execute(validated.value, { caller, params, transaction, actor });

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
