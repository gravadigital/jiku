import { getNotificationType } from '../registry';
import { NotificationPayload } from '../types';
import { interpolar } from './format';
import { renderRequirementCommentCreated } from './requirement-comment-created';
import { renderRequirementCreated } from './requirement-created';
import { renderRequirementReopened } from './requirement-reopened';
import { renderRequirementResolved } from './requirement-resolved';
import { RenderedMail, RenderedNotification } from './types';

/**
 * El índice de plantillas (REQ-015/S-073): mapea el identificador `template` del registro
 * (`core/src/notifications/registry.ts`) a la función de render concreta, y expone la función
 * pública `renderNotification` que el proceso de envío (`dispatch/`) consume.
 *
 * ESTE ES EL ÚNICO ARCHIVO QUE CONOCE LOS CUATRO IDENTIFICADORES DE PLANTILLA. El proceso de
 * envío (CA-10) nunca importa `./requirement-created` ni ninguna otra plantilla concreta: pasa
 * el `type` opaco a `renderNotification`, y este módulo hace la resolución.
 */
const TEMPLATES: Record<string, (payload: NotificationPayload) => RenderedMail> = {
  'requirement-created': renderRequirementCreated,
  'requirement-resolved': renderRequirementResolved,
  'requirement-reopened': renderRequirementReopened,
  'requirement-comment-created': renderRequirementCommentCreated,
};

/**
 * Renderiza asunto + cuerpo (texto y HTML) de una notificación, dado su `type` (la clave del
 * registro) y su payload congelado.
 *
 * El `subject` del registro es una PLANTILLA (`'Nuevo requisito: {{title}}'`), no un literal: se
 * interpola acá contra el `title` del payload — el único marcador vigente.
 *
 * `undefined` cuando el `type` no está en el registro (una fila cuyo tipo se quitó del código
 * entre el encolado y el envío): el proceso de envío (Task 5) trata esto como un fallo de envío
 * normal, no como un crash del ciclo — la decisión está en el Story Plan, Reusable Code.
 */
export function renderNotification(
  type: string,
  payload: NotificationPayload
): RenderedNotification | undefined {
  const entry = getNotificationType(type);
  if (!entry) {
    return undefined;
  }

  const body = TEMPLATES[entry.template];
  if (!body) {
    // Un `template` declarado en el registro sin plantilla correspondiente es un bug de
    // despliegue (un tipo nuevo que olvidó su plantilla), no un dato de runtime: se trata igual
    // que un tipo desconocido, dejando que el proceso de envío lo cuente como fallo.
    return undefined;
  }

  const subject = interpolar(entry.subject, { title: payload.title });
  const { text, html } = body(payload);

  return { subject, text, html };
}

export default renderNotification;
