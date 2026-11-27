import { NotificationPayload } from '../types';
import { textoODefecto } from './format';
import { renderLayout } from './layout';
import { RenderedMail } from './types';

const SIN_PROYECTO = 'sin proyecto';

/**
 * Plantilla de `requirement.reopened` (REQ-015/S-073): un requisito que estaba resuelto se
 * reabrió. Sin `data` propio, así que es la única de las cuatro sin bloque de cita.
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

  const html = renderLayout({
    etiqueta: 'Requisito reabierto',
    titulo,
    parrafos: [
      `${actor} reabrió este requisito en ${proyecto}.`,
      'Volvió a estar activo, así que puede necesitar tu atención de nuevo.',
    ],
    textoBoton: 'Ver el requisito',
    link: payload.link,
  });

  return { text, html };
}

export default renderRequirementReopened;
