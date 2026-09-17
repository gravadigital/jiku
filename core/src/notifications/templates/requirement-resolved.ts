import { NotificationPayload } from '../types';
import { escapeHtml, textoODefecto } from './format';
import { RenderedMail } from './types';

const SIN_PROYECTO = 'sin proyecto';

/**
 * Plantilla de `requirement.resolved` (REQ-015/S-073): un requisito se marcó como resuelto.
 * Incluye `payload.data.resolutionComment`, el comentario de resolución.
 */
export function renderRequirementResolved(payload: NotificationPayload): RenderedMail {
  const titulo = textoODefecto(payload.title, 'un requisito sin título');
  const proyecto = textoODefecto(payload.project.name, SIN_PROYECTO);
  const actor = textoODefecto(payload.actor.name, 'Alguien');
  // El `data` es específico del tipo (NotificationPayload.data), sin tipar más allá de
  // `Record<string, unknown>` en el contrato — se lee defensivamente acá, en el borde donde el
  // dato específico se consume.
  const comentarioCrudo = payload.data?.resolutionComment;
  const comentario = textoODefecto(
    typeof comentarioCrudo === 'string' ? comentarioCrudo : undefined,
    'sin comentario de resolución'
  );

  const text =
    'Hola,\n\n' +
    `${actor} resolvió el requisito "${titulo}" en ${proyecto}.\n\n` +
    `Comentario de resolución: ${comentario}\n\n` +
    `Podés verlo acá: ${payload.link}\n\n` +
    'Saludos.';

  const html =
    '<p>Hola,</p>' +
    `<p>${escapeHtml(actor)} resolvió el requisito "${escapeHtml(titulo)}" en ` +
    `${escapeHtml(proyecto)}.</p>` +
    `<p>Comentario de resolución: ${escapeHtml(comentario)}</p>` +
    `<p>Podés verlo acá: <a href="${escapeHtml(payload.link)}">${escapeHtml(payload.link)}</a></p>` +
    '<p>Saludos.</p>';

  return { text, html };
}

export default renderRequirementResolved;
