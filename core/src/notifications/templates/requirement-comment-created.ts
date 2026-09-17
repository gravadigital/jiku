import { NotificationPayload } from '../types';
import { escapeHtml, textoODefecto } from './format';
import { RenderedMail } from './types';

const SIN_PROYECTO = 'sin proyecto';

/**
 * Plantilla de `requirement.comment.created` (REQ-015/S-073): un comentario nuevo en un
 * requisito. Incluye `payload.data.comment`, el texto del comentario.
 */
export function renderRequirementCommentCreated(payload: NotificationPayload): RenderedMail {
  const titulo = textoODefecto(payload.title, 'un requisito sin título');
  const proyecto = textoODefecto(payload.project.name, SIN_PROYECTO);
  const actor = textoODefecto(payload.actor.name, 'Alguien');
  const comentarioCrudo = payload.data?.comment;
  const comentario = textoODefecto(
    typeof comentarioCrudo === 'string' ? comentarioCrudo : undefined,
    'sin contenido'
  );

  const text =
    'Hola,\n\n' +
    `${actor} comentó en el requisito "${titulo}" de ${proyecto}:\n\n` +
    `"${comentario}"\n\n` +
    `Podés verlo acá: ${payload.link}\n\n` +
    'Saludos.';

  const html =
    '<p>Hola,</p>' +
    `<p>${escapeHtml(actor)} comentó en el requisito "${escapeHtml(titulo)}" de ` +
    `${escapeHtml(proyecto)}:</p>` +
    `<p>"${escapeHtml(comentario)}"</p>` +
    `<p>Podés verlo acá: <a href="${escapeHtml(payload.link)}">${escapeHtml(payload.link)}</a></p>` +
    '<p>Saludos.</p>';

  return { text, html };
}

export default renderRequirementCommentCreated;
