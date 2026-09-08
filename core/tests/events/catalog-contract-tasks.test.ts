import 'mocha';
import 'should';
import {
  Client, Objective, ObjectiveActivity, Person, PersonObjective, Project, User,
} from '@jiku/models';
import { DomainEvent, TaskSnapshot } from '@jiku/nats-protocol';
import { dispatch, fakePublisher } from '../helpers/dispatch';
import { assertContract } from '../helpers/events-contract';
import { OBSERVED } from './catalog-contract.test';

/**
 * Los 6 eventos de TAREA del catálogo, verificados contra `docs/apis/core-events.yaml` (S-067,
 * Task 4, CA-4). Cierra CA-4 junto con `catalog-contract.test.ts` (los 10 de requisito): el gate
 * de completitud de los 16 vive en `catalog-completeness.test.ts`, aparte, para no depender del
 * orden de carga de mocha entre este archivo y ese.
 *
 * MUNDO PROPIO (D-5): no comparte fixtures con `catalog-contract.test.ts` — cada archivo arma y
 * limpia el suyo, para que ninguno dependa de que el otro haya corrido antes.
 *
 * NI UNA LÍNEA DE `core/src/` CAMBIA EN ESTA STORY.
 */

const CREATOR = 'zitadel-catalog-tasks-creator';

function ev(type: string): DomainEvent<TaskSnapshot> {
  const found = fakePublisher.published.find((p) => (p.payload as { type: string }).type === type);
  if (!found) {
    throw new Error(`No se publicó ningún evento de tipo "${type}"`);
  }
  return found.payload as DomainEvent<TaskSnapshot>;
}

/** Ver el comentario gemelo de `catalog-contract.test.ts`: valida TODO lo publicado del lote. */
function verifyPublished(): DomainEvent[] {
  return fakePublisher.published.map((p) => {
    assertContract(p);
    OBSERVED.add((p.payload as { type: string }).type);
    return p.payload as DomainEvent;
  });
}

describe('events/catalog-contract-tasks — los 6 eventos de TAREA contra core-events.yaml (S-067)', () => {
  let projectId: number;
  let personA: number;
  let personB: number;
  let personC: number;

  before(async () => {
    await User.create({
      id: CREATOR, name: 'Creador Catálogo Tareas', username: 'catalog-tasks-creator',
      email: 'catalog-tasks-creator@mail.com',
    });

    const client = await Client.create({ name: 'Cliente Catálogo Tareas S-067' });
    const project = await Project.create({
      name: 'Proyecto Catálogo Tareas S-067', code: 'CATT067', status: 'activo', type: 'comercial',
      description: 'Mundo mínimo de la suite del catálogo de tareas (S-067)', initDate: new Date(),
      createdBy: CREATOR, clientId: client.id,
    });
    projectId = project.id;

    const a = await Person.create({
      firstName: 'Tarea', lastName: 'A', enabled: true, initDate: new Date('2026-01-01'),
    });
    const b = await Person.create({
      firstName: 'Tarea', lastName: 'B', enabled: true, initDate: new Date('2026-01-01'),
    });
    const c = await Person.create({
      firstName: 'Tarea', lastName: 'C', enabled: true, initDate: new Date('2026-01-01'),
    });
    personA = a.id;
    personB = b.id;
    personC = c.id;
  });

  after(async () => {
    await ObjectiveActivity.destroy({ where: {} });
    await PersonObjective.destroy({ where: {} });
    await Objective.destroy({ where: {} });
    await Person.destroy({ where: {} });
    await Project.destroy({ where: {} });
    await Client.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  beforeEach(() => {
    fakePublisher.reset();
  });

  it('TS-34a · task.created cumple el contrato (con description)', async () => {
    const reply = await dispatch<{ id: number }>('tasks.new', {
      creator: CREATOR, title: 'Ajustar el layout móvil', description: 'El menú se corta en 320px',
      projectId, responsiblePersonIds: [personA, personB],
    });
    reply.status.should.equal('success');

    verifyPublished();
    const event = ev('task.created');
    event.entity.should.deepEqual({ type: 'task', id: reply.data!.id, projectId });
    ('recipients' in event).should.be.false(); // TS-34: los 6 de tarea NUNCA lo llevan
    (event.snapshot as TaskSnapshot).description!.should.equal('El menú se corta en 320px');
    (event.snapshot as TaskSnapshot).priority.should.be.a.String();
    (event.snapshot as TaskSnapshot).priorityValue.should.be.a.Number();
  });

  it('TS-34b · task.created SIN description ejercita el otro lado del nullable', async () => {
    const reply = await dispatch<{ id: number }>('tasks.new', {
      creator: CREATOR, title: 'Tarea sin descripción', projectId,
      responsiblePersonIds: [],
    });
    reply.status.should.equal('success');

    verifyPublished();
    const event = ev('task.created');
    ((event.snapshot as TaskSnapshot).description === null).should.be.true();
    ('recipients' in event).should.be.false();
  });

  describe('el ciclo de edición de una tarea (TS-34c a TS-34f)', () => {
    let id: number;

    before(async () => {
      const reply = await dispatch<{ id: number }>('tasks.new', {
        creator: CREATOR, title: 'Migrar el componente de tabla', description: 'Usa la lib vieja',
        projectId, responsiblePersonIds: [personA, personB],
      });
      id = reply.data!.id;
      fakePublisher.reset();
    });

    it('TS-34c · task.state.changed cumple el contrato', async () => {
      const reply = await dispatch(`tasks.${id}.edit`, { state: 'activo', editor: CREATOR });
      reply.status.should.equal('success');

      verifyPublished();
      const event = ev('task.state.changed');
      event.entity.type.should.equal('task');
      ('recipients' in event).should.be.false();
      event.changes!.should.deepEqual({ state: { from: 'backlog', to: 'activo' } });
    });

    it('TS-34d · task.updated cumple el contrato', async () => {
      const reply = await dispatch(`tasks.${id}.edit`, {
        title: 'Migrar la tabla a la lib nueva', description: 'Usa la lib vieja, deprecada',
        editor: CREATOR,
      });
      reply.status.should.equal('success');

      verifyPublished();
      const event = ev('task.updated');
      ('recipients' in event).should.be.false();
      Object.keys(event.changes!).sort().should.deepEqual(['description', 'title']);
    });

    it('TS-34e · task.assigned cumple el contrato', async () => {
      const reply = await dispatch(`tasks.${id}.edit`, {
        responsiblePersonIds: [personA, personB, personC], editor: CREATOR,
      });
      reply.status.should.equal('success');

      verifyPublished();
      const event = ev('task.assigned');
      ('recipients' in event).should.be.false();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (event.changes as any).responsiblePersonIds.should.deepEqual({
        from: [personA, personB], to: [personA, personB, personC],
      });
      (event.snapshot as TaskSnapshot).responsiblePersonIds.should.deepEqual(
        [personA, personB, personC]
      );
    });
  });

  describe('comentarios de tarea (TS-34f, TS-34g)', () => {
    let id: number;
    let commentId: number;

    before(async () => {
      const reply = await dispatch<{ id: number }>('tasks.new', {
        creator: CREATOR, title: 'Tarea para comentarios', projectId, responsiblePersonIds: [],
      });
      id = reply.data!.id;
      fakePublisher.reset();
    });

    it('TS-34f · task.comment.created cumple el contrato', async () => {
      const reply = await dispatch<{ id: number }>(`tasks.${id}.comment`, {
        comment: 'Falta el estado de error en el mock', author: CREATOR,
        visibilityLevel: 'internal',
      });
      reply.status.should.equal('success');
      commentId = reply.data!.id;

      verifyPublished();
      const event = ev('task.comment.created');
      ('recipients' in event).should.be.false();
      event.comment!.should.deepEqual({
        id: commentId, body: 'Falta el estado de error en el mock', fileIds: [],
      });
      event.visibilityLevel!.should.equal('internal');
    });

    it('TS-34g · task.comment.edited cumple el contrato', async () => {
      const reply = await dispatch(`tasks.${id}.comment.${commentId}.edit`, {
        comment: 'Falta el estado de error Y el de vacío en el mock', editor: CREATOR,
      });
      reply.status.should.equal('success');

      verifyPublished();
      const event = ev('task.comment.edited');
      ('recipients' in event).should.be.false();
      event.comment!.body.should.equal('Falta el estado de error Y el de vacío en el mock');
      Object.keys(event.changes!).sort().should.deepEqual(['editedAt', 'editedBy']);
    });
  });
});
