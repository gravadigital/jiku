import 'mocha';
import 'should';
import { Transaction } from 'sequelize';
import {
  Attachment, AttachmentEntityType, ByteStatus, File, Objective, Person, PersonObjective,
  Project, RetentionStatus, User, statusObjective,
} from '@jiku/models';
import { readTaskResponsiblePersonIds, taskToSnapshot } from '../../src/events/domain/task-snapshot';
import { readCommentFileIds } from '../../src/events/domain/requirement-snapshot';
import { sequelize } from '../../src/models';

const CREATOR = 'zitadel-sub-task-snapshot';

describe('events/domain/task-snapshot — Task 1 de S-065', () => {
  let projectId: number;

  before(async () => {
    await User.create({
      id: CREATOR, name: 'Creador Snapshot', username: 'creador-task-snap', email: 'tsnap@mail.com',
    });
    const project = await Project.create({
      name: 'Proyecto Task Snapshot', code: 'TSNAP', status: 'activo', type: 'comercial',
      description: 'x', initDate: new Date(), createdBy: CREATOR,
    });
    projectId = project.id;
  });

  after(async () => {
    await Attachment.destroy({ where: {}, force: true });
    await File.destroy({ where: {} });
    await PersonObjective.destroy({ where: {} });
    await Person.destroy({ where: {} });
    await Objective.destroy({ where: {} });
    await Project.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  afterEach(async () => {
    await Attachment.destroy({ where: {}, force: true });
    await File.destroy({ where: {} });
    await PersonObjective.destroy({ where: {} });
    await Objective.destroy({ where: {} });
  });

  describe('taskToSnapshot', () => {
    it('TS-88 · tiene EXACTAMENTE los 16 campos del contrato', async () => {
      const task = await Objective.create({
        title: 'T', description: 'D', state: statusObjective.Backlog, area: 'diseño',
        priority: 2, visibilityLevel: 'public', projectId, createdBy: CREATOR,
      });

      const snapshot = taskToSnapshot(task, [7, 3, 9]);

      Object.keys(snapshot).sort().should.deepEqual(
        [
          'area', 'createdAt', 'createdBy', 'description', 'estimatedFinishDate', 'finishedAt',
          'id', 'priority', 'priorityValue', 'projectId', 'requirementId',
          'responsiblePersonIds', 'state', 'title', 'updatedAt', 'visibilityLevel',
        ].sort()
      );
    });

    it('TS-89 · estimatedFinishDate viaja tal cual, sin sufijo de hora (columna VARCHAR)', async () => {
      const task = await Objective.create({
        title: 'T', description: 'D', state: statusObjective.Backlog, area: 'diseño',
        priority: 2, visibilityLevel: 'public', projectId, createdBy: CREATOR,
        estimatedFinishDate: '2026-12-31',
      });

      const snapshot = taskToSnapshot(task, []);

      snapshot.estimatedFinishDate!.should.equal('2026-12-31');
      snapshot.estimatedFinishDate!.length.should.equal(10);
    });

    it('TS-90 · deriva priority del entero y transporta priorityValue crudo (0, 2, 4 y 5)', async () => {
      const t0 = await Objective.create({
        title: 'T0', description: 'D', state: statusObjective.Backlog, area: 'diseño',
        priority: 0, visibilityLevel: 'public', projectId, createdBy: CREATOR,
      });
      const t2 = await Objective.create({
        title: 'T2', description: 'D', state: statusObjective.Backlog, area: 'diseño',
        priority: 2, visibilityLevel: 'public', projectId, createdBy: CREATOR,
      });
      const t4 = await Objective.create({
        title: 'T4', description: 'D', state: statusObjective.Backlog, area: 'diseño',
        priority: 4, visibilityLevel: 'public', projectId, createdBy: CREATOR,
      });
      const t5 = await Objective.create({
        title: 'T5', description: 'D', state: statusObjective.Backlog, area: 'diseño',
        priority: 5, visibilityLevel: 'public', projectId, createdBy: CREATOR,
      });

      const s0 = taskToSnapshot(t0, []);
      const s2 = taskToSnapshot(t2, []);
      const s4 = taskToSnapshot(t4, []);
      const s5 = taskToSnapshot(t5, []);

      s0.priority.should.equal('sin_prioridad');
      s0.priorityValue.should.equal(0);
      s2.priority.should.equal('media');
      s2.priorityValue.should.equal(2);
      s4.priority.should.equal('urgente');
      s4.priorityValue.should.equal(4);
      // El 5 NO se colapsa en 4: llega como 5, aunque el nombre sea el mismo que el 4.
      s5.priority.should.equal('urgente');
      s5.priorityValue.should.equal(5);
    });

    it('TS-91 · description NULL devuelve null', async () => {
      const task = await Objective.create({
        title: 'T', state: statusObjective.Backlog, area: 'diseño',
        priority: 0, visibilityLevel: 'public', projectId, createdBy: CREATOR,
      });

      (taskToSnapshot(task, []).description === null).should.be.true();
    });

    it('finishedAt es null en una tarea nueva; createdAt/updatedAt son ISO string', async () => {
      const task = await Objective.create({
        title: 'T', description: 'D', state: statusObjective.Backlog, area: 'diseño',
        priority: 0, visibilityLevel: 'public', projectId, createdBy: CREATOR,
      });

      const snapshot = taskToSnapshot(task, []);

      (snapshot.finishedAt === null).should.be.true();
      snapshot.createdAt.should.match(/^\d{4}-\d{2}-\d{2}T.*Z$/);
      snapshot.updatedAt.should.match(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    });

    it('requirementId viaja null cuando la columna es NULL', async () => {
      const task = await Objective.create({
        title: 'T', description: 'D', state: statusObjective.Backlog, area: 'diseño',
        priority: 0, visibilityLevel: 'public', projectId, createdBy: CREATOR,
      });

      (taskToSnapshot(task, []).requirementId === null).should.be.true();
    });
  });

  describe('readTaskResponsiblePersonIds', () => {
    it('TS-92 · el líder primero, el resto por personId ascendente, con false y NULL mezclados', async () => {
      const task = await Objective.create({
        title: 'T', description: 'D', state: statusObjective.Backlog, area: 'diseño',
        priority: 0, visibilityLevel: 'public', projectId, createdBy: CREATOR,
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
      const p5 = await Person.create({
        firstName: 'P5', lastName: 'X', enabled: true, initDate: new Date('2026-01-01'),
      });
      await PersonObjective.create({ personId: p9.id, objectiveId: task.id, isLeader: false });
      await PersonObjective.create({ personId: p3.id, objectiveId: task.id, isLeader: true });
      // La fila heredada (de antes de que `core` escribiera): `isLeader: null`.
      await PersonObjective.create({ personId: p7.id, objectiveId: task.id, isLeader: null as unknown as boolean });
      await PersonObjective.create({ personId: p5.id, objectiveId: task.id, isLeader: false });

      let transaction: Transaction | undefined;
      try {
        transaction = await sequelize.transaction();
        const ids = await readTaskResponsiblePersonIds(task.id, transaction);
        await transaction.commit();
        transaction = undefined;

        const expectedRest = [p9.id, p7.id, p5.id].sort((a, b) => a - b);
        ids.should.deepEqual([p3.id, ...expectedRest]);
      } finally {
        if (transaction) {
          await transaction.rollback();
        }
        await Person.destroy({ where: { id: [p9.id, p3.id, p7.id, p5.id] } });
      }
    });

    it('TS-93 · sin filas devuelve [], nunca null', async () => {
      const task = await Objective.create({
        title: 'T', description: 'D', state: statusObjective.Backlog, area: 'diseño',
        priority: 0, visibilityLevel: 'public', projectId, createdBy: CREATOR,
      });

      let transaction: Transaction | undefined;
      try {
        transaction = await sequelize.transaction();
        const ids = await readTaskResponsiblePersonIds(task.id, transaction);
        await transaction.commit();
        transaction = undefined;

        ids.should.deepEqual([]);
      } finally {
        if (transaction) {
          await transaction.rollback();
        }
      }
    });

    it('TS-94 · no filtra por active: dos filas con active NULL devuelven las dos', async () => {
      const task = await Objective.create({
        title: 'T', description: 'D', state: statusObjective.Backlog, area: 'diseño',
        priority: 0, visibilityLevel: 'public', projectId, createdBy: CREATOR,
      });
      const p1 = await Person.create({
        firstName: 'P1', lastName: 'X', enabled: true, initDate: new Date('2026-01-01'),
      });
      const p2 = await Person.create({
        firstName: 'P2', lastName: 'X', enabled: true, initDate: new Date('2026-01-01'),
      });
      // `active` NUNCA se escribe (D-8): las dos filas quedan con `active: NULL`.
      await PersonObjective.create({ personId: p1.id, objectiveId: task.id, isLeader: true });
      await PersonObjective.create({ personId: p2.id, objectiveId: task.id, isLeader: false });

      let transaction: Transaction | undefined;
      try {
        transaction = await sequelize.transaction();
        const ids = await readTaskResponsiblePersonIds(task.id, transaction);
        await transaction.commit();
        transaction = undefined;

        ids.should.deepEqual([p1.id, p2.id]);
      } finally {
        if (transaction) {
          await transaction.rollback();
        }
        await Person.destroy({ where: { id: [p1.id, p2.id] } });
      }
    });

    it('dos filas con isLeader: true no rompen — las dos quedan al frente, el resto sigue ordenado', async () => {
      const task = await Objective.create({
        title: 'T', description: 'D', state: statusObjective.Backlog, area: 'diseño',
        priority: 0, visibilityLevel: 'public', projectId, createdBy: CREATOR,
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
      await PersonObjective.create({ personId: p5.id, objectiveId: task.id, isLeader: false });
      await PersonObjective.create({ personId: p1.id, objectiveId: task.id, isLeader: true });
      await PersonObjective.create({ personId: p2.id, objectiveId: task.id, isLeader: true });

      let transaction: Transaction | undefined;
      try {
        transaction = await sequelize.transaction();
        const ids = await readTaskResponsiblePersonIds(task.id, transaction);
        await transaction.commit();
        transaction = undefined;

        ids.length.should.equal(3);
        ids.slice(0, 2).sort((a, b) => a - b).should.deepEqual([p1.id, p2.id].sort((a, b) => a - b));
        ids[2].should.equal(p5.id);
      } finally {
        if (transaction) {
          await transaction.rollback();
        }
        await Person.destroy({ where: { id: [p1.id, p2.id, p5.id] } });
      }
    });
  });

  /** D-3: `readCommentFileIds` ganó el parámetro `entityType` y esta story lo usa con el de tarea. */
  describe('readCommentFileIds con AttachmentEntityType.ObjectiveComment', () => {
    async function makeFile(): Promise<File> {
      return File.create({
        fileName: 'informe.pdf',
        fileSize: 4194304,
        mimeType: 'application/pdf',
        storageKey: `grava-gestion/tsnap/${Math.random().toString(36).slice(2)}.pdf`,
        storageBucket: 'test-bucket',
        storageRegion: 'us-east-1',
        uploadedBy: CREATOR,
        byteStatus: ByteStatus.Uploaded,
        retentionStatus: RetentionStatus.Active,
      });
    }

    it('TS-95 · ignora los vínculos borrados y ordena ascendente', async () => {
      const f32 = await makeFile();
      const f31 = await makeFile();
      const f40 = await makeFile();
      const commentId = 919191;
      await Attachment.create({
        entityType: AttachmentEntityType.ObjectiveComment, entityId: commentId, fileId: f32.id,
      });
      await Attachment.create({
        entityType: AttachmentEntityType.ObjectiveComment, entityId: commentId, fileId: f31.id,
      });
      await Attachment.create({
        entityType: AttachmentEntityType.ObjectiveComment, entityId: commentId, fileId: f40.id,
        deletedAt: new Date(),
      });

      let transaction: Transaction | undefined;
      try {
        transaction = await sequelize.transaction();
        const ids = await readCommentFileIds(
          commentId,
          AttachmentEntityType.ObjectiveComment,
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

    it('TS-96 · con RequirementComment sigue funcionando (regresión de D-3)', async () => {
      const f = await makeFile();
      const fDeleted = await makeFile();
      const commentId = 929292;
      await Attachment.create({
        entityType: AttachmentEntityType.RequirementComment, entityId: commentId, fileId: f.id,
      });
      await Attachment.create({
        entityType: AttachmentEntityType.RequirementComment, entityId: commentId, fileId: fDeleted.id,
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

        ids.should.deepEqual([f.id]);
      } finally {
        if (transaction) {
          await transaction.rollback();
        }
      }
    });

    it('TS-97 · no cruza entidades: el mismo entityId con dos entityType distintos', async () => {
      const fObjective = await makeFile();
      const fRequirement = await makeFile();
      const sharedId = 939393;
      await Attachment.create({
        entityType: AttachmentEntityType.ObjectiveComment, entityId: sharedId, fileId: fObjective.id,
      });
      await Attachment.create({
        entityType: AttachmentEntityType.RequirementComment, entityId: sharedId, fileId: fRequirement.id,
      });

      let transaction: Transaction | undefined;
      try {
        transaction = await sequelize.transaction();
        const objectiveIds = await readCommentFileIds(
          sharedId,
          AttachmentEntityType.ObjectiveComment,
          transaction
        );
        const requirementIds = await readCommentFileIds(
          sharedId,
          AttachmentEntityType.RequirementComment,
          transaction
        );
        await transaction.commit();
        transaction = undefined;

        objectiveIds.should.deepEqual([fObjective.id]);
        requirementIds.should.deepEqual([fRequirement.id]);
      } finally {
        if (transaction) {
          await transaction.rollback();
        }
      }
    });
  });
});
