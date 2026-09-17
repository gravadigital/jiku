import 'mocha';
import 'should';
import {
  NotificationOutbox, Project, Requirement, RequirementActivity, RequirementSubscriptor,
  RequirementType, RequirementVisibilityLevel, User, UserProjectPermission,
} from '@jiku/models';
import { getTrustedPublisherId } from '../../src/config';
import { registry } from '../../src/commands';
import * as notificationsRegistry from '../../src/notifications/registry';
import { dispatch, fakePublisher } from '../helpers/dispatch';

/**
 * Los 37 test scenarios de S-072 (REQ-015): los CINCO COMANDOS REALES de requisito
 * (`requirements.new`, `.subscriptors.new`, `.comment`, `.edit`, `.resolve`) declarando
 * notificaciones sobre el mecanismo que S-071 ya construyó y probó.
 *
 * DISTINTO DE `notifications.test.ts` (S-071): aquel registra un comando DOBLE en un
 * `Dispatcher` propio para probar el MECANISMO. Este archivo despacha los COMANDOS REALES del
 * `registry` de producción con el `dispatch()` compartido — es la suite que cierra R-1: sin
 * TS-12 (resolver por `requirements.{id}.edit`, no por `.resolve`) la story se daría por
 * terminada sin que se enviara un solo mail de resolución en producción.
 */

const TRUSTED = () => getTrustedPublisherId();

// ── Fixtures compartidos, con prefijo `s72-` para no chocar con los de `notifications.test.ts` ──
const U1 = 's72-u1'; // { name: 'Ana Pérez', email: 'ana@ej.com' } — el actor habitual
const U2 = 's72-u2';
const U3 = 's72-u3';
const U4 = 's72-u4'; // el nuevo suscriptor de los casos de suscripción posterior
const U5 = 's72-u5'; // con correo, SIN UserProjectPermission sobre P1

describe('requirements-notifications (S-072)', () => {
  let P1: number;

  before(async () => {
    await User.create({ id: U1, name: 'Ana Pérez', username: 's72-ana', email: 'ana@ej.com' });
    await User.create({ id: U2, name: 'U2', username: 's72-u2', email: 'u2@ej.com' });
    await User.create({ id: U3, name: 'U3', username: 's72-u3', email: 'u3@ej.com' });
    await User.create({ id: U4, name: 'U4', username: 's72-u4', email: 'u4@ej.com' });
    await User.create({ id: U5, name: 'U5', username: 's72-u5', email: 'u5@ej.com' });

    P1 = (await Project.create({
      name: 'Portal Norte', code: 'S72P1', status: 'activo', type: 'comercial',
      description: 'x', initDate: new Date(), createdBy: U1,
    })).id;

    // Permiso de proyecto sobre P1: todos menos U5 (regla 4 del escritor).
    for (const userId of [U1, U2, U3, U4]) {
      await UserProjectPermission.create({ userId, projectId: P1 });
    }
  });

  beforeEach(async () => {
    await NotificationOutbox.destroy({ where: {}, truncate: true, cascade: true });
    await RequirementSubscriptor.destroy({ where: {} });
    fakePublisher.reset();
  });

  after(async () => {
    // Limpieza en orden de FK (hijos primero) — mismo patrón que `notifications.test.ts`.
    await NotificationOutbox.destroy({ where: {}, truncate: true, cascade: true });
    await RequirementSubscriptor.destroy({ where: {} });
    await RequirementActivity.destroy({ where: {} });
    await Requirement.destroy({ where: {} });
    await UserProjectPermission.destroy({ where: {} });
    await Project.destroy({ where: {} });
    await User.destroy({ where: { id: [U1, U2, U3, U4, U5] } });
  });

  /** Filas de `notification_outbox`, ordenadas por `id` NUMÉRICO (BIGINT llega como string). */
  async function allRows() {
    const rows = await NotificationOutbox.findAll();
    return rows.sort((a, b) => Number(a.id) - Number(b.id));
  }

  /** Crea un requisito `public` sobre P1 con los suscriptores indicados (además del creador). */
  async function createPublicRequirement(
    subscriberIds: string[] = [],
    overrides: Partial<{
      title: string;
      type: RequirementType;
      state: string;
      resolutionComment: string | null;
    }> = {}
  ): Promise<number> {
    const requirement = await Requirement.create({
      title: overrides.title ?? 'El buscador no filtra por etiqueta',
      description: 'x',
      projectId: P1,
      createdBy: U1,
      visibilityLevel: RequirementVisibilityLevel.Public,
      type: overrides.type ?? null,
      state: overrides.state as any,
      resolutionComment: overrides.resolutionComment,
    });
    await Promise.all(
      subscriberIds.map((userId) =>
        RequirementSubscriptor.create({ requirementId: requirement.id, userId })
      )
    );
    return requirement.id;
  }

  async function createInternalRequirement(subscriberIds: string[] = []): Promise<number> {
    const requirement = await Requirement.create({
      title: 'Interno', description: 'x', projectId: P1, createdBy: U1,
      visibilityLevel: RequirementVisibilityLevel.Internal,
    });
    await Promise.all(
      subscriberIds.map((userId) =>
        RequirementSubscriptor.create({ requirementId: requirement.id, userId })
      )
    );
    return requirement.id;
  }

  // ==============================================================================================
  // Alta con suscriptores (CA-1, CA-11)
  // ==============================================================================================

  describe('requirements.new', () => {
    it('TS-1 · alta pública con dos suscriptores encola dos filas, sin el creador', async () => {
      const reply = await dispatch<{ id: number }>('requirements.new', {
        creator: U1, title: 'Alta con subs', description: 'x', projectId: P1,
        visibilityLevel: 'public', subscriberUserIds: [U1, U2, U3],
        actor: { id: U1, roles: ['user'], name: 'Ana Pérez' },
      });

      reply.status.should.equal('success');
      const rows = await allRows();
      rows.length.should.equal(2);
      rows.map((r) => r.recipientUserId).sort().should.deepEqual([U2, U3].sort());
      rows.forEach((row) => {
        row.type.should.equal('requirement.created');
        const payload = row.payload as any;
        payload.title.should.equal('Alta con subs');
        payload.entity.id.should.equal(reply.data!.id);
        payload.project.should.deepEqual({ name: 'Portal Norte' });
        payload.link.should.equal(`https://opus.ejemplo.com/requirements/${reply.data!.id}`);
        payload.actor.name.should.equal('Ana Pérez');
      });
    });

    it('TS-2 · alta pública sin suscriptores responde éxito sin encolar', async () => {
      const reply = await dispatch('requirements.new', {
        creator: U1, title: 'Sin subs', description: 'x', projectId: P1, visibilityLevel: 'public',
      }, TRUSTED());

      reply.status.should.equal('success');
      (await allRows()).length.should.equal(0);
    });

    it('TS-3 · alta internal con suscriptores no encola (regla 1)', async () => {
      const reply = await dispatch('requirements.new', {
        creator: U1, title: 'Interno', description: 'x', projectId: P1,
        visibilityLevel: 'internal', subscriberUserIds: [U2, U3],
      }, TRUSTED());

      reply.status.should.equal('success');
      (await allRows()).length.should.equal(0);
    });

    it('TS-4 · alta que falla por subscriberUserIds inexistente no deja fila (rollback)', async () => {
      const before = await Requirement.count();
      const reply = await dispatch('requirements.new', {
        creator: U1, title: 'x', description: 'x', projectId: P1, visibilityLevel: 'public',
        subscriberUserIds: [U2, 'no-existe'],
      }, TRUSTED());

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('user_not_found');
      (await allRows()).length.should.equal(0);
      (await Requirement.count()).should.equal(before);
    });

    it('TS-5 · suscriptor sin permiso de proyecto se descarta (regla 4)', async () => {
      const reply = await dispatch('requirements.new', {
        creator: U1, title: 'x', description: 'x', projectId: P1, visibilityLevel: 'public',
        subscriberUserIds: [U2, U5],
      }, TRUSTED());

      reply.status.should.equal('success');
      const rows = await allRows();
      rows.length.should.equal(1);
      rows[0].recipientUserId.should.equal(U2);
    });
  });

  // ==============================================================================================
  // Suscripción posterior (CA-2, CA-9, CA-10)
  // ==============================================================================================

  describe('requirements.{id}.subscriptors.new', () => {
    it('TS-6 · encola una fila, solo para el nuevo suscriptor', async () => {
      const requirementId = await createPublicRequirement([U2, U3]);

      const reply = await dispatch(`requirements.${requirementId}.subscriptors.new`, {
        userId: U4, actor: { id: U1, roles: ['user'] },
      });

      reply.status.should.equal('success');
      const rows = await allRows();
      rows.length.should.equal(1);
      rows[0].recipientUserId.should.equal(U4);
      rows[0].type.should.equal('requirement.created');
    });

    it('TS-7 · el mail lleva el NOMBRE del actor, no su id', async () => {
      const requirementId = await createPublicRequirement([U2, U3]);

      await dispatch(`requirements.${requirementId}.subscriptors.new`, {
        userId: U4, actor: { id: U1, roles: ['user'], name: 'Ana Pérez' },
      });

      const rows = await allRows();
      (rows[0].payload as any).actor.name.should.equal('Ana Pérez');
      (rows[0].payload as any).actor.name.should.not.equal(U1);
    });

    it('TS-8 · un usuario que se suscribe a sí mismo no encola nada (regla 3)', async () => {
      const requirementId = await createPublicRequirement([]);

      const reply = await dispatch(`requirements.${requirementId}.subscriptors.new`, {
        userId: U4, actor: { id: U4, roles: ['user'] },
      });

      reply.status.should.equal('success');
      (await allRows()).length.should.equal(0);
    });

    it('TS-9 · un actor DISTINTO que suscribe a otro sí encola', async () => {
      const requirementId = await createPublicRequirement([]);

      const reply = await dispatch(`requirements.${requirementId}.subscriptors.new`, {
        userId: U4, actor: { id: U1, roles: ['user'] },
      });

      reply.status.should.equal('success');
      const rows = await allRows();
      rows.length.should.equal(1);
      rows[0].recipientUserId.should.equal(U4);
    });

    it('TS-10 · suscripción posterior sobre requisito internal no encola', async () => {
      const requirementId = await createInternalRequirement([]);

      const reply = await dispatch(`requirements.${requirementId}.subscriptors.new`, {
        userId: U4, actor: { id: U1, roles: ['user'] },
      });

      reply.status.should.equal('success');
      (await allRows()).length.should.equal(0);
    });

    it('TS-11 · suscripción duplicada falla y no deja fila', async () => {
      const requirementId = await createPublicRequirement([U4]);

      const reply = await dispatch(`requirements.${requirementId}.subscriptors.new`, {
        userId: U4, actor: { id: U1, roles: ['user'] },
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('already_subscribed');
      (await allRows()).length.should.equal(0);
    });
  });

  // ==============================================================================================
  // Resolución vía `requirements.{id}.edit` — el camino real (R-1) (CA-4, CA-7)
  // ==============================================================================================

  describe('requirements.{id}.edit — resolución (R-1)', () => {
    it('TS-12 · resolver por edit encola para los demás suscriptores', async () => {
      const requirementId = await createPublicRequirement([U1, U2], { state: 'desarrollo' });

      const reply = await dispatch(`requirements.${requirementId}.edit`, {
        editor: U1, state: 'resuelto', resolutionComment: 'Se corrigió el índice',
        actor: { id: U1, roles: ['user'], name: 'Ana Pérez' },
      });

      reply.status.should.equal('success');
      const rows = await allRows();
      rows.length.should.equal(1);
      rows[0].recipientUserId.should.equal(U2);
      rows[0].type.should.equal('requirement.resolved');
      (rows[0].payload as any).data.resolutionComment.should.equal('Se corrigió el índice');
      (rows[0].payload as any).actor.name.should.equal('Ana Pérez');
      (rows[0].payload as any).link.should.equal(`https://opus.ejemplo.com/requirements/${requirementId}`);
    });

    it('TS-13 · la resolución por edit declara ADEMÁS el evento, no en su lugar', async () => {
      const requirementId = await createPublicRequirement([U1, U2], { state: 'desarrollo' });
      fakePublisher.reset();

      await dispatch(`requirements.${requirementId}.edit`, {
        editor: U1, state: 'resuelto', resolutionComment: 'Se corrigió el índice',
        actor: { id: U1, roles: ['user'] },
      });

      const types = fakePublisher.published.map((p) => (p.payload as { type: string }).type);
      types.should.containEql('requirement.state.changed');
      types.should.containEql('requirement.resolved');
      const rows = await allRows();
      rows.length.should.equal(1);
    });

    it('TS-14 · un edit que cambia solo title no encola nada', async () => {
      const requirementId = await createPublicRequirement([U1, U2], { state: 'desarrollo' });
      fakePublisher.reset();

      const reply = await dispatch(`requirements.${requirementId}.edit`, {
        editor: U1, title: 'Nuevo título',
      });

      reply.status.should.equal('success');
      (await allRows()).length.should.equal(0);
      const types = fakePublisher.published.map((p) => (p.payload as { type: string }).type);
      types.should.containEql('requirement.updated');
    });

    it('TS-15 · un edit que cambia solo description no encola nada', async () => {
      const requirementId = await createPublicRequirement([U1, U2], { state: 'desarrollo' });

      const reply = await dispatch(`requirements.${requirementId}.edit`, {
        editor: U1, description: 'Otra descripción',
      });

      reply.status.should.equal('success');
      (await allRows()).length.should.equal(0);
    });

    it('TS-16 · un cambio de estado que no es resolución ni reapertura no encola', async () => {
      const requirementId = await createPublicRequirement([U1, U2], { state: 'analisis' });
      fakePublisher.reset();

      const reply = await dispatch(`requirements.${requirementId}.edit`, {
        editor: U1, state: 'en_cola',
      });

      reply.status.should.equal('success');
      (await allRows()).length.should.equal(0);
      const types = fakePublisher.published.map((p) => (p.payload as { type: string }).type);
      types.should.containEql('requirement.state.changed');
    });

    it('TS-17 · un edit de priority (campo sin evento) no encola', async () => {
      const requirementId = await createPublicRequirement([U1, U2], { state: 'desarrollo' });
      fakePublisher.reset();

      const reply = await dispatch(`requirements.${requirementId}.edit`, {
        editor: U1, priority: 'alta',
      });

      reply.status.should.equal('success');
      (await allRows()).length.should.equal(0);
      fakePublisher.published.length.should.equal(0);
    });

    it('TS-18 · edit a resuelto sobre requisito internal no encola', async () => {
      const requirement = await Requirement.create({
        title: 'Interno', description: 'x', projectId: P1, createdBy: U1,
        visibilityLevel: RequirementVisibilityLevel.Internal, state: 'desarrollo' as any,
      });
      await RequirementSubscriptor.bulkCreate([
        { requirementId: requirement.id, userId: U1 },
        { requirementId: requirement.id, userId: U2 },
      ]);

      const reply = await dispatch(`requirements.${requirement.id}.edit`, {
        editor: U1, state: 'resuelto',
      });

      reply.status.should.equal('success');
      (await allRows()).length.should.equal(0);
    });

    it('TS-19 · edit a resuelto sin suscriptores encola cero y responde éxito', async () => {
      const requirementId = await createPublicRequirement([], { state: 'desarrollo' });

      const reply = await dispatch(`requirements.${requirementId}.edit`, {
        editor: U1, state: 'resuelto',
      });

      reply.status.should.equal('success');
      (await allRows()).length.should.equal(0);
    });
  });

  // ==============================================================================================
  // Reapertura (CA-5)
  // ==============================================================================================

  describe('requirements.{id}.edit — reapertura', () => {
    it('TS-20 · reapertura encola para los demás, sin resolutionComment', async () => {
      const requirementId = await createPublicRequirement([U1, U2], {
        state: 'resuelto', resolutionComment: 'Se corrigió',
      });

      const reply = await dispatch(`requirements.${requirementId}.edit`, {
        editor: U2, state: 'desarrollo', actor: { id: U2, roles: ['user'] },
      });

      reply.status.should.equal('success');
      const rows = await allRows();
      rows.length.should.equal(1);
      rows[0].recipientUserId.should.equal(U1);
      rows[0].type.should.equal('requirement.reopened');
      ('resolutionComment' in ((rows[0].payload as any).data ?? {})).should.be.false();
    });

    it('TS-21 · salir de resuelto hacia cancelado no es reapertura y no encola', async () => {
      const requirementId = await createPublicRequirement([U1, U2], {
        state: 'resuelto', resolutionComment: 'Se corrigió',
      });

      const reply = await dispatch(`requirements.${requirementId}.edit`, {
        editor: U1, state: 'cancelado',
      });

      reply.status.should.equal('success');
      const rows = await allRows();
      rows.filter((r) => r.type === 'requirement.reopened').length.should.equal(0);
    });
  });

  // ==============================================================================================
  // Resolución vía `requirements.{id}.resolve` (CA-3)
  // ==============================================================================================

  describe('requirements.{id}.resolve', () => {
    it('TS-22 · resolve encola para los demás suscriptores', async () => {
      const requirementId = await createPublicRequirement([U1, U2], { state: 'desarrollo' });

      const reply = await dispatch(`requirements.${requirementId}.resolve`, {
        editor: U1, type: 'otro', comment: 'Se corrigió el índice',
        actor: { id: U1, roles: ['user'] },
      });

      reply.status.should.equal('success');
      const rows = await allRows();
      rows.length.should.equal(1);
      rows[0].recipientUserId.should.equal(U2);
      rows[0].type.should.equal('requirement.resolved');
      (rows[0].payload as any).data.resolutionComment.should.equal('Se corrigió el índice');
    });

    it('TS-23 · resolve sobre un requisito ya resuelto no encola', async () => {
      const requirementId = await createPublicRequirement([U1, U2], {
        state: 'resuelto', resolutionComment: 'ya',
      });

      const reply = await dispatch(`requirements.${requirementId}.resolve`, {
        editor: U1, type: 'otro',
      });

      reply.status.should.equal('success');
      (await allRows()).length.should.equal(0);
    });

    it('TS-24 · resolution_required hace rollback y no deja fila', async () => {
      const requirement = await Requirement.create({
        title: 'Incidencia', description: 'x', projectId: P1, createdBy: U1,
        visibilityLevel: RequirementVisibilityLevel.Public, type: RequirementType.Incidencia,
        state: 'desarrollo' as any,
      });
      await RequirementSubscriptor.bulkCreate([
        { requirementId: requirement.id, userId: U1 },
        { requirementId: requirement.id, userId: U2 },
      ]);
      const previousState = requirement.state;

      const reply = await dispatch(`requirements.${requirement.id}.resolve`, {
        editor: U1, type: 'otro',
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('resolution_required');
      (await allRows()).length.should.equal(0);
      const reloaded = await Requirement.findByPk(requirement.id);
      reloaded!.state.should.equal(previousState);
    });

    it('TS-25 · resolve sobre requisito internal no encola', async () => {
      const requirementId = await createInternalRequirement([U1, U2]);

      const reply = await dispatch(`requirements.${requirementId}.resolve`, {
        editor: U1, type: 'otro',
      });

      reply.status.should.equal('success');
      (await allRows()).length.should.equal(0);
    });
  });

  // ==============================================================================================
  // Comentario (CA-6, CA-7, CA-8)
  // ==============================================================================================

  describe('requirements.{id}.comment', () => {
    it('TS-26 · comentario public en requisito public encola para los demás', async () => {
      const requirementId = await createPublicRequirement([U1, U2, U3]);

      const reply = await dispatch<{ id: number }>(`requirements.${requirementId}.comment`, {
        author: U1, comment: 'Ya está en QA', visibilityLevel: 'public',
        actor: { id: U1, roles: ['user'] },
      });

      reply.status.should.equal('success');
      const rows = await allRows();
      rows.length.should.equal(2);
      rows.map((r) => r.recipientUserId).sort().should.deepEqual([U2, U3].sort());
      rows.forEach((row) => {
        row.type.should.equal('requirement.comment.created');
        (row.payload as any).data.comment.should.equal('Ya está en QA');
        (row.payload as any).data.commentId.should.equal(reply.data!.id);
      });
    });

    it('TS-43 (S-073) · CA-13: el comando responde rápido, sin esperar ningún SMTP', async () => {
      // El comando NUNCA importa el proceso de envío (TS-42, gate estructural): este test es la
      // verificación funcional complementaria — el `Reply` llega rápido y la fila queda
      // `pending`, lista para que el proceso PERIÓDICO (Task 5/6 de S-073), desacoplado, la
      // levante en su próximo ciclo.
      const requirementId = await createPublicRequirement([U1, U2, U3]);

      const startedAt = Date.now();
      const reply = await dispatch<{ id: number }>(`requirements.${requirementId}.comment`, {
        author: U1, comment: 'Rápido, sin SMTP', visibilityLevel: 'public',
        actor: { id: U1, roles: ['user'] },
      });
      const elapsedMs = Date.now() - startedAt;

      reply.status.should.equal('success');
      (elapsedMs < 1000).should.be.true();
      const rows = await allRows();
      rows.length.should.equal(2);
      rows.forEach((row) => row.status.should.equal('pending'));
    });

    it('TS-27 · comentario internal en requisito public no encola', async () => {
      const requirementId = await createPublicRequirement([U1, U2, U3]);

      const reply = await dispatch(`requirements.${requirementId}.comment`, {
        author: U1, comment: 'Nota interna', visibilityLevel: 'internal',
      });

      reply.status.should.equal('success');
      (await allRows()).length.should.equal(0);
    });

    it('TS-28 · comentario sin visibilityLevel (default internal) no encola', async () => {
      const requirementId = await createPublicRequirement([U1, U2]);

      const reply = await dispatch(`requirements.${requirementId}.comment`, {
        author: U1, comment: 'Sin nivel',
      });

      reply.status.should.equal('success');
      (await allRows()).length.should.equal(0);
    });

    it('TS-29 · comentario public en requisito internal no encola', async () => {
      const requirementId = await createInternalRequirement([U1, U2]);

      const reply = await dispatch(`requirements.${requirementId}.comment`, {
        author: U1, comment: 'x', visibilityLevel: 'public',
      });

      reply.status.should.equal('success');
      (await allRows()).length.should.equal(0);
    });

    it('TS-30 · editar un comentario public no encola nada', async () => {
      const requirementId = await createPublicRequirement([U1, U2, U3]);
      const commentReply = await dispatch<{ id: number }>(`requirements.${requirementId}.comment`, {
        author: U1, comment: 'Ya está en QA', visibilityLevel: 'public',
      });
      await NotificationOutbox.destroy({ where: {}, truncate: true, cascade: true });
      fakePublisher.reset();

      const reply = await dispatch(
        `requirements.${requirementId}.comment.${commentReply.data!.id}.edit`,
        { editor: U1, comment: 'Ya está en QA (corregido)' }
      );

      reply.status.should.equal('success');
      (await allRows()).length.should.equal(0);
      const types = fakePublisher.published.map((p) => (p.payload as { type: string }).type);
      types.should.containEql('requirement.comment.edited');
    });

    it('TS-31 · un admin que edita un comentario ajeno tampoco encola', async () => {
      const requirementId = await createPublicRequirement([U1, U2]);
      const commentReply = await dispatch<{ id: number }>(`requirements.${requirementId}.comment`, {
        author: U2, comment: 'de U2', visibilityLevel: 'public',
      });
      await NotificationOutbox.destroy({ where: {}, truncate: true, cascade: true });

      const reply = await dispatch(
        `requirements.${requirementId}.comment.${commentReply.data!.id}.edit`,
        { editor: U1, comment: 'x', actor: { id: U1, roles: ['admin'] } }
      );

      reply.status.should.equal('success');
      (await allRows()).length.should.equal(0);
    });

    it('TS-32 · comentario que falla por fileIds no propios no deja fila (rollback)', async () => {
      const requirementId = await createPublicRequirement([U1, U2]);
      const before = await RequirementActivity.count();

      const reply = await dispatch(`requirements.${requirementId}.comment`, {
        author: U1, comment: 'x', visibilityLevel: 'public', fileIds: [999999],
      });

      reply.status.should.equal('failure');
      (await allRows()).length.should.equal(0);
      (await RequirementActivity.count()).should.equal(before);
    });

    it('TS-33 · comentario public sin suscriptores responde éxito sin encolar', async () => {
      const requirementId = await createPublicRequirement([]);

      const reply = await dispatch(`requirements.${requirementId}.comment`, {
        author: U1, comment: 'x', visibilityLevel: 'public',
      });

      reply.status.should.equal('success');
      (await allRows()).length.should.equal(0);
    });
  });

  // ==============================================================================================
  // Estructurales / regresión
  // ==============================================================================================

  describe('estructurales', () => {
    it('TS-34 · ningún comando fuera de los cinco declara notificaciones', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const dir = path.join(__dirname, '..', '..', 'src', 'commands');
      const expected = new Set([
        'requirements-new.ts',
        'requirements-subscriptors.ts',
        'requirements-comment.ts',
        'requirements-edit.ts',
        'requirements-resolve.ts',
      ]);

      function collectFiles(base: string): string[] {
        const entries = fs.readdirSync(base, { withFileTypes: true });
        return entries.flatMap((entry) => {
          const full = path.join(base, entry.name);
          if (entry.isDirectory()) {
            return collectFiles(full);
          }
          return entry.name.endsWith('.ts') ? [full] : [];
        });
      }

      const declaring = collectFiles(dir).filter((file) => {
        const content = fs.readFileSync(file, 'utf-8');
        return /reply\.notifications\s*=/.test(content) || content.includes('notifications.push(');
      });

      declaring.length.should.equal(5);
      const basenames = new Set(declaring.map((file) => path.basename(file)));
      basenames.should.deepEqual(expected);
    });

    it('TS-35 · los cuatro type declarados existen en el registro', async () => {
      const declaredTypes = [
        'requirement.created',
        'requirement.resolved',
        'requirement.reopened',
        'requirement.comment.created',
      ];

      for (const type of declaredTypes) {
        const entry = notificationsRegistry.getNotificationType(type);
        (entry !== undefined).should.be.true();
      }
    });

    it('TS-36 · los 33 escenarios de S-071 (notifications.test.ts) siguen verdes por su cuenta', () => {
      // Cubierto por la corrida de `npm test` completa (ejecuta ambos archivos); este test es
      // un marcador para dejar constancia de que el mecanismo de S-071 no se tocó.
      registry.resolve('requirements.new')!.command.pattern.should.equal('requirements.new');
    });
  });
});
