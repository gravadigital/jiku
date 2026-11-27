import { NotificationPayload } from '../types';
import { textoODefecto } from './format';
import { renderLayout } from './layout';
import { RenderedMail } from './types';

const SIN_PROYECTO = 'sin proyecto';

/**
 * Plantilla de `requirement.resolved` (REQ-015/S-073): un requisito se marcó como resuelto.
 * Incluye `payload.data.resolutionComment`, el comentario de resolución.
 *
 * El comentario de resolución va en el BLOQUE DE CITA del layout, igual que el comentario de
 * `requirement.comment.created`: los dos son texto escrito por una persona, y mostrarlos con la
 * misma forma es lo que hace que el mail se lea igual en los dos casos.
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

  const html = renderLayout({
    etiqueta: 'Requisito resuelto',
    titulo,
    parrafos: [`${actor} resolvió este requisito en ${proyecto}.`],
    cita: comentario,
    textoBoton: 'Ver el requisito',
    link: payload.link,
  });

  return { text, html };
}

export default renderRequirementResolved;
