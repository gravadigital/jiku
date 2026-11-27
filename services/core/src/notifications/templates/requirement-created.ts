import { NotificationPayload } from '../types';
import { textoODefecto } from './format';
import { renderLayout } from './layout';
import { RenderedMail } from './types';

const SIN_PROYECTO = 'sin proyecto';

/**
 * Plantilla de `requirement-created` (REQ-015/S-073): un requisito nuevo se creó y el
 * destinatario es uno de sus suscriptores.
 *
 * Español, tuteo (NFR-U07: el mail es superficie nueva, no hereda el tuteo mezclado del resto).
 *
 * EL `text` Y EL `html` DICEN LO MISMO CON DISTINTA FORMA, y esa equivalencia es parte del
 * contrato multipart (CA-8): quien lea la versión de texto no puede quedarse sin un dato que la
 * versión HTML sí trae. El `html` lo arma `renderLayout` (ver `layout.ts`), que además ESCAPA
 * todo lo que recibe — por eso acá no se llama a `escapeHtml`, y llamarlo sería un doble escapado
 * que le mostraría `&amp;` al destinatario.
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

  const html = renderLayout({
    etiqueta: 'Nuevo requisito',
    titulo,
    parrafos: [
      `${actor} creó un nuevo requisito en ${proyecto}.`,
      'Podés abrirlo desde el botón de abajo para ver el detalle completo.',
    ],
    textoBoton: 'Ver el requisito',
    link: payload.link,
  });

  return { text, html };
}

export default renderRequirementCreated;
