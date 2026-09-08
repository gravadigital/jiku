import 'mocha';
import 'should';
import { Transaction } from 'sequelize';
import {
  Project, Requirement, RequirementPriority, RequirementState, RequirementSubscriptor,
  RequirementVisibilityLevel, User,
} from '@jiku/models';
import { requirementToSnapshot, resolveRecipients } from '../../src/events/domain/requirement-snapshot';
import { sequelize } from '../../src/models';

const CREATOR = 'zitadel-sub-snapshot';

describe('events/domain/requirement-snapshot — Task 3 de S-063', () => {
  let projectId: number;

  before(async () => {
    await User.create({
      id: CREATOR, name: 'Creador Snapshot', username: 'creador-snap', email: 'snap@mail.com',
    });
    const project = await Project.create({
      name: 'Proyecto Snapshot', code: 'SNAP', status: 'activo', type: 'comercial',
      description: 'x', initDate: new Date(), createdBy: CREATOR,
    });
    projectId = project.id;
  });

  after(async () => {
    await RequirementSubscriptor.destroy({ where: {} });
    await Requirement.destroy({ where: {} });
    await Project.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  afterEach(async () => {
    await RequirementSubscriptor.destroy({ where: {} });
    await Requirement.destroy({ where: {} });
  });

  describe('requirementToSnapshot', () => {
    it('TS-24 · tiene EXACTAMENTE los 15 campos del contrato', async () => {
      const requirement = await Requirement.create({
        title: 'T', description: 'D', priority: RequirementPriority.Media,
        state: RequirementState.Analisis, visibilityLevel: RequirementVisibilityLevel.Public,
        projectId, createdBy: CREATOR,
      });

      const snapshot = requirementToSnapshot(requirement, [7, 3, 9]);

      Object.keys(snapshot).sort().should.deepEqual(
        [
          'createdAt', 'createdBy', 'description', 'estimatedFinishDate', 'finishedAt', 'id',
          'priority', 'projectId', 'responsiblePersonIds', 'state', 'tags', 'title', 'type',
          'updatedAt', 'visibilityLevel',
        ].sort()
      );
    });

    it('TS-26 · description viaja completo, nunca truncado (5000 caracteres)', async () => {
      const description = 'A'.repeat(5000);
      const requirement = await Requirement.create({
        title: 'T', description, priority: RequirementPriority.Media,
        state: RequirementState.Analisis, visibilityLevel: RequirementVisibilityLevel.Public,
        projectId, createdBy: CREATOR,
      });

      const snapshot = requirementToSnapshot(requirement, []);

      snapshot.description.length.should.equal(5000);
      snapshot.description.should.equal(description);
    });

    it('TS-30 · estimatedFinishDate viaja como string YYYY-MM-DD, sin hora', async () => {
      const requirement = await Requirement.create({
        title: 'T', description: 'D', priority: RequirementPriority.Media,
        state: RequirementState.Analisis, visibilityLevel: RequirementVisibilityLevel.Public,
        projectId, createdBy: CREATOR, estimatedFinishDate: '2026-12-31',
      });

      const snapshot = requirementToSnapshot(requirement, []);

      snapshot.estimatedFinishDate!.should.equal('2026-12-31');
      snapshot.estimatedFinishDate!.length.should.equal(10);
    });

    it('TS-31 · createdAt/updatedAt son ISO string; finishedAt es null cuando lo es', async () => {
      const requirement = await Requirement.create({
        title: 'T', description: 'D', priority: RequirementPriority.Media,
        state: RequirementState.Analisis, visibilityLevel: RequirementVisibilityLevel.Public,
        projectId, createdBy: CREATOR,
      });

      const snapshot = requirementToSnapshot(requirement, []);

      snapshot.createdAt.should.be.a.String();
      snapshot.createdAt.should.match(/^\d{4}-\d{2}-\d{2}T.*Z$/);
      snapshot.updatedAt.should.match(/^\d{4}-\d{2}-\d{2}T.*Z$/);
      (snapshot.finishedAt === null).should.be.true();
    });

    it('TS-32, TS-33 · tags respeta la forma del contrato y es [] cuando la columna es NULL', async () => {
      const withTags = await Requirement.create({
        title: 'T', description: 'D', priority: RequirementPriority.Media,
        state: RequirementState.Analisis, visibilityLevel: RequirementVisibilityLevel.Public,
        projectId, createdBy: CREATOR, tags: [{ key: 'area', value: 'backend' }],
      });
      const withoutTags = await Requirement.create({
        title: 'T2', description: 'D', priority: RequirementPriority.Media,
        state: RequirementState.Analisis, visibilityLevel: RequirementVisibilityLevel.Public,
        projectId, createdBy: CREATOR,
      });

      const snapshotWithTags = requirementToSnapshot(withTags, []);
      const snapshotWithoutTags = requirementToSnapshot(withoutTags, []);

      Array.isArray(snapshotWithTags.tags).should.be.true();
      snapshotWithTags.tags.should.deepEqual(['area:backend']);
      snapshotWithoutTags.tags.should.deepEqual([]);
    });

    it('TS-27, TS-28 · responsiblePersonIds conserva el orden recibido y es [] sin responsables', async () => {
      const requirement = await Requirement.create({
        title: 'T', description: 'D', priority: RequirementPriority.Media,
        state: RequirementState.Analisis, visibilityLevel: RequirementVisibilityLevel.Public,
        projectId, createdBy: CREATOR,
      });

      requirementToSnapshot(requirement, [9, 3, 7]).responsiblePersonIds.should.deepEqual([9, 3, 7]);
      requirementToSnapshot(requirement, []).responsiblePersonIds.should.deepEqual([]);
    });

    it('TS-29 · type ausente viaja como null', async () => {
      const requirement = await Requirement.create({
        title: 'T', description: 'D', priority: RequirementPriority.Media,
        state: RequirementState.Analisis, visibilityLevel: RequirementVisibilityLevel.Public,
        projectId, createdBy: CREATOR,
      });

      (requirementToSnapshot(requirement, []).type === null).should.be.true();
    });

    it('no incluye los 9 campos excluidos del contrato', async () => {
      const requirement = await Requirement.create({
        title: 'T', description: 'D', priority: RequirementPriority.Media,
        state: RequirementState.Analisis, visibilityLevel: RequirementVisibilityLevel.Public,
        projectId, createdBy: CREATOR,
        scope: 'x', technicalSolution: 'y', acceptanceCriteria: 'z',
      });

      const snapshot = requirementToSnapshot(requirement, []) as unknown as Record<string, unknown>;

      ['scope', 'technicalSolution', 'acceptanceCriteria', 'resolutionType',
        'resolutionConclusion', 'resolutionComment', 'scheduledAt', 'inProgressAt', 'inReviewAt']
        .forEach((key) => {
          (key in snapshot).should.be.false();
        });
    });
  });

  describe('resolveRecipients', () => {
    it('TS-38 · resuelve userId/name/email cuando hay filas, y CONSERVA email: null', async () => {
      const requirement = await Requirement.create({
        title: 'T', description: 'D', priority: RequirementPriority.Media,
        state: RequirementState.Analisis, visibilityLevel: RequirementVisibilityLevel.Public,
        projectId, createdBy: CREATOR,
      });
      await User.create({ id: '9988', name: 'Ana Gómez', username: 'ana-g', email: 'ana@cliente.com' });
      await User.create({ id: '7766', name: 'Svc', username: 'svc-user', email: null });
      await RequirementSubscriptor.create({ requirementId: requirement.id, userId: '9988' });
      await RequirementSubscriptor.create({ requirementId: requirement.id, userId: '7766' });

      let transaction: Transaction | undefined;
      try {
        transaction = await sequelize.transaction();
        const recipients = await resolveRecipients(requirement.id, [7, 3, 9], transaction);
        await transaction.commit();
        transaction = undefined;

        recipients.responsiblePersonIds.should.deepEqual([7, 3, 9]);
        recipients.subscriptors.length.should.equal(2);
        const byId = new Map(recipients.subscriptors.map((s) => [s.userId, s]));
        byId.get('9988')!.should.deepEqual({ userId: '9988', name: 'Ana Gómez', email: 'ana@cliente.com' });
        byId.get('7766')!.should.deepEqual({ userId: '7766', name: 'Svc', email: null });
      } finally {
        if (transaction) {
          await transaction.rollback();
        }
        // El orden importa: `requirement_subscriptors.user_id` tiene FK a `users.id`, así que
        // las filas del suscriptor se borran primero (el `afterEach` del describe exterior
        // también las limpia, pero acá hace falta ANTES de poder borrar los `User` de este test).
        await RequirementSubscriptor.destroy({ where: { userId: ['9988', '7766'] } });
        await User.destroy({ where: { id: ['9988', '7766'] } });
      }
    });

    it('TS-35 · sin filas de suscripción, subscriptors es [] y responsiblePersonIds se conserva', async () => {
      const requirement = await Requirement.create({
        title: 'T', description: 'D', priority: RequirementPriority.Media,
        state: RequirementState.Analisis, visibilityLevel: RequirementVisibilityLevel.Public,
        projectId, createdBy: CREATOR,
      });

      let transaction: Transaction | undefined;
      try {
        transaction = await sequelize.transaction();
        const recipients = await resolveRecipients(requirement.id, [7, 3, 9], transaction);
        await transaction.commit();
        transaction = undefined;

        recipients.should.deepEqual({ subscriptors: [], responsiblePersonIds: [7, 3, 9] });
      } finally {
        if (transaction) {
          await transaction.rollback();
        }
      }
    });
  });
});
