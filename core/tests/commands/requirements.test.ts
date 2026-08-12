import 'mocha';
import 'should';
import { Person, PersonRequirement, Project, Requirement, RequirementActivity, RequirementSubscriptor, User } from '@jiku/models';
import { dispatch } from '../helpers/dispatch';

const CREATOR = 'zitadel-sub-reqs';
const OTHER_USER = 'zitadel-sub-reqs-2';

describe('requirements', () => {
  let projectId: number;
  let personA: number;
  let personB: number;

  before(async () => {
    await User.create({
      id: CREATOR, name: 'Creador', username: 'creador-reqs', email: 'reqs@mail.com',
    });
    await User.create({
      id: OTHER_USER, name: 'Otro', username: 'otro-reqs', email: 'otro-reqs@mail.com',
    });
    const project = await Project.create({
      name: 'Proyecto Reqs', code: 'REQS', status: 'activo', type: 'comercial',
      description: 'x', initDate: new Date(), createdBy: CREATOR,
    });
    projectId = project.id;
    const a = await Person.create({
      firstName: 'Ana', lastName: 'R', enabled: true, initDate: new Date('2026-01-01'),
    });
    const b = await Person.create({
      firstName: 'Beto', lastName: 'R', enabled: true, initDate: new Date('2026-01-01'),
    });
    personA = a.id;
    personB = b.id;
  });

  after(async () => {
    await RequirementActivity.destroy({ where: {} });
    await RequirementSubscriptor.destroy({ where: {} });
    await PersonRequirement.destroy({ where: {} });
    await Requirement.destroy({ where: {} });
    await Person.destroy({ where: {} });
    await Project.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  afterEach(async () => {
    await RequirementActivity.destroy({ where: {} });
    await RequirementSubscriptor.destroy({ where: {} });
    await PersonRequirement.destroy({ where: {} });
    await Requirement.destroy({ where: {} });
  });

  describe('requirements.new', () => {
    it('crea un requisito con los defaults', async () => {
      const reply = await dispatch<{ id: number }>('requirements.new', {
        creator: CREATOR, title: 'Un requisito', description: 'Detalle', projectId,
      });

      reply.status.should.equal('success');
      const requirement = await Requirement.findByPk(reply.data!.id);
      requirement!.title.should.equal('Un requisito');
      requirement!.state.should.equal('analisis');
      requirement!.priority.should.equal('sin_prioridad');
      requirement!.visibilityLevel.should.equal('public');
      requirement!.createdBy.should.equal(CREATOR);
    });

    it('asigna responsables y deja líder al primero', async () => {
      const reply = await dispatch<{ id: number }>('requirements.new', {
        creator: CREATOR, title: 'Con responsables', description: 'x', projectId,
        responsiblePersonIds: [personA, personB],
      });

      const links = await PersonRequirement.findAll({
        where: { requirementId: reply.data!.id },
      });
      links.length.should.equal(2);
      links.find((l) => l.personId === personA)!.isLeader!.should.be.true();
      (links.find((l) => l.personId === personB)!.isLeader === null).should.be.true();
    });

    it('guarda tags', async () => {
      const reply = await dispatch<{ id: number }>('requirements.new', {
        creator: CREATOR, title: 'Con tags', description: 'x', projectId,
        tags: [{ key: 'origen', value: 'mail' }],
      });
      const requirement = await Requirement.findByPk(reply.data!.id);
      requirement!.tags![0].key.should.equal('origen');
    });

    it('falla si el proyecto no existe', async () => {
      const reply = await dispatch('requirements.new', {
        creator: CREATOR, title: 'x', description: 'y', projectId: 999999,
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('project_not_found');
    });

    it('falla si un responsable no existe', async () => {
      const reply = await dispatch('requirements.new', {
        creator: CREATOR, title: 'x', description: 'y', projectId,
        responsiblePersonIds: [999999],
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_responsible_person');
      (await Requirement.count()).should.equal(0);
    });

    it('falla sin description', async () => {
      const reply = await dispatch('requirements.new', {
        creator: CREATOR, title: 'x', projectId,
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
    });
  });

  describe('requirements.{id}.edit', () => {
    let requirementId: number;

    beforeEach(async () => {
      const requirement = await Requirement.create({
        title: 'Original', description: 'Descripción original', projectId,
        createdBy: CREATOR,
      });
      requirementId = requirement.id;
    });

    it('edita solo los campos presentes', async () => {
      const reply = await dispatch(`requirements.${requirementId}.edit`, {
        editor: CREATOR, title: 'Editado',
      });
      reply.status.should.equal('success');

      const requirement = await Requirement.findByPk(requirementId);
      requirement!.title.should.equal('Editado');
      requirement!.description.should.equal('Descripción original');
    });

    it('registra actividad de title, description y state', async () => {
      await dispatch(`requirements.${requirementId}.edit`, {
        editor: CREATOR, title: 'Nuevo', state: 'planificacion',
      });

      const activities = await RequirementActivity.findAll({
        where: { requirementId },
      });
      const types = activities.map((a) => a.typeOfActivity).sort();
      types.should.deepEqual(['state', 'title']);
      activities.forEach((a) => a.changedBy.should.equal(CREATOR));
    });

    it('completa las marcas de tiempo al cambiar de estado', async () => {
      await dispatch(`requirements.${requirementId}.edit`, {
        editor: CREATOR, state: 'desarrollo',
      });
      const requirement = await Requirement.findByPk(requirementId);
      (requirement!.inProgressAt === null).should.be.false();
    });

    it('reemplaza los responsables', async () => {
      await PersonRequirement.create({
        personId: personA, requirementId, isLeader: true,
      });

      const reply = await dispatch(`requirements.${requirementId}.edit`, {
        editor: CREATOR, responsiblePersonIds: [personB],
      });
      reply.status.should.equal('success');

      const links = await PersonRequirement.findAll({ where: { requirementId } });
      links.length.should.equal(1);
      links[0].personId.should.equal(personB);
    });

    it('falla sin editor', async () => {
      const reply = await dispatch(`requirements.${requirementId}.edit`, { title: 'x' });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
    });

    it('falla si el requisito no existe', async () => {
      const reply = await dispatch('requirements.999999.edit', {
        editor: CREATOR, title: 'x',
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('requirement_not_found');
    });
  });

  describe('requirements.{id}.resolve', () => {
    let requirementId: number;

    beforeEach(async () => {
      const requirement = await Requirement.create({
        title: 'Para resolver', description: 'x', projectId, createdBy: CREATOR,
        state: 'desarrollo',
      });
      requirementId = requirement.id;
    });

    it('resuelve y guarda el motivo', async () => {
      const reply = await dispatch(`requirements.${requirementId}.resolve`, {
        editor: CREATOR, type: 'error_interno', conclusion: 'Se corrigió',
        comment: 'Un comentario',
      });

      reply.status.should.equal('success');
      const requirement = await Requirement.findByPk(requirementId);
      requirement!.state.should.equal('resuelto');
      requirement!.resolutionType!.should.equal('error_interno');
      requirement!.resolutionConclusion!.should.equal('Se corrigió');
      requirement!.resolutionComment!.should.equal('Un comentario');
      (requirement!.finishedAt === null).should.be.false();
    });

    it('registra la actividad del cambio de estado', async () => {
      await dispatch(`requirements.${requirementId}.resolve`, {
        editor: CREATOR, type: 'otro',
      });

      const activity = await RequirementActivity.findOne({
        where: { requirementId, typeOfActivity: 'state' },
      });
      activity!.previousValue.should.equal('desarrollo');
      activity!.newValue.should.equal('resuelto');
    });

    it('exige conclusión para resolver una incidencia', async () => {
      const incidencia = await Requirement.create({
        title: 'Incidencia', description: 'x', projectId, createdBy: CREATOR,
        type: 'incidencia', state: 'desarrollo',
      });

      const reply = await dispatch(`requirements.${incidencia.id}.resolve`, {
        editor: CREATOR, type: 'error_interno',
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('resolution_required');

      const unchanged = await Requirement.findByPk(incidencia.id);
      unchanged!.state.should.equal('desarrollo');
    });

    it('falla sin type', async () => {
      const reply = await dispatch(`requirements.${requirementId}.resolve`, {
        editor: CREATOR,
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
    });
  });

  describe('requirements.{id}.comment', () => {
    let requirementId: number;

    beforeEach(async () => {
      const requirement = await Requirement.create({
        title: 'Para comentar', description: 'x', projectId, createdBy: CREATOR,
      });
      requirementId = requirement.id;
    });

    it('crea el comentario con visibilidad interna por defecto', async () => {
      const reply = await dispatch<{ id: number }>(`requirements.${requirementId}.comment`, {
        author: CREATOR, comment: 'Un comentario',
      });

      reply.status.should.equal('success');
      const activity = await RequirementActivity.findByPk(reply.data!.id);
      activity!.typeOfActivity.should.equal('comment');
      activity!.newValue.should.equal('Un comentario');
      activity!.visibilityLevel.should.equal('internal');
    });

    it('falla si el requisito no existe', async () => {
      const reply = await dispatch('requirements.999999.comment', {
        author: CREATOR, comment: 'x',
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('requirement_not_found');
    });
  });

  describe('requirements.{id}.subscriptors', () => {
    let requirementId: number;

    beforeEach(async () => {
      const requirement = await Requirement.create({
        title: 'Con suscriptores', description: 'x', projectId, createdBy: CREATOR,
      });
      requirementId = requirement.id;
    });

    it('suscribe a un usuario', async () => {
      const reply = await dispatch<{ id: number }>(
        `requirements.${requirementId}.subscriptors.new`,
        { userId: OTHER_USER }
      );

      reply.status.should.equal('success');
      const subscription = await RequirementSubscriptor.findByPk(reply.data!.id);
      subscription!.userId.should.equal(OTHER_USER);
    });

    it('falla si ya está suscripto', async () => {
      await dispatch(`requirements.${requirementId}.subscriptors.new`, { userId: OTHER_USER });
      const reply = await dispatch(`requirements.${requirementId}.subscriptors.new`, {
        userId: OTHER_USER,
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('already_subscribed');
    });

    it('falla si el usuario no existe', async () => {
      const reply = await dispatch(`requirements.${requirementId}.subscriptors.new`, {
        userId: 'inexistente',
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('user_not_found');
    });

    it('desuscribe', async () => {
      await RequirementSubscriptor.create({ requirementId, userId: OTHER_USER });

      const reply = await dispatch(
        `requirements.${requirementId}.subscriptors.${OTHER_USER}.delete`,
        {}
      );

      reply.status.should.equal('success');
      (await RequirementSubscriptor.count({ where: { requirementId } })).should.equal(0);
    });

    it('falla al desuscribir algo que no existe', async () => {
      const reply = await dispatch(
        `requirements.${requirementId}.subscriptors.${OTHER_USER}.delete`,
        {}
      );
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('subscription_not_found');
    });
  });
});
