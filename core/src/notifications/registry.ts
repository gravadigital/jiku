import { User } from '@jiku/models';
import { NotificationDeclaration } from '@jiku/nats-protocol';
import { resolveRecipients as resolveRequirementSubscriptors } from '../events/domain/requirement-snapshot';
import { NotificationCandidate, NotificationContext, NotificationTypeEntry } from './types';

/**
 * El registro de tipos de notificación (D-8, D-9 · CA-1, CA-2), con el precedente doble de
 * `commands/index.ts` (un mapa único, agregar es sumar una entrada) y `EVENT_TYPES` (un catálogo
 * de forma fija por tipo, no un `switch`).
 *
 * CADA ENTRADA RESUELVE SUS PROPIOS DESTINATARIOS. La tentación a resistir, y es fuerte: los
 * cuatro tipos de hoy comparten la misma regla ("suscriptores del requisito menos el actor"), así
 * que parece obvio escribirla una vez en el escritor y despachar por un `switch`. NO LO HAGAS: el
 * caso D del REQ ya rompe esa igualdad — la suscripción posterior usa el MISMO tipo
 * (`requirement.created`) con la resolución "exactamente esta persona" (`recipientOverride`). Si
 * la resolución fuera un `switch` global, ese `switch` crecería con cada tipo nuevo, y un tipo
 * futuro como "tarea asignada" —que notifica al RESPONSABLE, donde además `personId != userId`—
 * terminaría siendo una rama más de una función que nadie puede leer de un vistazo.
 *
 * `subject` Y `template` VAN DECLARADOS AUNQUE ESTA STORY NO LOS USE: los consume el proceso de
 * envío de S-073. Declararlos ahora es lo que hace que agregar un tipo sea sumar una entrada acá
 * y en ningún otro lado — dejarlos para S-073 obligaría a esa story a reabrir este mismo archivo,
 * partiendo la propiedad del catálogo en dos.
 */

/**
 * La resolución de "suscriptores del requisito, con override" — la comparten los cuatro tipos de
 * hoy (`requirement.created`, `.resolved`, `.reopened`, `.comment.created`).
 *
 * NO ES UN SEGUNDO NOMBRE PARA UN `switch`: es una función que CADA ENTRADA del registro asigna
 * a su propio `resolveRecipients`, exactamente igual que si cada tipo escribiera la suya. Que las
 * cuatro de hoy compartan el cuerpo es un HECHO DE HOY, no una regla del mecanismo — el día que
 * una diverja (como ya lo hace la resolución de "exactamente el nuevo suscriptor", más abajo),
 * se le asigna la suya sin tocar esta función ni las otras tres entradas.
 *
 * RESPETA `recipientOverride` (CA-14, D-9): si la declaración trae un destinatario explícito, la
 * resolución devuelve exactamente ese candidato y NO llama a `resolveRecipients()` —ni ninguna
 * otra consulta de suscriptores—. El resultado es solo un CANDIDATO: las reglas 3 y 4 (Task 3) se
 * aplican igual sobre él, así que un override que sea el propio actor, o que no tenga permiso de
 * proyecto, sigue sin encolar nada.
 *
 * `email` DEL OVERRIDE SALE DE `users`, no del payload: la declaración solo trae el `userId`, y
 * un destinatario que no resuelve a ninguna fila (TS-31) se descarta acá devolviendo `[]`, sin
 * hacer fallar el resto del lote.
 */
async function resolveRequirementRecipients(
  declaration: NotificationDeclaration,
  ctx: NotificationContext
): Promise<NotificationCandidate[]> {
  if (declaration.recipientOverride !== undefined) {
    // `RequirementSubscriptor` NI SIQUIERA SE CONSULTA para este camino, que es justamente lo
    // que CA-14 exige ("sin aplicar la regla... sobre la lista completa de suscriptores"). Se
    // reusa el mismo modelo `User` que ya resuelve `resolveRecipients()`, con la misma forma de
    // candidato (`{ userId, email }`).
    const user = await User.findByPk(declaration.recipientOverride, { transaction: ctx.transaction });
    // Sin fila (TS-31): se descarta en silencio, igual que `resolveRecipients()` descarta un
    // `userId` sin `users` — un destinatario inexistente no hace fallar el resto del lote.
    return user ? [{ userId: user.id, email: user.email }] : [];
  }

  // La regla 2 de hoy para los cuatro tipos de requisito: reusar `resolveRecipients()` TAL CUAL
  // (CA-6), sin una segunda consulta equivalente. `responsiblePersonIds` no le sirve al filtrado
  // de notificaciones (los destinatarios son `userId` de Zitadel, no `personId`), así que se le
  // pasa `[]` y se usa solo `.subscriptors` — sin tocar la firma de `resolveRecipients`, que
  // comparten seis comandos de eventos.
  const { subscriptors } = await resolveRequirementSubscriptors(
    declaration.entity.id,
    [],
    ctx.transaction
  );
  return subscriptors.map((subscriptor) => ({ userId: subscriptor.userId, email: subscriptor.email }));
}

/**
 * El registro: un `Record` de clave a entrada, no una lista — resolver un tipo es una búsqueda
 * directa, y `Object.keys` alcanza para cualquier test estructural que necesite enumerarlos.
 */
const NOTIFICATION_TYPES: Record<string, NotificationTypeEntry> = {
  'requirement.created': {
    subject: 'Nuevo requisito: {{title}}',
    template: 'requirement-created',
    resolveRecipients: resolveRequirementRecipients,
  },
  'requirement.resolved': {
    subject: 'Requisito resuelto: {{title}}',
    template: 'requirement-resolved',
    resolveRecipients: resolveRequirementRecipients,
  },
  'requirement.reopened': {
    subject: 'Requisito reabierto: {{title}}',
    template: 'requirement-reopened',
    resolveRecipients: resolveRequirementRecipients,
  },
  'requirement.comment.created': {
    subject: 'Nuevo comentario en: {{title}}',
    template: 'requirement-comment-created',
    resolveRecipients: resolveRequirementRecipients,
  },
};

/**
 * Resuelve los candidatos a destinatario de una declaración, según SU tipo.
 *
 * UN TIPO DESCONOCIDO LANZA (CA-1, Task 2 AC-6): no devuelve lista vacía ni ignora la
 * declaración en silencio. Un `type` mal escrito es un bug del comando que lo declaró, y tiene
 * que romper el despacho —con el rollback que ADR-003 ya le da a cualquier fallo del escritor—,
 * nunca perder el mail en silencio.
 */
export async function resolveNotificationRecipients(
  declaration: NotificationDeclaration,
  ctx: NotificationContext
): Promise<NotificationCandidate[]> {
  const entry = NOTIFICATION_TYPES[declaration.type];
  if (!entry) {
    throw new Error(`Tipo de notificación desconocido: ${declaration.type}`);
  }
  return entry.resolveRecipients(declaration, ctx);
}

/** La entrada completa de un tipo (asunto, plantilla), para quien la necesite (S-073). */
export function getNotificationType(type: string): NotificationTypeEntry | undefined {
  return NOTIFICATION_TYPES[type];
}

export default resolveNotificationRecipients;
