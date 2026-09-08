import 'mocha';
import 'should';
import { Op } from 'sequelize';
import { Attachment, ByteStatus, File, Objective, ObjectiveActivity, ObjectiveSubscriptor, Person, PersonObjective, Project, Requirement, RequirementActivity, RetentionStatus, User } from '@jiku/models';
import { DomainEvent, ErrorCode, TaskSnapshot } from '@jiku/nats-protocol';
import { dispatch, fakePublisher } from '../helpers/dispatch';

const CREATOR = 'zitadel-sub-tasks';
const OTHER_USER = 'zitadel-sub-tasks-2';
const ADMIN_ID_TASKS = 'zitadel-sub-tasks-admin';

/** Ver `requirements.test.ts`: el caller confiable se pide SIEMPRE explícito. */
const TRUSTED = 'api-service-user-sub';
const UPLOADER_A = 'zitadel-user-a-tasks';
const UPLOADER_B = 'zitadel-user-b-tasks';

/**
 * `ev(type)` de la tabla de Test Scenarios de S-065: el elemento de `fakePublisher.published`
 * cuyo `payload.type === type`. Lanza si no lo encuentra, para que el mensaje de falla del test
 * diga "no se publicó tal evento" en vez de un `undefined` opaco más abajo.
 */
function ev(type: string): DomainEvent<TaskSnapshot> {
  const found = fakePublisher.published.find((p) => (p.payload as { type: string }).type === type);
  if (!found) {
    throw new Error(`No se publicó ningún evento de tipo "${type}"`);
  }
  return found.payload as DomainEvent<TaskSnapshot>;
}

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

  // RIESGO DE REGRESIÓN Nº1 DE S-065 (ver ADR-013 del story plan): `fakePublisher` es un
  // SINGLETON DE MÓDULO compartido por TODO `dispatch()`, y este archivo nunca lo reseteaba
  // — no lo necesitaba, porque ningún comando de tarea emitía. Ahora que los cuatro emiten, el
  // reset va acá, en el `describe('tasks')` de MÁS AFUERA, y no solo en los `describe` nuevos:
  // cualquier `it()` de este archivo que dispare un comando de tarea deja publicaciones
  // acumuladas si no se limpia ANTES de cada test.
  beforeEach(() => {
    fakePublisher.reset();
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

    /** `task.created` de punta a punta (REQ-014 / S-065, CA-1, CA-2, CA-3). */
    describe('task.created — de punta a punta (S-065)', () => {
      it('TS-1, TS-3, TS-4 · publica con el subject del contrato y el sobre completo', async () => {
        const reply = await dispatch<{ id: number }>('tasks.new', {
          creator: CREATOR, title: 'Diseñar el export', projectId,
          responsiblePersonIds: [personA],
        });

        reply.status.should.equal('success');
        fakePublisher.published.length.should.equal(1);
        const { subject, payload } = fakePublisher.published[0];
        const event = payload as DomainEvent<TaskSnapshot>;

        subject.should.equal('dev.events.v1.task.created');
        event.type.should.equal('task.created');
        event.entity.should.deepEqual({ type: 'task', id: reply.data!.id, projectId });
        event.eventId.should.match(/^[0-9A-HJKMNP-TV-Z]{26}$/);
        event.version.should.equal('v1');
        event.occurredAt.should.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        event.correlationId.should.be.a.String().and.not.empty();
      });

      it('TS-2 · el snapshot trae EXACTAMENTE los 16 campos del contrato', async () => {
        await dispatch<{ id: number }>('tasks.new', {
          creator: CREATOR, title: 'T', projectId, responsiblePersonIds: [personA],
        });

        Object.keys(ev('task.created').snapshot).sort().should.deepEqual([
          'area', 'createdAt', 'createdBy', 'description', 'estimatedFinishDate', 'finishedAt',
          'id', 'priority', 'priorityValue', 'projectId', 'requirementId',
          'responsiblePersonIds', 'state', 'title', 'updatedAt', 'visibilityLevel',
        ].sort());
      });

      it('TS-5 · las dos formas de prioridad, coherentes con el mapeo real', async () => {
        const reply = await dispatch<{ id: number }>('tasks.new', {
          creator: CREATOR, title: 'T', projectId, responsiblePersonIds: [personA],
          priority: 'alta',
        });

        const snapshot = ev('task.created').snapshot;
        snapshot.priority.should.equal('alta');
        snapshot.priorityValue.should.equal(3);
        (await Objective.findByPk(reply.data!.id))!.priority.should.equal(3);
      });

      it('TS-6 · el priorityValue: 5 NO se colapsa en 4', async () => {
        await dispatch('tasks.new', {
          creator: CREATOR, title: 'T', projectId, responsiblePersonIds: [personA],
          priorityValue: 5,
        });

        const snapshot = ev('task.created').snapshot;
        snapshot.priorityValue.should.equal(5);
        snapshot.priority.should.equal('urgente');
      });

      it('TS-7 · el default sin_prioridad llega como 0 y como nombre', async () => {
        await dispatch('tasks.new', {
          creator: CREATOR, title: 'T', projectId, responsiblePersonIds: [personA],
        });

        const snapshot = ev('task.created').snapshot;
        snapshot.priority.should.equal('sin_prioridad');
        snapshot.priorityValue.should.equal(0);
      });

      it('TS-8 · sin recipients', async () => {
        await dispatch('tasks.new', {
          creator: CREATOR, title: 'T', projectId, responsiblePersonIds: [personA],
        });

        ('recipients' in ev('task.created')).should.be.false();
      });

      it('TS-9 · sin changes en un alta', async () => {
        await dispatch('tasks.new', {
          creator: CREATOR, title: 'T', projectId, responsiblePersonIds: [personA],
        });

        ('changes' in ev('task.created')).should.be.false();
      });

      it('TS-10 · description ausente viaja como null, nunca undefined ni vacío', async () => {
        await dispatch('tasks.new', {
          creator: CREATOR, title: 'T', projectId, responsiblePersonIds: [personA],
        });

        (ev('task.created').snapshot.description === null).should.be.true();
      });

      it('TS-11 · estimatedFinishDate viaja como YYYY-MM-DD, nunca como date-time', async () => {
        await dispatch('tasks.new', {
          creator: CREATOR, title: 'T', projectId, responsiblePersonIds: [personA],
          estimatedFinishDate: '2026-12-31',
        });

        const value = ev('task.created').snapshot.estimatedFinishDate!;
        value.should.equal('2026-12-31');
        value.should.not.match(/T\d{2}:\d{2}/);
      });

      it('TS-12 · estimatedFinishDate ausente viaja como null', async () => {
        await dispatch('tasks.new', {
          creator: CREATOR, title: 'T', projectId, responsiblePersonIds: [personA],
        });

        (ev('task.created').snapshot.estimatedFinishDate === null).should.be.true();
      });

      it('TS-13 · finishedAt de una tarea nueva es null', async () => {
        await dispatch('tasks.new', {
          creator: CREATOR, title: 'T', projectId, responsiblePersonIds: [personA],
        });

        (ev('task.created').snapshot.finishedAt === null).should.be.true();
      });

      it('TS-14 · requirementId viaja cuando se declara, y null cuando no', async () => {
        const requirement = await Requirement.create({
          title: 'Req', description: 'x', projectId, createdBy: CREATOR,
        });
        try {
          await dispatch('tasks.new', {
            creator: CREATOR, title: 'Con requisito', projectId, responsiblePersonIds: [personA],
            requirementId: requirement.id,
          });
          ev('task.created').snapshot.requirementId!.should.equal(requirement.id);

          fakePublisher.reset();
          await dispatch('tasks.new', {
            creator: CREATOR, title: 'Sin requisito', projectId, responsiblePersonIds: [personA],
          });
          (ev('task.created').snapshot.requirementId === null).should.be.true();
        } finally {
          await Requirement.destroy({ where: { id: requirement.id } });
        }
      });

      it('TS-15 · responsiblePersonIds conserva el orden del payload (el primero es el líder)', async () => {
        const reply = await dispatch<{ id: number }>('tasks.new', {
          creator: CREATOR, title: 'T', projectId, responsiblePersonIds: [personB, personA],
        });

        ev('task.created').snapshot.responsiblePersonIds.should.deepEqual([personB, personA]);
        const link = await PersonObjective.findOne({
          where: { objectiveId: reply.data!.id, personId: personB },
        });
        link!.isLeader.should.be.true();
      });

      it('TS-16 · lista de responsables vacía => [], no null', async () => {
        await dispatch('tasks.new', {
          creator: CREATOR, title: 'T', projectId, responsiblePersonIds: [],
        });

        ev('task.created').snapshot.responsiblePersonIds.should.deepEqual([]);
      });

      it('TS-17 · createdAt y updatedAt son ISO 8601 con milisegundos', async () => {
        await dispatch('tasks.new', {
          creator: CREATOR, title: 'T', projectId, responsiblePersonIds: [personA],
        });

        const snapshot = ev('task.created').snapshot;
        snapshot.createdAt.should.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        snapshot.updatedAt.should.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });

      it('TS-18 · un alta con proyecto inexistente no emite nada', async () => {
        const reply = await dispatch('tasks.new', {
          creator: CREATOR, title: 'T', projectId: 999999, responsiblePersonIds: [personA],
        });

        reply.errorCode!.should.equal('project_not_found');
        fakePublisher.published.length.should.equal(0);
      });

      it('TS-19 · un alta con persona inexistente no emite nada', async () => {
        const reply = await dispatch('tasks.new', {
          creator: CREATOR, title: 'T', projectId, responsiblePersonIds: [999999],
        });

        reply.errorCode!.should.equal('person_not_found');
        fakePublisher.published.length.should.equal(0);
      });

      it('TS-20 · un alta cuyo vínculo de archivo falla no emite nada', async () => {
        const reply = await dispatch('tasks.new', {
          creator: CREATOR, title: 'T', projectId, responsiblePersonIds: [personA],
          fileIds: [999999],
        });

        reply.status.should.equal('failure');
        fakePublisher.published.length.should.equal(0);
        (await Objective.count({ where: { title: 'T' } })).should.equal(0);
      });

      it('TS-21 · un requisito de otro proyecto no emite nada', async () => {
        const requirement = await Requirement.create({
          title: 'Req', description: 'x', projectId: otherProjectId, createdBy: CREATOR,
        });
        try {
          const reply = await dispatch('tasks.new', {
            creator: CREATOR, title: 'T', projectId, responsiblePersonIds: [personA],
            requirementId: requirement.id,
          });

          reply.errorCode!.should.equal('requirement_project_mismatch');
          fakePublisher.published.length.should.equal(0);
        } finally {
          await Requirement.destroy({ where: { id: requirement.id } });
        }
      });
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

    /**
     * `task.state.changed` / `task.updated` de punta a punta (REQ-014 / S-065, CA-1, CA-2, CA-4).
     * El fixture de este `describe` (`beforeEach` de arriba) crea la tarea con
     * `title: 'Original'`, `description: 'Descripción original'`, `state: 'backlog'`.
     */
    describe('task.state.changed / task.updated — eventos de dominio (S-065)', () => {
      it('TS-22, TS-23, TS-24 · un cambio de estado emite el evento con changes.state y el snapshot nuevo', async () => {
        const reply = await dispatch(`tasks.${taskId}.edit`, { editor: CREATOR, state: 'activo' });

        reply.status.should.equal('success');
        fakePublisher.published.length.should.equal(1);
        const { subject, payload } = fakePublisher.published[0];
        const event = payload as DomainEvent<TaskSnapshot>;

        subject.should.equal('dev.events.v1.task.state.changed');
        event.type.should.equal('task.state.changed');
        event.changes!.should.deepEqual({ state: { from: 'backlog', to: 'activo' } });
        event.snapshot.state.should.equal('activo');
      });

      it('TS-25 · entrar a finalizado: el hook setea finishedAt y el snapshot lo trae', async () => {
        await dispatch(`tasks.${taskId}.edit`, { editor: CREATOR, state: 'activo' });
        fakePublisher.reset();

        await dispatch(`tasks.${taskId}.edit`, { editor: CREATOR, state: 'finalizado' });

        const event = ev('task.state.changed');
        event.snapshot.finishedAt!.should.match(/^\d{4}-\d{2}-\d{2}T.*Z$/);
        const task = await Objective.findByPk(taskId);
        event.snapshot.finishedAt!.should.equal(task!.finishedAt!.toISOString());
      });

      it('TS-26 · salir de finalizado: el hook limpia finishedAt', async () => {
        await Objective.update(
          { state: 'finalizado', finishedAt: new Date() },
          { where: { id: taskId } }
        );
        fakePublisher.reset();

        await dispatch(`tasks.${taskId}.edit`, { editor: CREATOR, state: 'activo' });

        (ev('task.state.changed').snapshot.finishedAt === null).should.be.true();
        const task = await Objective.findByPk(taskId);
        (task!.finishedAt === null).should.be.true();
      });

      it('TS-27 · mandar el mismo estado no emite nada', async () => {
        const reply = await dispatch(`tasks.${taskId}.edit`, { editor: CREATOR, state: 'backlog' });

        reply.status.should.equal('success');
        fakePublisher.published.length.should.equal(0);
      });

      it('TS-28 · retroceso de estado: emite normalmente, sin validar progresión', async () => {
        await Objective.update({ state: 'finalizado' }, { where: { id: taskId } });
        fakePublisher.reset();

        await dispatch(`tasks.${taskId}.edit`, { editor: CREATOR, state: 'backlog' });

        ev('task.state.changed').changes!.should.deepEqual({
          state: { from: 'finalizado', to: 'backlog' },
        });
      });

      it('TS-29 · desde cancelado hacia adelante: también emite', async () => {
        await Objective.update({ state: 'cancelado' }, { where: { id: taskId } });
        fakePublisher.reset();

        await dispatch(`tasks.${taskId}.edit`, { editor: CREATOR, state: 'en_revision' });

        ev('task.state.changed').changes!.should.deepEqual({
          state: { from: 'cancelado', to: 'en_revision' },
        });
      });

      it('TS-30 · un edit sobre una tarea inexistente no emite nada', async () => {
        const reply = await dispatch('tasks.999999.edit', { editor: CREATOR, state: 'activo' });

        reply.errorCode!.should.equal('objective_not_found');
        fakePublisher.published.length.should.equal(0);
      });

      it('TS-31 · un edit que falla por persona inexistente no emite nada', async () => {
        const reply = await dispatch(`tasks.${taskId}.edit`, {
          editor: CREATOR, state: 'activo', responsiblePersonIds: [999999],
        });

        reply.errorCode!.should.equal('person_not_found');
        fakePublisher.published.length.should.equal(0);
      });

      it('TS-32 · un edit cuyo syncFileLinks falla no emite nada, y el estado no cambió (rollback)', async () => {
        const reply = await dispatch(`tasks.${taskId}.edit`, {
          editor: CREATOR, state: 'activo', fileIds: [999999],
        }, TRUSTED);

        reply.status.should.equal('failure');
        fakePublisher.published.length.should.equal(0);
        (await Objective.findByPk(taskId))!.state.should.equal('backlog');
      });

      it('TS-33 · cambiar solo el título emite updated con solo title', async () => {
        await dispatch(`tasks.${taskId}.edit`, {
          editor: CREATOR, title: 'Diseñar el export a XLSX',
        });

        const event = ev('task.updated');
        event.changes!.should.deepEqual({
          title: { from: 'Original', to: 'Diseñar el export a XLSX' },
        });
        ('description' in event.changes!).should.be.false();
      });

      it('TS-34 · cambiar solo la descripción emite updated con solo description', async () => {
        await dispatch(`tasks.${taskId}.edit`, { editor: CREATOR, description: 'texto nuevo' });

        const event = ev('task.updated');
        event.changes!.should.deepEqual({
          description: { from: 'Descripción original', to: 'texto nuevo' },
        });
        ('title' in event.changes!).should.be.false();
      });

      it('TS-35 · cambiar los dos emite UN updated con los dos', async () => {
        await dispatch(`tasks.${taskId}.edit`, {
          editor: CREATOR, title: 'T2', description: 'D2',
        });

        fakePublisher.published.length.should.equal(1);
        Object.keys(ev('task.updated').changes!).sort().should.deepEqual(['description', 'title']);
      });

      it('TS-36 · cambiar solo responsables NO emite nada (task.assigned es S-066)', async () => {
        const reply = await dispatch(`tasks.${taskId}.edit`, {
          editor: CREATOR, responsiblePersonIds: [personB],
        });

        reply.status.should.equal('success');
        fakePublisher.published.length.should.equal(0);
        const link = await PersonObjective.findOne({ where: { objectiveId: taskId, personId: personB } });
        link!.isLeader.should.be.true();
      });

      it('TS-37 · limpiar la descripción emite updated con to: null (el historial no lo registra)', async () => {
        await dispatch(`tasks.${taskId}.edit`, { editor: CREATOR, description: null });

        fakePublisher.published.length.should.equal(1);
        ev('task.updated').changes!.should.deepEqual({
          description: { from: 'Descripción original', to: null },
        });
        (await ObjectiveActivity.count({ where: { objectiveId: taskId } })).should.equal(0);
      });

      it('TS-38 · vaciar la descripción a "" también emite', async () => {
        await dispatch(`tasks.${taskId}.edit`, { editor: CREATOR, description: '' });

        ev('task.updated').changes!.should.deepEqual({
          description: { from: 'Descripción original', to: '' },
        });
      });

      it('TS-39 · mandar el mismo título no emite nada', async () => {
        const reply = await dispatch(`tasks.${taskId}.edit`, { editor: CREATOR, title: 'Original' });

        reply.status.should.equal('success');
        fakePublisher.published.length.should.equal(0);
      });

      it('TS-40 · priority no emite ningún evento, aunque sí deje historial', async () => {
        const reply = await dispatch(`tasks.${taskId}.edit`, { editor: CREATOR, priority: 'alta' });

        reply.status.should.equal('success');
        fakePublisher.published.length.should.equal(0);
        (await Objective.findByPk(taskId))!.priority.should.equal(3);
        (await ObjectiveActivity.count({
          where: { objectiveId: taskId, typeOfActivity: 'priority' },
        })).should.equal(1);
      });

      it('TS-41 · area no emite nada', async () => {
        await dispatch(`tasks.${taskId}.edit`, { editor: CREATOR, area: 'diseño' });
        fakePublisher.published.length.should.equal(0);
      });

      it('TS-42 · estimatedFinishDate no emite nada', async () => {
        await dispatch(`tasks.${taskId}.edit`, { editor: CREATOR, estimatedFinishDate: '2026-12-31' });
        fakePublisher.published.length.should.equal(0);
      });

      it('TS-43 · visibilityLevel y requirementId no emiten nada', async () => {
        await dispatch(`tasks.${taskId}.edit`, { editor: CREATOR, visibilityLevel: 'internal' });
        fakePublisher.published.length.should.equal(0);

        fakePublisher.reset();
        await dispatch(`tasks.${taskId}.edit`, { editor: CREATOR, requirementId: null });
        fakePublisher.published.length.should.equal(0);
      });

      it('TS-44 · un payload vacío no emite nada y no rompe', async () => {
        const reply = await dispatch(`tasks.${taskId}.edit`, { editor: CREATOR });

        reply.status.should.equal('success');
        fakePublisher.published.length.should.equal(0);
      });

      it('TS-45, TS-46 · título + estado en el mismo edit: dos eventos, mismo correlationId, mismo snapshot', async () => {
        await dispatch(`tasks.${taskId}.edit`, {
          editor: CREATOR, title: 'T2', state: 'activo',
        });

        fakePublisher.published.length.should.equal(2);
        const types = fakePublisher.published.map((p) => (p.payload as { type: string }).type);
        types.should.deepEqual(['task.state.changed', 'task.updated']);

        const [first, second] = fakePublisher.published.map((p) => p.payload as DomainEvent<TaskSnapshot>);
        first.correlationId.should.equal(second.correlationId);
        first.eventId.should.not.equal(second.eventId);
        first.snapshot.should.deepEqual(second.snapshot);
        first.snapshot.title.should.equal('T2');
        first.snapshot.state.should.equal('activo');
      });

      it('TS-47 · description viaja completa, nunca truncada (5000 caracteres)', async () => {
        await Objective.update({ description: 'A'.repeat(5000) }, { where: { id: taskId } });
        fakePublisher.reset();

        await dispatch(`tasks.${taskId}.edit`, { editor: CREATOR, description: 'B'.repeat(5000) });

        const event = ev('task.updated');
        (event.changes!.description as { from: string; to: string }).from.length.should.equal(5000);
        (event.changes!.description as { from: string; to: string }).to.length.should.equal(5000);
        event.snapshot.description!.length.should.equal(5000);
      });

      it('TS-48 · sin lista en el payload, el líder queda primero en el snapshot', async () => {
        await PersonObjective.destroy({ where: { objectiveId: taskId } });
        await PersonObjective.create({ personId: personB, objectiveId: taskId, isLeader: true });
        await PersonObjective.create({ personId: personA, objectiveId: taskId, isLeader: null as unknown as boolean });

        await dispatch(`tasks.${taskId}.edit`, { editor: CREATOR, state: 'activo' });

        const ids = ev('task.state.changed').snapshot.responsiblePersonIds;
        ids[0].should.equal(personB);
        ids.should.containEql(personA);
      });

      it('TS-49 · con lista en el payload, gana el orden del payload', async () => {
        await dispatch(`tasks.${taskId}.edit`, {
          editor: CREATOR, title: 'T2', responsiblePersonIds: [personB, personA],
        });

        ev('task.updated').snapshot.responsiblePersonIds.should.deepEqual([personB, personA]);
      });

      it('TS-94b · el lector devuelve los ids que quedaron después de un upsert de responsables', async () => {
        await dispatch(`tasks.${taskId}.edit`, {
          editor: CREATOR, state: 'activo', responsiblePersonIds: [personB, personA],
        });

        ev('task.state.changed').snapshot.responsiblePersonIds.should.deepEqual([personB, personA]);
        (await PersonObjective.count({ where: { objectiveId: taskId } })).should.equal(2);
      });
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

    /** `task.comment.created` de punta a punta (REQ-014 / S-065, CA-5, CA-6). */
    describe('task.comment.created — eventos de dominio (S-065)', () => {
      it('TS-50 · un comentario emite el evento con su subject', async () => {
        const reply = await dispatch<{ id: number }>(`tasks.${taskId}.comment`, {
          author: CREATOR, comment: 'El cliente pidió adelantar la entrega al 15.',
        });

        reply.status.should.equal('success');
        (reply.data!.id).should.be.a.Number();
        fakePublisher.published.length.should.equal(1);
        const { subject } = fakePublisher.published[0];
        subject.should.equal('dev.events.v1.task.comment.created');
      });

      it('TS-51 · comment va fuera de changes, con los tres campos del contrato', async () => {
        const reply = await dispatch<{ id: number }>(`tasks.${taskId}.comment`, {
          author: CREATOR, comment: 'El cliente pidió adelantar la entrega al 15.',
        });

        const event = ev('task.comment.created');
        event.comment!.should.deepEqual({
          id: reply.data!.id, body: 'El cliente pidió adelantar la entrega al 15.', fileIds: [],
        });
        ('changes' in event).should.be.false();
      });

      it('TS-52 · visibilityLevel de la raíz es del comentario; el del snapshot, de la tarea', async () => {
        await Objective.update({ visibilityLevel: 'public' }, { where: { id: taskId } });
        fakePublisher.reset();

        await dispatch(`tasks.${taskId}.comment`, {
          author: CREATOR, comment: 'x', visibilityLevel: 'internal',
        });

        const event = ev('task.comment.created');
        event.visibilityLevel!.should.equal('internal');
        event.snapshot.visibilityLevel.should.equal('public');
      });

      it('TS-53 · el default de visibilidad del comando llega al evento', async () => {
        await dispatch(`tasks.${taskId}.comment`, { author: CREATOR, comment: 'x' });

        ev('task.comment.created').visibilityLevel!.should.equal('internal');
      });

      it('TS-54 · un comentario internal viaja por el mismo subject que uno public, con el body completo', async () => {
        await dispatch(`tasks.${taskId}.comment`, {
          author: CREATOR, comment: 'interno', visibilityLevel: 'internal',
        });
        const internalSubject = fakePublisher.published[0].subject;
        fakePublisher.reset();

        await dispatch(`tasks.${taskId}.comment`, {
          author: CREATOR, comment: 'público', visibilityLevel: 'public',
        });
        const publicSubject = fakePublisher.published[0].subject;

        internalSubject.should.equal('dev.events.v1.task.comment.created');
        publicSubject.should.equal('dev.events.v1.task.comment.created');
        ev('task.comment.created').comment!.body.should.equal('público');
      });

      it('TS-55 · fileIds trae el conjunto vinculado, leído de attachments', async () => {
        const file = await File.create({
          fileName: 'x.pdf', fileSize: 100, mimeType: 'application/pdf',
          storageKey: `grava-gestion/tasks-comment/${Math.random().toString(36).slice(2)}.pdf`,
          storageBucket: 'test-bucket', storageRegion: 'us-east-1', uploadedBy: CREATOR,
          byteStatus: ByteStatus.Pending, retentionStatus: RetentionStatus.Active,
        });
        try {
          await dispatch(`tasks.${taskId}.comment`, {
            author: CREATOR, comment: 'x', fileIds: [file.id],
          });

          const event = ev('task.comment.created');
          event.comment!.fileIds.should.deepEqual([file.id]);
          const attachment = await Attachment.findOne({ where: { fileId: file.id } });
          attachment!.entityType.should.equal('objective_comment');
        } finally {
          await Attachment.destroy({ where: { fileId: file.id }, force: true });
          await File.destroy({ where: { id: file.id } });
        }
      });

      it('TS-56 · el snapshot es de la tarea, no del comentario', async () => {
        await dispatch(`tasks.${taskId}.comment`, { author: CREATOR, comment: 'x' });

        const event = ev('task.comment.created');
        event.snapshot.id.should.equal(taskId);
        event.snapshot.title.should.equal('Para comentar');
        event.entity.should.deepEqual({ type: 'task', id: taskId, projectId });
      });

      it('TS-57 · sin recipients', async () => {
        await dispatch(`tasks.${taskId}.comment`, { author: CREATOR, comment: 'x' });
        ('recipients' in ev('task.comment.created')).should.be.false();
      });

      it('TS-58 · un comentario cuyo vínculo de archivo falla no emite nada', async () => {
        const reply = await dispatch(`tasks.${taskId}.comment`, {
          author: CREATOR, comment: 'x', fileIds: [999999],
        });

        reply.status.should.equal('failure');
        fakePublisher.published.length.should.equal(0);
        (await ObjectiveActivity.count({ where: { objectiveId: taskId } })).should.equal(0);
      });

      it('TS-59 · un comentario sobre una tarea inexistente no emite nada', async () => {
        const reply = await dispatch('tasks.999999.comment', { author: CREATOR, comment: 'x' });

        reply.errorCode!.should.equal('objective_not_found');
        fakePublisher.published.length.should.equal(0);
        (await ObjectiveActivity.count()).should.equal(0);
      });
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

    /** `task.comment.edited` de punta a punta (REQ-014 / S-065, CA-5, CA-7, D-6). */
    describe('task.comment.edited — eventos de dominio (S-065)', () => {
      it('TS-60 · editar un comentario emite el evento con el texto ACTUAL', async () => {
        const reply = await dispatch(`tasks.${taskId}.comment.${cid}.edit`, {
          editor: CREATOR, comment: 'texto nuevo',
        });

        reply.status.should.equal('success');
        fakePublisher.published.length.should.equal(1);
        const { subject } = fakePublisher.published[0];
        subject.should.equal('dev.events.v1.task.comment.edited');
        ev('task.comment.edited').comment!.body.should.equal('texto nuevo');
      });

      it('TS-61 · no hay from del texto en ninguna parte', async () => {
        await dispatch(`tasks.${taskId}.comment.${cid}.edit`, {
          editor: CREATOR, comment: 'texto nuevo',
        });

        const event = ev('task.comment.edited');
        JSON.stringify(event).should.not.containEql('texto original');
        ('body' in event.changes!).should.be.false();
      });

      it('TS-62 · changes lleva solo editedAt y editedBy, iguales a los de la fila', async () => {
        await dispatch(`tasks.${taskId}.comment.${cid}.edit`, {
          editor: CREATOR, comment: 'texto nuevo',
        });

        const event = ev('task.comment.edited');
        Object.keys(event.changes!).sort().should.deepEqual(['editedAt', 'editedBy']);
        event.changes!.editedBy!.should.equal(CREATOR);
        const activity = await ObjectiveActivity.findByPk(cid);
        (event.changes!.editedAt as string).should.equal(activity!.editedAt!.toISOString());
      });

      it('TS-63 · visibilityLevel NUNCA aparece en changes', async () => {
        await dispatch(`tasks.${taskId}.comment.${cid}.edit`, {
          editor: CREATOR, comment: 'texto nuevo',
        });

        const event = ev('task.comment.edited');
        ('visibilityLevel' in event.changes!).should.be.false();
        event.visibilityLevel!.should.equal('internal');
      });

      it('TS-64 · fileIds es el conjunto completo que queda, no un delta', async () => {
        const [fileA, fileB] = await Promise.all([
          File.create({
            fileName: 'a.pdf', fileSize: 1, mimeType: 'application/pdf',
            storageKey: `grava-gestion/tasks-cedit/${Math.random().toString(36).slice(2)}.pdf`,
            storageBucket: 'test-bucket', storageRegion: 'us-east-1', uploadedBy: CREATOR,
            byteStatus: ByteStatus.Pending, retentionStatus: RetentionStatus.Active,
          }),
          File.create({
            fileName: 'b.pdf', fileSize: 1, mimeType: 'application/pdf',
            storageKey: `grava-gestion/tasks-cedit/${Math.random().toString(36).slice(2)}.pdf`,
            storageBucket: 'test-bucket', storageRegion: 'us-east-1', uploadedBy: CREATOR,
            byteStatus: ByteStatus.Pending, retentionStatus: RetentionStatus.Active,
          }),
        ]);
        try {
          await Attachment.create({
            entityType: 'objective_comment', entityId: cid, fileId: fileA.id,
          });
          await Attachment.create({
            entityType: 'objective_comment', entityId: cid, fileId: fileB.id,
          });

          await dispatch(`tasks.${taskId}.comment.${cid}.edit`, {
            editor: CREATOR, comment: 'nuevo', fileIds: [fileA.id],
          });

          ev('task.comment.edited').comment!.fileIds.should.deepEqual([fileA.id]);
        } finally {
          await Attachment.destroy({ where: { fileId: [fileA.id, fileB.id] }, force: true });
          await File.destroy({ where: { id: [fileA.id, fileB.id] } });
        }
      });

      it('TS-65, TS-66 · fileIds ausente trae el conjunto vigente, y un vínculo borrado no cuenta', async () => {
        const [fileA, fileDeleted] = await Promise.all([
          File.create({
            fileName: 'a.pdf', fileSize: 1, mimeType: 'application/pdf',
            storageKey: `grava-gestion/tasks-cedit2/${Math.random().toString(36).slice(2)}.pdf`,
            storageBucket: 'test-bucket', storageRegion: 'us-east-1', uploadedBy: CREATOR,
            byteStatus: ByteStatus.Pending, retentionStatus: RetentionStatus.Active,
          }),
          File.create({
            fileName: 'del.pdf', fileSize: 1, mimeType: 'application/pdf',
            storageKey: `grava-gestion/tasks-cedit2/${Math.random().toString(36).slice(2)}.pdf`,
            storageBucket: 'test-bucket', storageRegion: 'us-east-1', uploadedBy: CREATOR,
            byteStatus: ByteStatus.Pending, retentionStatus: RetentionStatus.Active,
          }),
        ]);
        try {
          await Attachment.create({
            entityType: 'objective_comment', entityId: cid, fileId: fileA.id,
          });
          await Attachment.create({
            entityType: 'objective_comment', entityId: cid, fileId: fileDeleted.id,
            deletedAt: new Date(),
          });

          await dispatch(`tasks.${taskId}.comment.${cid}.edit`, {
            editor: CREATOR, comment: 'nuevo',
          });

          ev('task.comment.edited').comment!.fileIds.should.deepEqual([fileA.id]);
        } finally {
          await Attachment.destroy({ where: { fileId: [fileA.id, fileDeleted.id] }, force: true });
          await File.destroy({ where: { id: [fileA.id, fileDeleted.id] } });
        }
      });

      it('TS-67 · el snapshot es de la tarea (el findByPk nuevo, D-6)', async () => {
        await dispatch(`tasks.${taskId}.comment.${cid}.edit`, {
          editor: CREATOR, comment: 'texto nuevo',
        });

        const event = ev('task.comment.edited');
        event.snapshot.id.should.equal(taskId);
        event.entity.should.deepEqual({ type: 'task', id: taskId, projectId });
        event.snapshot.priorityValue.should.be.a.Number();
      });

      it('TS-68 · un admin que edita el comentario de otro: actor es el admin, autoría original intacta', async () => {
        await dispatch(`tasks.${taskId}.comment.${cid}.edit`, {
          comment: 'editado por admin', actor: { id: ADMIN_ID_TASKS, roles: ['admin'] },
        });

        const event = ev('task.comment.edited');
        event.actor.id.should.equal(ADMIN_ID_TASKS);
        event.changes!.editedBy!.should.equal(ADMIN_ID_TASKS);
        const activity = await ObjectiveActivity.findByPk(cid);
        activity!.changedBy.should.equal(CREATOR);
      });

      it('TS-69 · editar una actividad que no es comentario no emite nada', async () => {
        const titleActivity = await ObjectiveActivity.create({
          typeOfActivity: 'title', previousValue: 'antes', newValue: 'después',
          visibilityLevel: 'public', objectiveId: taskId, changedBy: CREATOR,
        });

        const reply = await dispatch(`tasks.${taskId}.comment.${titleActivity.id}.edit`, {
          editor: CREATOR, comment: 'x',
        });

        reply.errorCode!.should.equal(ErrorCode.ACTIVITY_NOT_EDITABLE);
        fakePublisher.published.length.should.equal(0);
      });

      it('TS-70 · un no-autor sin rol admin no emite nada', async () => {
        const reply = await dispatch(`tasks.${taskId}.comment.${cid}.edit`, {
          editor: OTHER_USER, comment: 'x',
        });

        reply.errorCode!.should.equal(ErrorCode.COMMENT_NOT_OWNED);
        fakePublisher.published.length.should.equal(0);
      });

      it('TS-71 · un comentario inexistente no emite nada, y sigue respondiendo comment_not_found', async () => {
        const reply = await dispatch(`tasks.${taskId}.comment.999999.edit`, {
          editor: CREATOR, comment: 'x',
        });

        reply.errorCode!.should.equal(ErrorCode.COMMENT_NOT_FOUND);
        fakePublisher.published.length.should.equal(0);
      });

      it('TS-72 · un comentario de OTRA tarea sigue respondiendo comment_not_found, sin emitir', async () => {
        const otherTask = await Objective.create({
          title: 'Otra tarea', state: 'backlog', area: 'desarrollo', priority: 0,
          projectId, createdBy: CREATOR,
        });

        const reply = await dispatch(`tasks.${otherTask.id}.comment.${cid}.edit`, {
          editor: CREATOR, comment: 'x',
        });

        reply.errorCode!.should.equal(ErrorCode.COMMENT_NOT_FOUND);
        fakePublisher.published.length.should.equal(0);
      });
    });
  });

  /** `recipients` y `actor` transversales a los 5 eventos (REQ-014 / S-065, CA-3, CA-7). */
  describe('recipients y actor transversales (S-065)', () => {
    let taskId: number;

    beforeEach(async () => {
      const task = await Objective.create({
        title: 'Transversal', description: 'D', state: 'backlog', area: 'desarrollo',
        priority: 0, projectId, createdBy: CREATOR,
      });
      taskId = task.id;
    });

    /** Produce los 5 tipos de evento en una sola corrida: alta, edit de estado+título, comentario,
     * edición de comentario. `tasks.new` es la única fuente de `task.created`. */
    async function runAllFive(): Promise<void> {
      const created = await dispatch<{ id: number }>('tasks.new', {
        creator: CREATOR, title: 'T', projectId, responsiblePersonIds: [],
      });
      const id = created.data!.id;
      await dispatch(`tasks.${id}.edit`, { editor: CREATOR, title: 'T2', state: 'activo' });
      const commented = await dispatch<{ id: number }>(`tasks.${id}.comment`, {
        author: CREATOR, comment: 'x',
      });
      await dispatch(`tasks.${id}.comment.${commented.data!.id}.edit`, {
        editor: CREATOR, comment: 'editado',
      });
    }

    it('TS-73 · ninguno de los 5 eventos lleva recipients', async () => {
      await runAllFive();

      fakePublisher.published.length.should.equal(5);
      fakePublisher.published.forEach(({ payload }) => {
        ('recipients' in (payload as object)).should.be.false();
      });
    });

    it('TS-74 · con filas en objectives_subscriptors, el bloque sigue sin aparecer', async () => {
      await ObjectiveSubscriptor.create({ objectiveId: taskId, userId: OTHER_USER });
      try {
        await dispatch(`tasks.${taskId}.edit`, { editor: CREATOR, title: 'T2' });

        ('recipients' in ev('task.updated')).should.be.false();
      } finally {
        await ObjectiveSubscriptor.destroy({ where: { objectiveId: taskId } });
      }
    });

    it('TS-75 · actor.name sale del sobre cuando viene con name', async () => {
      await dispatch(`tasks.${taskId}.edit`, {
        title: 'T2', actor: { id: ADMIN_ID_TASKS, roles: ['admin'], name: 'Lautaro Alvarez' },
      });

      ev('task.updated').actor.should.deepEqual({ id: ADMIN_ID_TASKS, name: 'Lautaro Alvarez' });
    });

    it('TS-76, TS-78 · fallback a email cuando el sobre no trae name, y email nunca viaja', async () => {
      await dispatch(`tasks.${taskId}.edit`, {
        title: 'T2', actor: { id: ADMIN_ID_TASKS, roles: ['admin'], email: 'admin@x.com' },
      });

      const event = ev('task.updated');
      event.actor.should.deepEqual({ id: ADMIN_ID_TASKS, name: 'admin@x.com' });
      ('email' in event.actor).should.be.false();
    });

    it('TS-77 · fallback al id sin sobre', async () => {
      await dispatch(`tasks.${taskId}.edit`, { editor: CREATOR, title: 'T2' });

      ev('task.updated').actor.should.deepEqual({ id: CREATOR, name: CREATOR });
    });

    it('TS-79 · los 5 eventos llevan actor.name', async () => {
      await runAllFive();

      fakePublisher.published.length.should.equal(5);
      fakePublisher.published.forEach(({ payload }) => {
        ('name' in (payload as DomainEvent<TaskSnapshot>).actor).should.be.true();
      });
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
