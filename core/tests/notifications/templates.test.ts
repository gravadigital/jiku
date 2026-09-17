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
