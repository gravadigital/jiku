import 'mocha';
import 'should';
import { Transaction } from 'sequelize';
import {
  Attachment, AttachmentEntityType, ByteStatus, File, Person, PersonRequirement,
  Project, Requirement, RequirementPriority, RequirementState, RequirementSubscriptor,
  RequirementVisibilityLevel, RetentionStatus, User,
} from '@jiku/models';
import { readCommentFileIds, readResponsiblePersonIds, requirementToSnapshot, resolveRecipients } from '../../src/events/domain/requirement-snapshot';
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
    await Attachment.destroy({ where: {}, force: true });
    await File.destroy({ where: {} });
    await PersonRequirement.destroy({ where: {} });
    await Person.destroy({ where: {} });
    await RequirementSubscriptor.destroy({ where: {} });
    await Requirement.destroy({ where: {} });
    await Project.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  afterEach(async () => {
    await Attachment.destroy({ where: {}, force: true });
    await File.destroy({ where: {} });
    await PersonRequirement.destroy({ where: {} });
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

  /** S-064, Task 2: el orden de `responsiblePersonIds` fuera del alta (D-4). */
  describe('readResponsiblePersonIds', () => {
    it('TS-82 · el líder queda primero, el resto por personId ascendente', async () => {
      const requirement = await Requirement.create({
        title: 'T', description: 'D', priority: RequirementPriority.Media,
        state: RequirementState.Analisis, visibilityLevel: RequirementVisibilityLevel.Public,
        projectId, createdBy: CREATOR,
      });
      const p9 = await Person.create({
        firstName: 'P9', lastName: 'X', enabled: true, initDate: new Date('2026-01-01'),
      });
      const p3 = await Person.create({
        firstName: 'P3', lastName: 'X', enabled: true, initDate: new Date('2026-01-01'),
      });
      const p7 = await Person.create({
        firstName: 'P7', lastName: 'X', enabled: true, initDate: new Date('2026-01-01'),
      });
      await PersonRequirement.create({ personId: p9.id, requirementId: requirement.id, isLeader: null });
      await PersonRequirement.create({ personId: p3.id, requirementId: requirement.id, isLeader: true });
      await PersonRequirement.create({ personId: p7.id, requirementId: requirement.id, isLeader: null });

      let transaction: Transaction | undefined;
      try {
        transaction = await sequelize.transaction();
        const ids = await readResponsiblePersonIds(requirement.id, transaction);
        await transaction.commit();
        transaction = undefined;

        // p3 es el líder: va primero. El resto (p7, p9) queda ordenado ascendente por personId.
        const expectedRest = [p7.id, p9.id].sort((a, b) => a - b);
        ids.should.deepEqual([p3.id, ...expectedRest]);
      } finally {
        if (transaction) {
          await transaction.rollback();
        }
      }
    });

    it('TS-83 · sin responsables devuelve [], nunca null', async () => {
      const requirement = await Requirement.create({
        title: 'T', description: 'D', priority: RequirementPriority.Media,
        state: RequirementState.Analisis, visibilityLevel: RequirementVisibilityLevel.Public,
        projectId, createdBy: CREATOR,
      });

      let transaction: Transaction | undefined;
      try {
        transaction = await sequelize.transaction();
        const ids = await readResponsiblePersonIds(requirement.id, transaction);
        await transaction.commit();
        transaction = undefined;

        ids.should.deepEqual([]);
      } finally {
        if (transaction) {
          await transaction.rollback();
        }
      }
    });

    it('dos filas con isLeader: true no rompen — las dos quedan al frente, el resto sigue ordenado', async () => {
      const requirement = await Requirement.create({
        title: 'T', description: 'D', priority: RequirementPriority.Media,
        state: RequirementState.Analisis, visibilityLevel: RequirementVisibilityLevel.Public,
        projectId, createdBy: CREATOR,
      });
      const p1 = await Person.create({
        firstName: 'P1', lastName: 'X', enabled: true, initDate: new Date('2026-01-01'),
      });
      const p2 = await Person.create({
        firstName: 'P2', lastName: 'X', enabled: true, initDate: new Date('2026-01-01'),
      });
      const p5 = await Person.create({
        firstName: 'P5', lastName: 'X', enabled: true, initDate: new Date('2026-01-01'),
      });
      await PersonRequirement.create({ personId: p5.id, requirementId: requirement.id, isLeader: null });
      await PersonRequirement.create({ personId: p1.id, requirementId: requirement.id, isLeader: true });
      await PersonRequirement.create({ personId: p2.id, requirementId: requirement.id, isLeader: true });

      let transaction: Transaction | undefined;
      try {
        transaction = await sequelize.transaction();
        const ids = await readResponsiblePersonIds(requirement.id, transaction);
        await transaction.commit();
        transaction = undefined;

        // Los dos líderes van al frente (en el orden que devuelva la base), y el resto sigue
        // ordenado ascendente detrás.
        ids.length.should.equal(3);
        ids.slice(0, 2).sort((a, b) => a - b).should.deepEqual([p1.id, p2.id].sort((a, b) => a - b));
        ids[2].should.equal(p5.id);
      } finally {
        if (transaction) {
          await transaction.rollback();
        }
      }
    });
  });

  /** S-064, Task 2: el conjunto vivo de `fileId` de un comentario (D-5). */
  describe('readCommentFileIds', () => {
    /** Un `File` válido y vivo, mínimo para satisfacer el FK de `attachments.file_id`. */
    async function makeFile(): Promise<File> {
      return File.create({
        fileName: 'informe.pdf',
        fileSize: 4194304,
        mimeType: 'application/pdf',
        storageKey: `grava-gestion/snap/${Math.random().toString(36).slice(2)}.pdf`,
        storageBucket: 'test-bucket',
        storageRegion: 'us-east-1',
        uploadedBy: CREATOR,
        byteStatus: ByteStatus.Uploaded,
        retentionStatus: RetentionStatus.Active,
      });
    }

    it('TS-84 · ignora los vínculos borrados y ordena ascendente', async () => {
      const f32 = await makeFile();
      const f31 = await makeFile();
      const f40 = await makeFile();
      const commentId = 909090;
      await Attachment.create({
        entityType: AttachmentEntityType.RequirementComment, entityId: commentId, fileId: f32.id,
      });
      await Attachment.create({
        entityType: AttachmentEntityType.RequirementComment, entityId: commentId, fileId: f31.id,
      });
      await Attachment.create({
        entityType: AttachmentEntityType.RequirementComment, entityId: commentId, fileId: f40.id,
        deletedAt: new Date(),
      });

      let transaction: Transaction | undefined;
      try {
        transaction = await sequelize.transaction();
        const ids = await readCommentFileIds(
          commentId,
          AttachmentEntityType.RequirementComment,
          transaction
        );
        await transaction.commit();
        transaction = undefined;

        ids.should.deepEqual([f31.id, f32.id].sort((a, b) => a - b));
      } finally {
        if (transaction) {
          await transaction.rollback();
        }
      }
    });

    it('sin vínculos devuelve []', async () => {
      let transaction: Transaction | undefined;
      try {
        transaction = await sequelize.transaction();
        const ids = await readCommentFileIds(
          777777,
          AttachmentEntityType.RequirementComment,
          transaction
        );
        await transaction.commit();
        transaction = undefined;

        ids.should.deepEqual([]);
      } finally {
        if (transaction) {
          await transaction.rollback();
        }
      }
    });
  });
});
