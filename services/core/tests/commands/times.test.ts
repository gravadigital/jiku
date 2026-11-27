import 'mocha';
import 'should';
import { Objective, Person, Project, Requirement, UnworkedTime, User, WorkedTime } from '@jiku/models';
import { dispatch } from '../helpers/dispatch';
import { HOY } from '../helpers/dates';

const CREATOR = 'zitadel-sub-times';
// LA FECHA DE LOS FIXTURES ES RELATIVA A HOY, y no es cosmética: desde S-031 la ventana de carga
// (C-40) vive en core, así que un literal del pasado —acá había `'2026-05-04'`— hace que estos 14
// despachos respondan `invalid_date_range` en vez de lo que cada test afirma. Ver `helpers/dates`.
const DATE = HOY;

describe('times', () => {
  let projectId: number;
  let otherProjectId: number;
  let personId: number;
  let taskId: number;
  let requirementId: number;

  before(async () => {
    await User.create({
      id: CREATOR, name: 'Creador', username: 'creador-times', email: 'times@mail.com',
    });
    const project = await Project.create({
      name: 'Proyecto Times', code: 'TIMES', status: 'activo', type: 'comercial',
      description: 'x', initDate: new Date(), createdBy: CREATOR,
    });
    projectId = project.id;
    const other = await Project.create({
      name: 'Otro Times', code: 'TIMES2', status: 'activo', type: 'comercial',
      description: 'x', initDate: new Date(), createdBy: CREATOR,
    });
    otherProjectId = other.id;
    const person = await Person.create({
      firstName: 'Ana', lastName: 'T', enabled: true, initDate: new Date('2026-01-01'),
    });
    personId = person.id;
    const task = await Objective.create({
      title: 'Task', state: 'backlog', area: 'desarrollo', priority: 0,
      projectId, createdBy: CREATOR,
    });
    taskId = task.id;
    const requirement = await Requirement.create({
      title: 'Req', description: 'x', projectId, createdBy: CREATOR,
    });
    requirementId = requirement.id;
  });

  after(async () => {
    await WorkedTime.destroy({ where: {} });
    await UnworkedTime.destroy({ where: {} });
    await Objective.destroy({ where: {} });
    await Requirement.destroy({ where: {} });
    await Person.destroy({ where: {} });
    await Project.destroy({ where: {} });
    await User.destroy({ where: { id: CREATOR } });
  });

  afterEach(async () => {
    await WorkedTime.destroy({ where: {} });
    await UnworkedTime.destroy({ where: {} });
  });

  describe('worked-times.new', () => {
    it('registra horas contra un proyecto', async () => {
      const reply = await dispatch<{ id: number }>('worked-times.new', {
        date: DATE, minutes: 120, projectId, personId,
      });

      reply.status.should.equal('success');
      const worked = await WorkedTime.findByPk(reply.data!.id);
      worked!.minutes.should.equal(120);
      worked!.projectId.should.equal(projectId);
      worked!.personId.should.equal(personId);
    });

    it('guarda taskId en la columna objectiveId', async () => {
      const reply = await dispatch<{ id: number }>('worked-times.new', {
        date: DATE, minutes: 60, projectId, personId, taskId,
      });

      const worked = await WorkedTime.findByPk(reply.data!.id);
      worked!.objectiveId.should.equal(taskId);
    });

    it('acepta requirementId', async () => {
      const reply = await dispatch<{ id: number }>('worked-times.new', {
        date: DATE, minutes: 60, projectId, personId, requirementId,
      });
      const worked = await WorkedTime.findByPk(reply.data!.id);
      worked!.requirementId!.should.equal(requirementId);
    });

    it('rechaza taskId y requirementId juntos', async () => {
      const reply = await dispatch('worked-times.new', {
        date: DATE, minutes: 60, projectId, personId, taskId, requirementId,
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
    });

    it('rechaza una fecha con formato inválido', async () => {
      const reply = await dispatch('worked-times.new', {
        date: '04-05-2026', minutes: 60, projectId, personId,
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
    });

    it('rechaza minutos menores a 1', async () => {
      const reply = await dispatch('worked-times.new', {
        date: DATE, minutes: 0, projectId, personId,
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
    });

    it('falla si el requisito es de otro proyecto', async () => {
      const otherRequirement = await Requirement.create({
        title: 'Otro', description: 'x', projectId: otherProjectId, createdBy: CREATOR,
      });

      const reply = await dispatch('worked-times.new', {
        date: DATE, minutes: 60, projectId, personId,
        requirementId: otherRequirement.id,
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('requirement_project_mismatch');
    });

    it('respeta el tope de 24 horas por día', async () => {
      await WorkedTime.create({ date: DATE, minutes: 1400, projectId, personId });

      const reply = await dispatch('worked-times.new', {
        date: DATE, minutes: 60, projectId, personId,
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('daily_limit_exceeded');
      reply.errorMessage!.should.match(/Minutos disponibles: 40/);
    });

    it('falla si la persona no existe', async () => {
      const reply = await dispatch('worked-times.new', {
        date: DATE, minutes: 60, projectId, personId: 999999,
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('person_not_found');
    });
  });

  describe('worked-times.{id}.delete', () => {
    it('borra el registro', async () => {
      const worked = await WorkedTime.create({
        date: DATE, minutes: 60, projectId, personId,
      });

      const reply = await dispatch(`worked-times.${worked.id}.delete`, {});
      reply.status.should.equal('success');
      (await WorkedTime.findByPk(worked.id) === null).should.be.true();
    });

    it('falla si no existe', async () => {
      const reply = await dispatch('worked-times.999999.delete', {});
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('worked_time_not_found');
    });
  });

  describe('unworked-times.new', () => {
    it('registra una ausencia', async () => {
      const reply = await dispatch<{ id: number }>('unworked-times.new', {
        date: DATE, minutes: 480, reason: 'vacaciones', personId,
      });

      reply.status.should.equal('success');
      const unworked = await UnworkedTime.findByPk(reply.data!.id);
      unworked!.reason.should.equal('vacaciones');
      unworked!.minutes.should.equal(480);
    });

    it('rechaza un motivo fuera del enum', async () => {
      const reply = await dispatch('unworked-times.new', {
        date: DATE, minutes: 60, reason: 'inventado', personId,
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
    });

    it('el tope diario suma horas trabajadas y no trabajadas', async () => {
      await WorkedTime.create({ date: DATE, minutes: 1000, projectId, personId });
      await UnworkedTime.create({ date: DATE, minutes: 400, reason: 'medico', personId });

      const reply = await dispatch('unworked-times.new', {
        date: DATE, minutes: 60, reason: 'tramite', personId,
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('daily_limit_exceeded');
      reply.errorMessage!.should.match(/Minutos disponibles: 40/);
    });

    it('falla si la persona no existe', async () => {
      const reply = await dispatch('unworked-times.new', {
        date: DATE, minutes: 60, reason: 'otro', personId: 999999,
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('person_not_found');
    });
  });

  describe('unworked-times.{id}.delete', () => {
    it('borra el registro', async () => {
      const unworked = await UnworkedTime.create({
        date: DATE, minutes: 60, reason: 'otro', personId,
      });

      const reply = await dispatch(`unworked-times.${unworked.id}.delete`, {});
      reply.status.should.equal('success');
      (await UnworkedTime.findByPk(unworked.id) === null).should.be.true();
    });

    it('falla si no existe', async () => {
      const reply = await dispatch('unworked-times.999999.delete', {});
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('unworked_time_not_found');
    });
  });
});
