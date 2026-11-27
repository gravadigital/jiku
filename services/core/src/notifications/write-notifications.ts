import { NotificationOutbox } from '@jiku/models';
import { NotificationDeclaration } from '@jiku/nats-protocol';
import { CommandContext } from '../commands/types';
import { buildNotificationPayload } from './payload';
import { resolveFilteredRecipients } from './recipients';

/**
 * Escribe en `notification_outbox` las notificaciones que un comando declaró en su `Reply`
 * (REQ-015, D-3, D-4 · CA-3). Lo invoca el DESPACHADOR, ANTES del `commit()` (Task 5) — este
 * archivo vive separado de `dispatcher.ts`, igual que `emit-events.ts`, para que su
 * comportamiento sea testeable sin arrastrar todo el dispatch y para que el cambio en el
 * despachador quede chico.
 *
 * SIN `TRY/CATCH` PROPIO, A DIFERENCIA DE `emitEvents()` — Y ES LA DECISIÓN CENTRAL DE ADR-003
 * EXTENDIDO (ver el recuadro en el Story Plan). Esta función corre DENTRO del `try` que el
 * despachador ya abre alrededor de `command.execute()`, así que un fallo suyo (una consulta que
 * rechaza, un `bulkCreate` que rechaza) PROPAGA sin atraparse acá, y provoca el mismo
 * `rollback()` que cualquier otro fallo de escritura del comando. Envolverla en un `try/catch`
 * propio sería copiar el patrón de `emitEvents` a un lugar donde significa lo opuesto: un fallo
 * de encolado se volvería un `success` silencioso sin fila y sin mail — precisamente lo que este
 * REQ existe para evitar.
 *
 * UN SOLO `bulkCreate` PARA TODO EL LOTE (CA-3), no un `create` por fila ni uno por declaración:
 * se acumulan las filas de TODAS las declaraciones del `Reply` y se insertan de una vez.
 *
 * DE DÓNDE SALE `actorId`, Y POR QUÉ NO ES `resolveActor()` DE `commands/`: esa función necesita
 * un `declaredActor` DE DOMINIO (`payload.creator`, `payload.author`, ...) que solo cada comando
 * conoce — el escritor es genérico y no tiene ningún campo así (`NotificationDeclaration` no lo
 * declara, Task 1 AC-4). La identidad que el escritor usa es la MISMA que el propio despachador ya
 * calcula para sus otras compuertas (`actorIdentity` en `dispatcher.ts`): con sobre, `ctx.actor.id`
 * —el claim que la api ya verificó—; sin sobre, `ctx.caller` —el publicador directo, sea el
 * publicador de confianza en el canal exento o un servicio externo—.
 *
 *   - PARA LA REGLA 3 (exclusión, Task 3): se usa `ctx.actor?.id`, TOLERANDO `undefined` — en el
 *     canal exento no hay actor conocido y la exclusión simplemente no excluye a nadie (no se
 *     inventa un actor sintético para "tener a quién excluir").
 *   - PARA EL PAYLOAD (`resolveEventActor`, que exige un `actorId: string`): se usa
 *     `ctx.actor?.id ?? ctx.caller`, que siempre resuelve a un string real — es la misma
 *     identidad que el despachador ya trata como "quién publicó esto" en cualquier otro punto.
 */
export async function writeNotifications(
  notifications: NotificationDeclaration[],
  ctx: CommandContext
): Promise<void> {
  if (notifications.length === 0) {
    return;
  }

  // La regla 3 tolera `undefined`: sin actor, no excluye a nadie.
  const excludedActorId = ctx.actor?.id;
  // El payload necesita un `string`: cae al `caller` cuando no hay sobre, igual que el resto del
  // despachador ya trata esta identidad.
  const payloadActorId = ctx.actor?.id ?? ctx.caller;

  const rows: Array<{
    type: string;
    recipientUserId: string;
    recipientEmail: string;
    payload: Record<string, unknown>;
  }> = [];

  for (const declaration of notifications) {
    const recipients = await resolveFilteredRecipients(declaration, {
      actorId: excludedActorId,
      transaction: ctx.transaction,
    });

    if (recipients.length === 0) {
      continue;
    }

    // El payload se arma UNA VEZ por declaración y se comparte entre sus filas (Task 4): el
    // título, el proyecto y el link son los mismos para todos los destinatarios de un mismo
    // hecho, y recalcularlo por destinatario abriría la puerta a que dos filas del mismo hecho
    // difieran.
    const payload = await buildNotificationPayload(
      declaration,
      payloadActorId,
      ctx.actor,
      ctx.actorName,
      ctx.transaction
    );

    for (const recipient of recipients) {
      // `email` nunca es `null` acá: la regla 3 (Task 3) ya descartó todo candidato sin correo,
      // y `notification_outbox.recipient_email` es NOT NULL.
      rows.push({
        type: declaration.type,
        recipientUserId: recipient.userId,
        recipientEmail: recipient.email as string,
        payload: payload as unknown as Record<string, unknown>,
      });
    }
  }

  // Lista vacía tras el filtrado de TODAS las declaraciones (CA-9): no se llama a `bulkCreate` —
  // no hay nada que insertar, y es una llamada al ORM que no hace falta.
  if (rows.length === 0) {
    return;
  }

  // Un solo `bulkCreate`, con `ctx.transaction`: la escritura entera es atómica con el resto del
  // comando. `channel`, `status`, `attempts` y `nextAttemptAt` los llenan los DEFAULTS de la
  // columna (Database Context) — este escritor solo pasa lo que no tiene default.
  await NotificationOutbox.bulkCreate(rows, { transaction: ctx.transaction });
}

export default writeNotifications;
