import 'mocha';
import 'should';
import { Objective, ObjectiveActivity, Person, PersonObjective, Project, Requirement, User } from '@jiku/models';
import { dispatch } from '../helpers/dispatch';

const CREATOR = 'zitadel-sub-tasks';

describe('tasks', () => {
  let projectId: number;
  let otherProjectId: number;
  let personA: number;
  let personB: number;

  before(async () => {
    await User.create({
      id: CREATOR, name: 'Creador', username: 'creador-tasks', email: 'tasks@mail.com',
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
    await User.destroy({ where: { id: CREATOR } });
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

    it('falla sin editor: la actividad necesita un usuario real', async () => {
      const reply = await dispatch(`tasks.${taskId}.edit`, { title: 'Sin autor' });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
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

    it('falla si la task no existe', async () => {
      const reply = await dispatch('tasks.999999.comment', {
        author: CREATOR, comment: 'x',
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('objective_not_found');
    });
  });
});
