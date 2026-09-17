import { NotificationPayload } from '../types';
import { escapeHtml, textoODefecto } from './format';
import { RenderedMail } from './types';

const SIN_PROYECTO = 'sin proyecto';

/**
 * Plantilla de `requirement.reopened` (REQ-015/S-073): un requisito que estaba resuelto se
 * reabrió. Sin `data` propio.
 */
export function renderRequirementReopened(payload: NotificationPayload): RenderedMail {
  const titulo = textoODefecto(payload.title, 'un requisito sin título');
  const proyecto = textoODefecto(payload.project.name, SIN_PROYECTO);
  const actor = textoODefecto(payload.actor.name, 'Alguien');

  const text =
    'Hola,\n\n' +
    `${actor} reabrió el requisito "${titulo}" en ${proyecto}.\n\n` +
    `Podés verlo acá: ${payload.link}\n\n` +
    'Saludos.';

  const html =
    '<p>Hola,</p>' +
    `<p>${escapeHtml(actor)} reabrió el requisito "${escapeHtml(titulo)}" en ` +
    `${escapeHtml(proyecto)}.</p>` +
    `<p>Podés verlo acá: <a href="${escapeHtml(payload.link)}">${escapeHtml(payload.link)}</a></p>` +
    '<p>Saludos.</p>';

  return { text, html };
}

export default renderRequirementReopened;
