import { NotificationPayload } from '../types';
import { textoODefecto } from './format';
import { renderLayout } from './layout';
import { RenderedMail } from './types';

const SIN_PROYECTO = 'sin proyecto';

/**
 * Plantilla de `requirement.comment.created` (REQ-015/S-073): un comentario nuevo en un
 * requisito. Incluye `payload.data.comment`, el texto del comentario.
 *
 * EL COMENTARIO VA EN EL BLOQUE DE CITA del layout, no como un párrafo más: es texto de OTRA
 * persona y conviene que se lea como tal. El layout lo escapa igual que el resto (CA-8) — un
 * comentario es exactamente el campo por el que un usuario podría intentar inyectar HTML.
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

  const html = renderLayout({
    etiqueta: 'Nuevo comentario',
    titulo,
    parrafos: [`${actor} comentó en este requisito de ${proyecto}.`],
    cita: comentario,
    textoBoton: 'Ver el comentario',
    link: payload.link,
  });

  return { text, html };
}

export default renderRequirementCommentCreated;
