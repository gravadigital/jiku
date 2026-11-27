import 'mocha';
import 'should';
import { renderNotification } from '../../src/notifications/templates';
import { NotificationPayload } from '../../src/notifications/types';

/**
 * Los renders de las cuatro plantillas (REQ-015/S-073, CA-8, CA-9): puros, sin base de datos.
 */

function basePayload(overrides: Partial<NotificationPayload> = {}): NotificationPayload {
  return {
    entity: { type: 'requirement', id: 412, projectId: 7 },
    actor: { id: 'u-1', name: 'Ana Pérez' },
    title: 'Login roto',
    project: { name: 'Portal' },
    link: 'https://opus.ejemplo.com/requirements/412',
    ...overrides,
  };
}

describe('notifications/templates — render (S-073)', () => {
  it('TS-26 · requirement.created: texto y HTML, en español, con tuteo', () => {
    const rendered = renderNotification('requirement.created', basePayload());

    rendered!.subject.should.equal('Nuevo requisito: Login roto');
    rendered!.text.should.containEql('Login roto');
    rendered!.text.should.containEql('412');
    rendered!.text.should.containEql('Portal');
    rendered!.text.should.containEql('Ana Pérez');
    rendered!.text.should.containEql('https://opus.ejemplo.com/requirements/412');
    rendered!.html.should.containEql('href="https://opus.ejemplo.com/requirements/412"');

    for (const field of [rendered!.text, rendered!.html]) {
      field.should.not.containEql('null');
      field.should.not.containEql('undefined');
      field.should.not.containEql('{{');
      field.should.not.containEql('}}');
    }
    rendered!.text.should.not.containEql('usted');
    rendered!.text.should.not.containEql('Ud.');
  });

  it('TS-27 · requirement.resolved: incluye el resolutionComment', () => {
    const rendered = renderNotification(
      'requirement.resolved',
      basePayload({ data: { resolutionComment: 'Se corrigió el token expirado' } })
    );

    rendered!.subject.should.equal('Requisito resuelto: Login roto');
    rendered!.text.should.containEql('Se corrigió el token expirado');
    rendered!.html.should.containEql('Se corrigió el token expirado');
  });

  it('TS-28 · requirement.comment.created: incluye el texto del comentario', () => {
    const rendered = renderNotification(
      'requirement.comment.created',
      basePayload({ data: { comment: 'Probé de nuevo y sigue fallando', commentId: 99 } })
    );

    rendered!.subject.should.equal('Nuevo comentario en: Login roto');
    rendered!.text.should.containEql('Probé de nuevo y sigue fallando');
    rendered!.html.should.containEql('Probé de nuevo y sigue fallando');
  });

  it('TS-29 · requirement.reopened', () => {
    const rendered = renderNotification('requirement.reopened', basePayload());

    rendered!.subject.should.equal('Requisito reabierto: Login roto');
    rendered!.text.should.not.be.empty();
    rendered!.html.should.not.be.empty();
    rendered!.text.should.not.containEql('undefined');
    rendered!.html.should.not.containEql('undefined');
  });

  it('TS-30 · project.name en null: mail legible, sin null visible', () => {
    const rendered = renderNotification(
      'requirement.created',
      basePayload({ project: { name: null } })
    );

    rendered!.text.should.not.containEql('null');
    rendered!.html.should.not.containEql('null');
    rendered!.text.should.containEql('Login roto');
    rendered!.text.should.containEql('https://opus.ejemplo.com/requirements/412');

    // Misma representación en text y html: se extrae lo que va entre "en " y el punto/coma
    // siguiente no es robusto en texto libre, así que se afirma sobre el token acordado.
    rendered!.text.should.containEql('sin proyecto');
    rendered!.html.should.containEql('sin proyecto');
  });

  it('TS-31 · actor.name que es un id, no un nombre humano', () => {
    const rendered = renderNotification(
      'requirement.created',
      basePayload({ actor: { id: 'u-1', name: '3233abc-de45-6789' } })
    );

    rendered!.text.should.containEql('3233abc-de45-6789');
    rendered!.html.should.containEql('3233abc-de45-6789');
    rendered!.text.should.not.containEql('undefined');
  });

  it('TS-32 · title vacío no deja {{title}} ni undefined colgado', () => {
    const rendered = renderNotification('requirement.created', basePayload({ title: '' }));

    rendered!.subject.should.not.containEql('{{');
    rendered!.subject.should.not.containEql('undefined');
    rendered!.text.should.not.be.empty();
    rendered!.html.should.not.be.empty();
  });

  it('TS-33 · el escapado de HTML: un título con <script> no se inyecta', () => {
    const rendered = renderNotification(
      'requirement.created',
      basePayload({ title: '<script>alert(1)</script>' })
    );

    rendered!.html.should.not.containEql('<script>');
    rendered!.text.should.containEql('<script>alert(1)</script>');
  });

  it('un type desconocido devuelve undefined, no lanza', () => {
    const rendered = renderNotification('requirement.archived', basePayload());
    (rendered === undefined).should.be.true();
  });
});

/**
 * El layout compartido (`templates/layout.ts`): el diseño de `templates-email-jiku/` aplicado a
 * las cuatro plantillas. Se afirma sobre lo ESTRUCTURAL y sobre la paleta —lo que rompería el
 * render o la identidad visual— y NO sobre el texto exacto de cada párrafo, que es redacción y
 * cambia sin que nada esté mal.
 */
describe('notifications/templates — el layout del diseño', () => {
  const TIPOS = [
    'requirement.created',
    'requirement.resolved',
    'requirement.reopened',
    'requirement.comment.created',
  ];

  it('las cuatro plantillas emiten un documento HTML completo, no un fragmento', () => {
    for (const tipo of TIPOS) {
      const rendered = renderNotification(tipo, basePayload({
        data: { resolutionComment: 'listo', comment: 'listo', commentId: 99 },
      }));

      rendered!.html.should.startWith('<!DOCTYPE html>');
      rendered!.html.should.containEql('<html lang="es">');
      rendered!.html.should.containEql('</html>');
      // El `meta viewport` es lo que hace que el mail no salga diminuto en un teléfono.
      rendered!.html.should.containEql('name="viewport"');
    }
  });

  it('el encabezado lleva el wordmark Jiku en texto, sin <img> ni logo remoto', () => {
    const rendered = renderNotification('requirement.created', basePayload());

    rendered!.html.should.containEql('>\n                  Jiku\n');
    // La decisión de v2: ninguna imagen remota. Un `<img>` roto en el encabezado de cada mail es
    // peor que un wordmark tipográfico, y muchos clientes bloquean imágenes por defecto.
    rendered!.html.should.not.containEql('<img');
  });

  it('el botón principal apunta al link del payload, una sola vez y como href', () => {
    const rendered = renderNotification('requirement.created', basePayload());

    rendered!.html.should.containEql('href="https://opus.ejemplo.com/requirements/412"');
    rendered!.html.should.containEql('Ver el requisito');
  });

  it('usa la paleta del diseño y tablas, que es lo que sobrevive a Outlook y Gmail', () => {
    const rendered = renderNotification('requirement.created', basePayload());

    // Los tres colores que definen la identidad del mail.
    rendered!.html.should.containEql('#0B1934');
    rendered!.html.should.containEql('#61CCB9');
    rendered!.html.should.containEql('#12897A');
    // Tablas con `role="presentation"`: el patrón de correo, y lo que evita que un lector de
    // pantalla anuncie la maquetación como si fuera una tabla de datos.
    rendered!.html.should.containEql('role="presentation"');
  });

  it('el preheader repite el primer párrafo, que es lo que se lee junto al asunto', () => {
    const rendered = renderNotification('requirement.created', basePayload());

    // El bloque oculto existe y NO quedó con el texto de ejemplo del diseño original.
    rendered!.html.should.containEql('display:none');
    rendered!.html.should.not.containEql('Resumen de una línea');
  });

  it('el pie no promete nada que el producto no tenga: sin baja ni preferencias', () => {
    const rendered = renderNotification('requirement.created', basePayload());

    rendered!.html.should.containEql('Correo automático enviado por Jiku');
    // El diseño v1 traía estos tres, y los tres llevarían a un 404 hoy.
    rendered!.html.should.not.containEql('Darme de baja');
    rendered!.html.should.not.containEql('Preferencias de correo');
    rendered!.html.should.not.containEql('ejemplo.com/baja');
  });

  it('el comentario y la resolución van en el bloque de cita, escapados', () => {
    const comentario = renderNotification(
      'requirement.comment.created',
      basePayload({ data: { comment: 'No anda <b>nada</b>', commentId: 99 } })
    );
    // El bloque de cita se reconoce por su barra lateral.
    comentario!.html.should.containEql('border-left:3px solid #61CCB9');
    // Escapado incluso dentro de la cita: es el campo más expuesto a texto de usuario.
    comentario!.html.should.containEql('&lt;b&gt;nada&lt;/b&gt;');
    comentario!.html.should.not.containEql('<b>nada</b>');

    const resuelto = renderNotification(
      'requirement.resolved',
      basePayload({ data: { resolutionComment: 'Se corrigió' } })
    );
    resuelto!.html.should.containEql('border-left:3px solid #61CCB9');
    resuelto!.html.should.containEql('Se corrigió');
  });

  it('reopened es la única sin bloque de cita: no tiene data propio', () => {
    const rendered = renderNotification('requirement.reopened', basePayload());

    rendered!.html.should.not.containEql('border-left:3px solid #61CCB9');
  });

  it('el texto plano sigue siendo texto plano: sin etiquetas ni entidades HTML', () => {
    for (const tipo of TIPOS) {
      const rendered = renderNotification(tipo, basePayload({
        data: { resolutionComment: 'listo', comment: 'listo', commentId: 99 },
      }));

      rendered!.text.should.not.containEql('<table');
      rendered!.text.should.not.containEql('<p>');
      rendered!.text.should.not.containEql('&amp;');
      rendered!.text.should.not.containEql('DOCTYPE');
      // Y sigue llevando el link crudo, que es lo único accionable en la versión de texto.
      rendered!.text.should.containEql('https://opus.ejemplo.com/requirements/412');
    }
  });

  it('un título con comillas no rompe el atributo href ni el documento', () => {
    const rendered = renderNotification(
      'requirement.created',
      basePayload({ title: 'Se rompió el "login" & el alta' })
    );

    rendered!.html.should.containEql('&quot;login&quot;');
    rendered!.html.should.containEql('&amp;');
    // El href del botón queda intacto: el título no se filtra al atributo.
    rendered!.html.should.containEql('href="https://opus.ejemplo.com/requirements/412"');
  });
});
