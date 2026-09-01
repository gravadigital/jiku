import 'mocha';
import 'should';
import { Op } from 'sequelize';
import { Attachment, ByteStatus, File, Objective, ObjectiveActivity, Person, PersonObjective, Project, Requirement, RequirementActivity, RetentionStatus, User } from '@jiku/models';
import { ErrorCode } from '@jiku/nats-protocol';
import { dispatch } from '../helpers/dispatch';

const CREATOR = 'zitadel-sub-tasks';
const OTHER_USER = 'zitadel-sub-tasks-2';
const ADMIN_ID_TASKS = 'zitadel-sub-tasks-admin';

/** Ver `requirements.test.ts`: el caller confiable se pide SIEMPRE explícito. */
const TRUSTED = 'api-service-user-sub';
const UPLOADER_A = 'zitadel-user-a-tasks';
const UPLOADER_B = 'zitadel-user-b-tasks';

describe('tasks', () => {
  let projectId: number;
  let otherProjectId: number;
  let personA: number;
  let personB: number;

  before(async () => {
    await User.create({
      id: CREATOR, name: 'Creador', username: 'creador-tasks', email: 'tasks@mail.com',
    });
    await User.create({
      id: OTHER_USER, name: 'Otro', username: 'otro-tasks', email: 'otro-tasks@mail.com',
    });
    // SIN `roles` en la fila: el rol admin viaja SIEMPRE por el sobre de identidad
    // (`actor: { id: ADMIN_ID_TASKS, roles: ['admin'] }`), nunca por `users.roles`.
    await User.create({
      id: ADMIN_ID_TASKS, name: 'Admin', username: 'admin-tasks', email: 'admin-tasks@mail.com',
    });
    const project = await Project.create({
      name: 'Proyecto Tasks', code: 'TASKS', status: 'activo', type: 'comercial',
      description: 'x', initDate: new Date(), createdBy: CREATOR,
    });
    projectId = project.id;
    const other = await Project.create({
      name: 'Otro', code: 'OTRO', status: 'activo', type: 'comercial',
      description: 'x', initDate: new Date(), createdBy: CREATOR,
    });
    otherProjectId = other.id;
    const a = await Person.create({
      firstName: 'Ana', lastName: 'Gómez', enabled: true, initDate: new Date('2026-01-01'),
    });
    const b = await Person.create({
      firstName: 'Beto', lastName: 'Ruiz', enabled: true, initDate: new Date('2026-01-01'),
    });
    personA = a.id;
    personB = b.id;
  });

  after(async () => {
    await ObjectiveActivity.destroy({ where: {} });
    await PersonObjective.destroy({ where: {} });
    await Objective.destroy({ where: {} });
    await Requirement.destroy({ where: {} });
    await Person.destroy({ where: {} });
    await Project.destroy({ where: {} });
    await User.destroy({ where: { id: [CREATOR, OTHER_USER, ADMIN_ID_TASKS] } });
  });

  afterEach(async () => {
    await ObjectiveActivity.destroy({ where: {} });
    await PersonObjective.destroy({ where: {} });
    await Objective.destroy({ where: {} });
  });

  describe('tasks.new', () => {
    it('crea una task con los defaults del protocolo', async () => {
      const reply = await dispatch<{ id: number }>('tasks.new', {
        creator: CREATOR,
        title: 'Primera task',
        projectId,
        responsiblePersonIds: [personA],
      });

      reply.status.should.equal('success');
      const task = await Objective.findByPk(reply.data!.id);
      task!.title.should.equal('Primera task');
      task!.state.should.equal('backlog');
      task!.area.should.equal('desarrollo');
      task!.visibilityLevel.should.equal('public');
      task!.priority.should.equal(0); // sin_prioridad
      task!.createdBy.should.equal(CREATOR);
    });

    it('traduce priority de enum a número', async () => {
      const reply = await dispatch<{ id: number }>('tasks.new', {
        creator: CREATOR,
        title: 'Con prioridad',
        projectId,
        responsiblePersonIds: [personA],
        priority: 'alta',
      });

      reply.status.should.equal('success');
      const task = await Objective.findByPk(reply.data!.id);
      task!.priority.should.equal(3);
    });

    it('asigna los responsables y deja líder al primero', async () => {
      const reply = await dispatch<{ id: number }>('tasks.new', {
        creator: CREATOR,
        title: 'Con responsables',
        projectId,
        responsiblePersonIds: [personA, personB],
      });

      const links = await PersonObjective.findAll({
        where: { objectiveId: reply.data!.id },
        order: [['personId', 'ASC']],
      });
      links.length.should.equal(2);
      const leader = links.find((l) => l.personId === personA);
      const follower = links.find((l) => l.personId === personB);
      leader!.isLeader.should.be.true();
      (!follower!.isLeader).should.be.true();
    });

    it('falla si el proyecto no existe', async () => {
      const reply = await dispatch('tasks.new', {
        creator: CREATOR, title: 'x', projectId: 999999, responsiblePersonIds: [personA],
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('project_not_found');
    });

    it('falla si una persona no existe', async () => {
      const reply = await dispatch('tasks.new', {
        creator: CREATOR, title: 'x', projectId, responsiblePersonIds: [personA, 999999],
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('person_not_found');
      (await Objective.count()).should.equal(0);
    });

    it('falla si el requisito es de otro proyecto', async () => {
      const requirement = await Requirement.create({
        title: 'Req', description: 'x', projectId: otherProjectId, createdBy: CREATOR,
      });
      const reply = await dispatch('tasks.new', {
        creator: CREATOR, title: 'x', projectId, responsiblePersonIds: [personA],
        requirementId: requirement.id,
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('requirement_project_mismatch');
    });

    it('falla con una priority fuera del enum', async () => {
      const reply = await dispatch('tasks.new', {
        creator: CREATOR, title: 'x', projectId, responsiblePersonIds: [personA],
        priority: 3,
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
    });

    it('falla sin title', async () => {
      const reply = await dispatch('tasks.new', {
        creator: CREATOR, projectId, responsiblePersonIds: [personA],
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
    });

    it('falla sin creator y sin sobre: ninguna fuente resuelve el actor', async () => {
      const reply = await dispatch('tasks.new', {
        title: 'x', projectId, responsiblePersonIds: [personA],
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
    });

    it('con sobre, creator es redundante: no hace falta mandarlo', async () => {
      const reply = await dispatch<{ id: number }>('tasks.new', {
        title: 'Con sobre', projectId, responsiblePersonIds: [personA],
        actor: { id: CREATOR, roles: ['user'] },
      });
      reply.status.should.equal('success');
      const task = await Objective.findByPk(reply.data!.id);
      // El `createdBy` sale de `actor.id`, no de un `creator` que nunca se mandó.
      task!.createdBy.should.equal(CREATOR);
    });
  });

  describe('tasks.{id}.edit', () => {
    let taskId: number;

    beforeEach(async () => {
      // estimatedFinishDate es STRING en la base, no DATE.
      const task = await Objective.create({
        title: 'Original', description: 'Descripción original', state: 'backlog',
        area: 'desarrollo', priority: 1, projectId, createdBy: CREATOR,
        estimatedFinishDate: '2026-03-01',
      });
      taskId = task.id;
      await PersonObjective.create({ personId: personA, objectiveId: task.id, isLeader: true });
    });

    it('edita solo los campos presentes', async () => {
      const reply = await dispatch(`tasks.${taskId}.edit`, { editor: CREATOR, title: 'Editada' });
      reply.status.should.equal('success');

      const task = await Objective.findByPk(taskId);
      task!.title.should.equal('Editada');
      task!.description.should.equal('Descripción original');
      // La api vaciaba estimatedFinishDate si no venía; el protocolo dice dejarlo.
      (task!.estimatedFinishDate === null).should.be.false();
    });

    it('vacía description con null', async () => {
      const reply = await dispatch(`tasks.${taskId}.edit`, { editor: CREATOR, description: null });
      reply.status.should.equal('success');
      const task = await Objective.findByPk(taskId);
      (task!.description === null).should.be.true();
    });

    it('registra la actividad de los campos que cambian', async () => {
      await dispatch(`tasks.${taskId}.edit`, {
        editor: CREATOR, title: 'Nuevo título', state: 'activo',
      });

      const activities = await ObjectiveActivity.findAll({ where: { objectiveId: taskId } });
      const types = activities.map((a) => a.typeOfActivity).sort();
      types.should.deepEqual(['state', 'title']);

      const title = activities.find((a) => a.typeOfActivity === 'title')!;
      title.previousValue.should.equal('Original');
      title.newValue.should.equal('Nuevo título');
      title.changedBy.should.equal(CREATOR);
      // title y state son públicos según visibility-helper
      title.visibilityLevel.should.equal('public');
    });

    it('no registra actividad si el valor no cambia', async () => {
      await dispatch(`tasks.${taskId}.edit`, { editor: CREATOR, title: 'Original' });
      (await ObjectiveActivity.count({ where: { objectiveId: taskId } })).should.equal(0);
    });

    it('registra priority como número', async () => {
      await dispatch(`tasks.${taskId}.edit`, { editor: CREATOR, priority: 'urgente' });

      const activity = await ObjectiveActivity.findOne({
        where: { objectiveId: taskId, typeOfActivity: 'priority' },
      });
      activity!.previousValue.should.equal('1');
      activity!.newValue.should.equal('4');
      // priority es un cambio operativo: interno
      activity!.visibilityLevel.should.equal('internal');

      const task = await Objective.findByPk(taskId);
      task!.priority.should.equal(4);
    });

    it('reemplaza los responsables por completo', async () => {
      const reply = await dispatch(`tasks.${taskId}.edit`, {
        editor: CREATOR,
        responsiblePersonIds: [personB],
      });
      reply.status.should.equal('success');

      const links = await PersonObjective.findAll({ where: { objectiveId: taskId } });
      links.length.should.equal(1);
      links[0].personId.should.equal(personB);
      links[0].isLeader.should.be.true();
    });

    it('falla si la task no existe', async () => {
      const reply = await dispatch('tasks.999999.edit', { editor: CREATOR, title: 'Fantasma' });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('objective_not_found');
    });

    it('falla sin editor y sin sobre: ninguna fuente resuelve el actor', async () => {
      const reply = await dispatch(`tasks.${taskId}.edit`, { title: 'Sin autor' });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
    });

    it('con sobre, editor es redundante: no hace falta mandarlo', async () => {
      const reply = await dispatch(`tasks.${taskId}.edit`, {
        title: 'Editada con sobre', actor: { id: CREATOR, roles: ['user'] },
      });
      reply.status.should.equal('success');

      const activity = await ObjectiveActivity.findOne({
        where: { objectiveId: taskId, typeOfActivity: 'title' },
      });
      // El `changedBy` sale de `actor.id`, no de un `editor` que nunca se mandó.
      activity!.changedBy.should.equal(CREATOR);
    });

    it('falla si una persona no existe y no toca la task', async () => {
      const reply = await dispatch(`tasks.${taskId}.edit`, {
        editor: CREATOR,
        title: 'No debería guardarse',
        responsiblePersonIds: [999999],
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('person_not_found');

      const task = await Objective.findByPk(taskId);
      task!.title.should.equal('Original');
    });
  });

  describe('tasks.{id}.comment', () => {
    let taskId: number;

    beforeEach(async () => {
      const task = await Objective.create({
        title: 'Para comentar', state: 'backlog', area: 'desarrollo', priority: 0,
        projectId, createdBy: CREATOR,
      });
      taskId = task.id;
    });

    it('crea el comentario con visibilidad interna por defecto', async () => {
      const reply = await dispatch<{ id: number }>(`tasks.${taskId}.comment`, {
        author: CREATOR, comment: 'Un comentario',
      });

      reply.status.should.equal('success');
      const activity = await ObjectiveActivity.findByPk(reply.data!.id);
      activity!.typeOfActivity.should.equal('comment');
      activity!.newValue.should.equal('Un comentario');
      activity!.visibilityLevel.should.equal('internal');
      activity!.changedBy.should.equal(CREATOR);
    });

    it('acepta visibilidad pública', async () => {
      const reply = await dispatch<{ id: number }>(`tasks.${taskId}.comment`, {
        author: CREATOR, comment: 'Público', visibilityLevel: 'public',
      });
      const activity = await ObjectiveActivity.findByPk(reply.data!.id);
      activity!.visibilityLevel.should.equal('public');
    });

    it('falla sin comment', async () => {
      const reply = await dispatch(`tasks.${taskId}.comment`, { author: CREATOR });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
    });

    it('falla sin author y sin sobre: ninguna fuente resuelve el actor', async () => {
      const reply = await dispatch(`tasks.${taskId}.comment`, { comment: 'x' });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
    });

    it('con sobre, author es redundante: no hace falta mandarlo', async () => {
      const reply = await dispatch<{ id: number }>(`tasks.${taskId}.comment`, {
        comment: 'Con sobre', actor: { id: CREATOR, roles: ['user'] },
      });
      reply.status.should.equal('success');
      const activity = await ObjectiveActivity.findByPk(reply.data!.id);
      // El `changedBy` sale de `actor.id`, no de un `author` que nunca se mandó.
      activity!.changedBy.should.equal(CREATOR);
    });

    it('falla si la task no existe', async () => {
      const reply = await dispatch('tasks.999999.comment', {
        author: CREATOR, comment: 'x',
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('objective_not_found');
    });
  });

  /** REQ-011 (S-046): `tasks.{id}.comment.{cid}.edit` — comando 23. */
  describe('tasks.{id}.comment.{cid}.edit', () => {
    let taskId: number;
    let cid: number;

    beforeEach(async () => {
      const task = await Objective.create({
        title: 'Para editar comentario', state: 'backlog', area: 'desarrollo', priority: 0,
        projectId, createdBy: CREATOR,
      });
      taskId = task.id;

      const activity = await ObjectiveActivity.create({
        typeOfActivity: 'comment',
        previousValue: '',
        newValue: 'texto original',
        visibilityLevel: 'internal',
        objectiveId: taskId,
        changedBy: CREATOR,
      });
      cid = activity.id;
    });

    it('TS-2: el mismo comando existe para tareas', async () => {
      const reply = await dispatch(`tasks.${taskId}.comment.${cid}.edit`, {
        editor: CREATOR, comment: 'texto editado',
      });

      reply.status.should.equal('success');
      (reply.data === undefined).should.be.true();
      const activity = await ObjectiveActivity.findByPk(cid);
      activity!.newValue.should.equal('texto editado');
      (activity!.editedBy as string).should.equal(CREATOR);
      (activity!.editedAt === null).should.be.false();
    });

    it('TS-6: el admin edita un comentario ajeno de una tarea', async () => {
      const reply = await dispatch(`tasks.${taskId}.comment.${cid}.edit`, {
        comment: 'x', actor: { id: ADMIN_ID_TASKS, roles: ['admin'] },
      });

      reply.status.should.equal('success');
      const activity = await ObjectiveActivity.findByPk(cid);
      (activity!.editedBy as string).should.equal(ADMIN_ID_TASKS);
      activity!.changedBy.should.equal(CREATOR);
    });

    it('TS-8: rechazo por falta de autoría (tareas)', async () => {
      const reply = await dispatch(`tasks.${taskId}.comment.${cid}.edit`, {
        comment: 'x', actor: { id: OTHER_USER, roles: ['user'] },
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.COMMENT_NOT_OWNED);
      const activity = await ObjectiveActivity.findByPk(cid);
      activity!.newValue.should.equal('texto original');
      (activity!.editedAt === null).should.be.true();
    });

    it('TS-11: rechazo sobre una actividad que no es comentario (tareas)', async () => {
      const titleActivity = await ObjectiveActivity.create({
        typeOfActivity: 'title',
        previousValue: 'antes',
        newValue: 'después',
        visibilityLevel: 'public',
        objectiveId: taskId,
        changedBy: CREATOR,
      });

      const reply = await dispatch(`tasks.${taskId}.comment.${titleActivity.id}.edit`, {
        editor: CREATOR, comment: 'x',
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.ACTIVITY_NOT_EDITABLE);
      const reread = await ObjectiveActivity.findByPk(titleActivity.id);
      reread!.newValue.should.equal('después');
    });

    it('TS-14: `visibilityLevel` en el payload se rechaza también en tareas', async () => {
      const reply = await dispatch(`tasks.${taskId}.comment.${cid}.edit`, {
        editor: CREATOR, comment: 'x', visibilityLevel: 'public',
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
      const activity = await ObjectiveActivity.findByPk(cid);
      activity!.visibilityLevel.should.equal('internal');
    });

    it('TS-19: comentario inexistente en tareas', async () => {
      const reply = await dispatch(`tasks.${taskId}.comment.999999.edit`, {
        editor: CREATOR, comment: 'x',
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.COMMENT_NOT_FOUND);
    });

    it('TS-21: el comentario existe pero pertenece a OTRA tarea', async () => {
      const otherTask = await Objective.create({
        title: 'Otra tarea', state: 'backlog', area: 'desarrollo', priority: 0,
        projectId, createdBy: CREATOR,
      });

      const reply = await dispatch(`tasks.${otherTask.id}.comment.${cid}.edit`, {
        editor: CREATOR, comment: 'x',
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.COMMENT_NOT_FOUND);
      const activity = await ObjectiveActivity.findByPk(cid);
      activity!.newValue.should.equal('texto original');
    });
  });
});


/**
 * S-003: `fileIds` en `tasks.new`, `tasks.{id}.edit` y `tasks.{id}.comment`.
 *
 * En `tasks.new` y `tasks.{id}.edit` esto es FUNCIONALIDAD NUEVA, no una traducción de campo:
 * hasta S-003 ninguno de los dos mencionaba adjuntos, pese a que sus `x-error-codes`
 * declaraban `invalid_attachment_id`.
 */
describe('tasks — vinculación de archivos (S-003)', () => {
  let projectId: number;
  let personId: number;
  let taskId: number;
  let fileSeq = 0;

  async function makeFile(overrides: Record<string, unknown> = {}): Promise<File> {
    fileSeq += 1;
    return File.create({
      fileName: 'informe.pdf',
      fileSize: 4194304,
      mimeType: 'application/pdf',
      storageKey: `grava-gestion/t/fixture-${fileSeq}.pdf`,
      storageBucket: 'test-bucket',
      storageRegion: 'us-east-1',
      byteStatus: ByteStatus.Pending,
      uploadedBy: UPLOADER_A,
      retentionStatus: RetentionStatus.Active,
      ...overrides,
    });
  }

  function newTask(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      creator: UPLOADER_A, title: 'T', projectId, responsiblePersonIds: [personId],
      ...overrides,
    };
  }

  before(async () => {
    for (const [id, username] of [
      [UPLOADER_A, 'uploader-a-tasks'], [UPLOADER_B, 'uploader-b-tasks'],
      [TRUSTED, 'api-su-tasks'],
    ] as [string, string][]) {
      await User.create({ id, name: id, username, email: `${username}@test.local` });
    }
    const project = await Project.create({
      name: 'Proyecto Files T', code: 'FILEST', status: 'activo', type: 'comercial',
      description: 'x', initDate: new Date(), createdBy: UPLOADER_A,
    });
    projectId = project.id;
    const person = await Person.create({
      firstName: 'Ana', lastName: 'T', enabled: true, initDate: new Date('2026-01-01'),
    });
    personId = person.id;
  });

  after(async () => {
    await Attachment.destroy({ where: {}, force: true });
    await File.destroy({ where: {} });
    await ObjectiveActivity.destroy({ where: {} });
    await PersonObjective.destroy({ where: {} });
    await Objective.destroy({ where: {} });
    await RequirementActivity.destroy({ where: {} });
    await Requirement.destroy({ where: {} });
    await Person.destroy({ where: {} });
    await Project.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  beforeEach(async () => {
    const task = await Objective.create({
      title: 'Para comentar', projectId, createdBy: UPLOADER_A, state: 'backlog',
      area: 'desarrollo', priority: 0, visibilityLevel: 'public',
    });
    taskId = task.id;
  });

  afterEach(async () => {
    await Attachment.destroy({ where: {}, force: true });
    await File.destroy({ where: {} });
    await ObjectiveActivity.destroy({ where: {} });
    await PersonObjective.destroy({ where: {} });
    await Objective.destroy({ where: {} });
    await RequirementActivity.destroy({ where: {} });
    await Requirement.destroy({ where: {} });
  });

  describe('tasks.new', () => {
    it('TS-30: vincula archivos a la tarea creada (funcionalidad nueva)', async () => {
      const [f1, f2] = [await makeFile(), await makeFile()];

      const reply = await dispatch<{ id: number }>(
        'tasks.new', newTask({ fileIds: [f1.id, f2.id] }), TRUSTED
      );

      reply.status.should.equal('success');
      const links = await Attachment.findAll({
        where: { entityType: 'objective', entityId: reply.data!.id },
      });
      links.length.should.equal(2);
      links.map((a) => a.fileId).sort().should.deepEqual([f1.id, f2.id].sort());
    });

    it('TS-31: con un archivo ajeno no queda ni la tarea ni las asignaciones', async () => {
      const ajeno = await makeFile({ uploadedBy: UPLOADER_B });

      const reply = await dispatch('tasks.new', newTask({ fileIds: [ajeno.id] }), TRUSTED);

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.FILE_NOT_OWNED);
      (await Objective.count({ where: { title: 'T' } })).should.equal(0);
      // El rollback descarta también las asignaciones.
      (await PersonObjective.count()).should.equal(0);
      (await Attachment.count()).should.equal(0);
    });

    it('TS-23: el mismo File puede quedar vinculado a un requisito y a una tarea', async () => {
      const f1 = await makeFile();
      const requirement = await dispatch<{ id: number }>('requirements.new', {
        creator: UPLOADER_A, title: 'R', description: 'd', projectId, fileIds: [f1.id],
      }, TRUSTED);
      requirement.status.should.equal('success');

      const task = await dispatch<{ id: number }>(
        'tasks.new', newTask({ fileIds: [f1.id] }), TRUSTED
      );

      task.status.should.equal('success');
      const links = await Attachment.findAll({ where: { fileId: f1.id } });
      links.length.should.equal(2);
      links.map((a) => a.entityType).sort().should.deepEqual(['objective', 'requirement']);
      // Dos vínculos, UN SOLO archivo: un solo objeto en el bucket.
      (await File.count({ where: { id: f1.id } })).should.equal(1);
    });

    it('TS-4/TS-19: rechaza `attachmentIds` y 11 `fileIds`', async () => {
      const conAttachments = await dispatch(
        'tasks.new', newTask({ attachmentIds: [1] }), TRUSTED
      );
      conAttachments.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);

      const conOnce = await dispatch(
        'tasks.new', newTask({ fileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }), TRUSTED
      );
      conOnce.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
      (await Objective.count({ where: { title: 'T' } })).should.equal(0);
    });
  });

  describe('tasks.{id}.edit', () => {
    let f1: File;
    let f2: File;
    let f3: File;

    beforeEach(async () => {
      [f1, f2, f3] = [await makeFile(), await makeFile(), await makeFile()];
      const seeded = await dispatch(`tasks.${taskId}.edit`, {
        editor: UPLOADER_A, fileIds: [f1.id, f2.id, f3.id],
      }, TRUSTED);
      seeded.status.should.equal('success');
    });

    function links(): Promise<Attachment[]> {
      return Attachment.findAll({
        where: { entityType: 'objective', entityId: taskId }, order: [['id', 'ASC']],
      });
    }

    it('TS-32: opera sobre el conjunto completo (funcionalidad nueva)', async () => {
      const reply = await dispatch(`tasks.${taskId}.edit`, {
        editor: UPLOADER_A, fileIds: [f1.id],
      }, TRUSTED);

      reply.status.should.equal('success');
      const remaining = await links();
      remaining.length.should.equal(1);
      remaining[0].fileId!.should.equal(f1.id);
      // Los File de los vínculos borrados se conservan.
      for (const file of [f2, f3]) {
        (await File.findByPk(file.id))!.should.be.ok();
      }
    });

    it('preserva la fila de los vínculos que siguen en el conjunto', async () => {
      const before = await links();
      const originalOfF1 = before.find((a) => a.fileId === f1.id)!;

      await dispatch(`tasks.${taskId}.edit`, {
        editor: UPLOADER_A, fileIds: [f1.id, f2.id],
      }, TRUSTED);

      const nowOfF1 = (await links()).find((a) => a.fileId === f1.id)!;
      nowOfF1.id.should.equal(originalOfF1.id);
      nowOfF1.createdAt.getTime().should.equal(originalOfF1.createdAt.getTime());
    });

    it('`fileIds` ausente no toca los vínculos', async () => {
      const before = await links();

      const reply = await dispatch(`tasks.${taskId}.edit`, {
        editor: UPLOADER_A, title: 'nuevo',
      }, TRUSTED);

      reply.status.should.equal('success');
      (await links()).map((a) => a.id).should.deepEqual(before.map((a) => a.id));
    });

    it('`fileIds: []` desvincula todo y conserva los File', async () => {
      const reply = await dispatch(`tasks.${taskId}.edit`, {
        editor: UPLOADER_A, fileIds: [],
      }, TRUSTED);

      reply.status.should.equal('success');
      (await links()).length.should.equal(0);
      for (const file of [f1, f2, f3]) {
        (await File.findByPk(file.id))!.should.be.ok();
      }
    });

    it('un archivo ajeno descarta también el resto de la edición', async () => {
      const ajeno = await makeFile({ uploadedBy: UPLOADER_B });

      const reply = await dispatch(`tasks.${taskId}.edit`, {
        editor: UPLOADER_A, title: 'nuevo', fileIds: [ajeno.id],
      }, TRUSTED);

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.FILE_NOT_OWNED);
      (await Objective.findByPk(taskId))!.title.should.equal('Para comentar');
      (await links()).length.should.equal(3);
    });

    it('TS-4/TS-19: rechaza `attachmentIds` y 11 `fileIds`', async () => {
      const conAttachments = await dispatch(`tasks.${taskId}.edit`, {
        editor: UPLOADER_A, attachmentIds: [1],
      }, TRUSTED);
      conAttachments.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);

      const conOnce = await dispatch(`tasks.${taskId}.edit`, {
        editor: UPLOADER_A, fileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      }, TRUSTED);
      conOnce.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);

      // Ninguna de las dos llegó a la base: los tres vínculos sembrados siguen intactos.
      (await links()).length.should.equal(3);
    });

    it('la vinculación no genera entrada de historial', async () => {
      await dispatch(`tasks.${taskId}.edit`, {
        editor: UPLOADER_A, fileIds: [f1.id],
      }, TRUSTED);

      (await ObjectiveActivity.count({ where: { objectiveId: taskId } })).should.equal(0);
    });
  });

  describe('tasks.{id}.comment', () => {
    it('TS-33: vincula al comentario ya creado', async () => {
      const f1 = await makeFile();

      const reply = await dispatch<{ id: number }>(`tasks.${taskId}.comment`, {
        author: UPLOADER_A, comment: 'hola', fileIds: [f1.id],
      }, TRUSTED);

      reply.status.should.equal('success');
      const links = await Attachment.findAll({ where: { fileId: f1.id } });
      links.length.should.equal(1);
      links[0].entityType.should.equal('objective_comment');
      links[0].entityId!.should.equal(reply.data!.id);
    });

    it('TS-22: `fileIds: []` es válido y no crea vínculos ni toca `files`', async () => {
      const f1 = await makeFile();

      const reply = await dispatch(`tasks.${taskId}.comment`, {
        author: UPLOADER_A, comment: 'hola', fileIds: [],
      }, TRUSTED);

      reply.status.should.equal('success');
      (await Attachment.count()).should.equal(0);
      (await File.findByPk(f1.id))!.byteStatus.should.equal(ByteStatus.Pending);
    });

    it('un archivo ajeno no deja el comentario', async () => {
      const ajeno = await makeFile({ uploadedBy: UPLOADER_B });

      const reply = await dispatch(`tasks.${taskId}.comment`, {
        author: UPLOADER_A, comment: 'hola', fileIds: [ajeno.id],
      }, TRUSTED);

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.FILE_NOT_OWNED);
      (await ObjectiveActivity.count({ where: { objectiveId: taskId } })).should.equal(0);
    });

    it('TS-4/TS-19: rechaza `attachmentIds` y 11 `fileIds`', async () => {
      const conAttachments = await dispatch(`tasks.${taskId}.comment`, {
        author: UPLOADER_A, comment: 'hola', attachmentIds: [1],
      }, TRUSTED);
      conAttachments.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);

      const conOnce = await dispatch(`tasks.${taskId}.comment`, {
        author: UPLOADER_A, comment: 'hola',
        fileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      }, TRUSTED);
      conOnce.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    });
  });

  /** REQ-011 (S-046): adjuntos de `tasks.{id}.comment.{cid}.edit`, vía `syncFileLinks`. */
  describe('tasks.{id}.comment.{cid}.edit — adjuntos (conjunto completo)', () => {
    it('TS-24: `fileIds: []` desvincula todo', async () => {
      const f1 = await makeFile();
      const seeded = await dispatch(`tasks.${taskId}.comment`, {
        author: UPLOADER_A, comment: 'con adjunto', fileIds: [f1.id],
      }, TRUSTED);
      seeded.status.should.equal('success');
      const seededCid = (seeded as { data?: { id: number } }).data!.id;

      const reply = await dispatch(`tasks.${taskId}.comment.${seededCid}.edit`, {
        editor: UPLOADER_A, comment: 'sin adjuntos', fileIds: [],
      }, TRUSTED);

      reply.status.should.equal('success');
      (await Attachment.count({
        where: { entityType: 'objective_comment', entityId: seededCid },
      })).should.equal(0);
      // Se borra el VÍNCULO, nunca el archivo.
      (await File.findByPk(f1.id))!.should.be.ok();
    });
  });

  describe('regresión transversal', () => {
    it('TS-35: ninguna entidad de tipo draft se escribe nunca', async () => {
      const f1 = await makeFile();
      await dispatch('tasks.new', newTask({ fileIds: [f1.id] }), TRUSTED);

      const f2 = await makeFile();
      await dispatch(`tasks.${taskId}.comment`, {
        author: UPLOADER_A, comment: 'hola', fileIds: [f2.id],
      }, TRUSTED);

      (await Attachment.count({
        where: {
          entityType: {
            [Op.in]: ['requirement_draft', 'objective_draft', 'comment_draft', 'comment', 'stage'],
          },
        },
      })).should.equal(0);
      (await Attachment.count()).should.equal(2);
    });
  });
});
