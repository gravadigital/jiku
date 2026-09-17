import { NotificationPayload } from '../types';
import { escapeHtml, textoODefecto } from './format';
import { RenderedMail } from './types';

const SIN_PROYECTO = 'sin proyecto';

/**
 * Plantilla de `requirement-created` (REQ-015/S-073): un requisito nuevo se creó y el
 * destinatario es uno de sus suscriptores.
 *
 * Español, tuteo (NFR-U07: el mail es superficie nueva, no hereda el tuteo mezclado del resto).
 */
export function renderRequirementCreated(payload: NotificationPayload): RenderedMail {
  const titulo = textoODefecto(payload.title, 'un requisito sin título');
  const proyecto = textoODefecto(payload.project.name, SIN_PROYECTO);
  const actor = textoODefecto(payload.actor.name, 'Alguien');

  const text =
    'Hola,\n\n' +
    `${actor} creó un nuevo requisito en ${proyecto}: "${titulo}".\n\n` +
    `Podés verlo acá: ${payload.link}\n\n` +
    'Saludos.';

  const html =
    '<p>Hola,</p>' +
    `<p>${escapeHtml(actor)} creó un nuevo requisito en ${escapeHtml(proyecto)}: ` +
    `"${escapeHtml(titulo)}".</p>` +
    `<p>Podés verlo acá: <a href="${escapeHtml(payload.link)}">${escapeHtml(payload.link)}</a></p>` +
    '<p>Saludos.</p>';

  return { text, html };
}

export default renderRequirementCreated;
