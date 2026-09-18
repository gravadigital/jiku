import 'mocha';
import 'should';
import {
  Client, Person, PersonRequirement, Project, Requirement, RequirementActivity,
  RequirementSubscriptor, User,
} from '@jiku/models';
import { DomainEvent, RequirementSnapshot } from '@jiku/nats-protocol';
import { dispatch, fakePublisher } from '../helpers/dispatch';
import { assertContract } from '../helpers/events-contract';

/**
 * Los 10 eventos de REQUISITO del catálogo, verificados de punta a punta contra
 * `docs/apis/core-events.yaml` (S-067, Task 3, CA-4). Es la mitad de la suite del catálogo: la
 * Task 4 cierra con los 6 de tarea y el gate de completitud (TS-35).
 *
 * MUNDO MÍNIMO PROPIO (D-5): NO reusa los cinco mundos de fixtures de `tests/queries/` —esos
 * están armados para el plano de LECTURA y traen mucho más de lo que esta suite necesita—. El
 * mundo acá es: 1 cliente, 1 proyecto, 3 personas, 1 usuario suscriptor CON email, y 1 usuario de
 * SERVICIO con `email: null` — el único valor `nullable` de `EventRecipients.subscriptors`, y la
 * razón de que este usuario exista en el mundo mínimo (D-5).
 *
 * NI UNA LÍNEA DE `core/src/` CAMBIA EN ESTA STORY: si una verificación descubre una divergencia
 * entre el código y el contrato, se REPORTA (Task 7), no se arregla acá.
 */

const CREATOR = 'zitadel-catalog-creator';
const SUBSCRIPTOR_USER = 'zitadel-catalog-subscriptor';
const SERVICE_USER = 'zitadel-catalog-service';

/**
 * Los `type` de evento observados y verificados por ESTE archivo y por
 * `catalog-contract-tasks.test.ts` (Task 4). Un `Set` de módulo compartido, y no un archivo
 * temporal: mocha carga los dos archivos de escenarios en el MISMO proceso Node (D de la Task 3),
 * así que un módulo compartido alcanza. El gate de completitud NO vive acá — vive en
 * `catalog-completeness.test.ts` (Task 4), que fuerza el orden de carga con un `require`
 * explícito de los dos archivos de escenarios: el orden de carga de mocha por sí solo NO está
 * garantizado.
 */
export const OBSERVED = new Set<string>();

/** El elemento de `fakePublisher.published` cuyo `payload.type === type`. Lanza si no lo encuentra. */
function ev(type: string): DomainEvent<RequirementSnapshot> {
  const found = fakePublisher.published.find((p) => (p.payload as { type: string }).type === type);
  if (!found) {
    throw new Error(`No se publicó ningún evento de tipo "${type}"`);
  }
  return found.payload as DomainEvent<RequirementSnapshot>;
}

/**
 * Corre `assertContract()` sobre TODO lo acumulado en `fakePublisher.published` desde el último
 * `reset()`, y acumula los `type` en `OBSERVED`. Se usa así, y no evento por evento, porque un
 * solo `edit` puede declarar hasta 4 eventos EN EL MISMO LOTE (`requirements.{id}.edit`) y los
 * cuatro tienen que cumplir el contrato, no solo el que el test nombra explícitamente.
 */
function verifyPublished(): DomainEvent[] {
  return fakePublisher.published.map((p) => {
    assertContract(p);
    OBSERVED.add((p.payload as { type: string }).type);
    return p.payload as DomainEvent;
  });
}

describe('events/catalog-contract — los 10 eventos de REQUISITO contra core-events.yaml (S-067)', () => {
  let projectId: number;
  let personA: number;
  let personB: number;
  let personC: number;

  before(async () => {
    await User.create({
      id: CREATOR, name: 'Creador Catálogo', username: 'catalog-creator',
      email: 'catalog-creator@mail.com',
    });
    await User.create({
      id: SUBSCRIPTOR_USER, name: 'Suscriptor Catálogo', username: 'catalog-subscriptor',
      email: 'catalog-subscriptor@mail.com',
    });
    // SIN email: la identidad de servicio del mundo mínimo (D-5). Ejercita el `null` deliberado
    // de `EventRecipients.subscriptors[].email` — TS-32.
    await User.create({
      id: SERVICE_USER, name: 'Servicio Catálogo', username: 'catalog-service', email: null,
    });

    const client = await Client.create({ name: 'Cliente Catálogo S-067' });
    const project = await Project.create({
      name: 'Proyecto Catálogo S-067', code: 'CAT067', status: 'activo', type: 'comercial',
      description: 'Mundo mínimo de la suite del catálogo (S-067)', initDate: new Date(),
      createdBy: CREATOR, clientId: client.id,
    });
    projectId = project.id;

    const a = await Person.create({
      firstName: 'Persona', lastName: 'A', enabled: true, initDate: new Date('2026-01-01'),
    });
    const b = await Person.create({
      firstName: 'Persona', lastName: 'B', enabled: true, initDate: new Date('2026-01-01'),
    });
    const c = await Person.create({
      firstName: 'Persona', lastName: 'C', enabled: true, initDate: new Date('2026-01-01'),
    });
    personA = a.id;
    personB = b.id;
    personC = c.id;
  });

  after(async () => {
    await RequirementActivity.destroy({ where: {} });
    await RequirementSubscriptor.destroy({ where: {} });
    await PersonRequirement.destroy({ where: {} });
    await Requirement.destroy({ where: {} });
    await Person.destroy({ where: {} });
    await Project.destroy({ where: {} });
    await Client.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  // `fakePublisher` es un SINGLETON DE MÓDULO compartido por TODO `dispatch()` (ADR-013): sin
  // este reset, una publicación de un test se filtra al siguiente.
  beforeEach(() => {
    fakePublisher.reset();
  });

  it('TS-22 · requirement.created cumple el contrato', async () => {
    const reply = await dispatch<{ id: number }>('requirements.new', {
      creator: CREATOR, title: 'Exportar el reporte de horas a XLSX',
      description: 'Hoy el reporte solo se baja en CSV', projectId,
      responsiblePersonIds: [personA, personB],
    });
    reply.status.should.equal('success');

    verifyPublished();
    const event = ev('requirement.created');
    event.entity.should.deepEqual({ type: 'requirement', id: reply.data!.id, projectId });
    event.recipients!.responsiblePersonIds.should.deepEqual([personA, personB]);
    ('changes' in event).should.be.false();
    ('comment' in event).should.be.false();
    ('visibilityLevel' in event).should.be.false();
  });

  /**
   * TS-23 a TS-27 son SECUENCIALES sobre la MISMA entidad, no independientes (Implementation
   * Notes de la Task 3): TS-26 (`resolved`) necesita el requisito ya en un estado no terminal, y
   * TS-27 (`reopened`) necesita ese mismo requisito ya `resuelto`. Un `describe` anidado con su
   * propio requisito, creado en un `before` local, es más claro que encadenarlos sobre el
   * requisito global de la suite.
   */
  describe('el ciclo de vida de un requisito de incidencia (TS-23 a TS-27, secuenciales)', () => {
    let id: number;

    before(async () => {
      const reply = await dispatch<{ id: number }>('requirements.new', {
        creator: CREATOR, title: 'La exportación falla con caracteres especiales',
        description: 'Un título con ñ rompe el XLSX generado', projectId,
        type: 'incidencia', responsiblePersonIds: [personA, personB],
      });
      id = reply.data!.id;
      fakePublisher.reset();
    });

    it('TS-23 · requirement.state.changed cumple el contrato', async () => {
      const reply = await dispatch(`requirements.${id}.edit`, {
        state: 'desarrollo', editor: CREATOR,
      });
      reply.status.should.equal('success');

      verifyPublished();
      const event = ev('requirement.state.changed');
      event.changes!.should.deepEqual({ state: { from: 'analisis', to: 'desarrollo' } });
      (event.snapshot as RequirementSnapshot).state.should.equal('desarrollo');
      event.recipients!.should.be.ok();
    });

    it('TS-24 · requirement.updated cumple el contrato', async () => {
      const reply = await dispatch(`requirements.${id}.edit`, {
        title: 'Exportar a XLSX', description: 'Texto nuevo, más específico', editor: CREATOR,
      });
      reply.status.should.equal('success');

      verifyPublished();
      const event = ev('requirement.updated');
      Object.keys(event.changes!).sort().should.deepEqual(['description', 'title']);
      (event.snapshot as RequirementSnapshot).description.should.equal('Texto nuevo, más específico');
    });

    it('TS-25 · requirement.assigned cumple el contrato', async () => {
      const reply = await dispatch(`requirements.${id}.edit`, {
        responsiblePersonIds: [personA, personB, personC], editor: CREATOR,
      });
      reply.status.should.equal('success');

      verifyPublished();
      const event = ev('requirement.assigned');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const changes = event.changes as any;
      changes.responsiblePersonIds.should.deepEqual({
        from: [personA, personB], to: [personA, personB, personC],
      });
      changes.added.should.deepEqual([personC]);
      changes.removed.should.deepEqual([]);
      (event.snapshot as RequirementSnapshot).responsiblePersonIds.should.deepEqual(
        [personA, personB, personC]
      );
    });

    it('TS-26 · requirement.resolved cumple el contrato (y sale junto a state.changed)', async () => {
      const reply = await dispatch(`requirements.${id}.edit`, {
        state: 'resuelto', resolutionType: 'error_interno',
        resolutionConclusion: 'Resuelto en la 1.3.2', editor: CREATOR,
      });
      reply.status.should.equal('success');

      verifyPublished();
      const resolved = ev('requirement.resolved');
      ('finishedAt' in resolved).should.be.false(); // TS-16: NO en la raíz
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resolvedChanges = resolved.changes as any;
      resolvedChanges.finishedAt.should.be.a.String();
      resolvedChanges.resolutionType.should.equal('error_interno');
      resolvedChanges.resolutionConclusion.should.equal('Resuelto en la 1.3.2');

      const stateChanged = ev('requirement.state.changed');
      stateChanged.correlationId.should.equal(resolved.correlationId);
      stateChanged.eventId.should.not.equal(resolved.eventId); // TS-33
    });

    it('TS-27 · requirement.reopened cumple el contrato', async () => {
      const reply = await dispatch(`requirements.${id}.edit`, {
        state: 'desarrollo', editor: CREATOR,
      });
      reply.status.should.equal('success');

      verifyPublished();
      const event = ev('requirement.reopened');
      event.changes!.should.deepEqual({
        state: { from: 'resuelto', to: 'desarrollo' }, resolutionCleared: true,
      });
    });
  });

  it('TS-33 · dos campos independientes en el MISMO edit comparten correlationId', async () => {
    // A propósito UN CAMPO POR EVENTO, y los dos en el MISMO dispatch (Implementation Notes de
    // la Task 3: "Un edit por campo no lo probaría"): `state` dispara `requirement.state.changed`
    // y `title` dispara `requirement.updated`, dos reglas de negocio INDEPENDIENTES entre sí (a
    // diferencia de TS-26, donde `state.changed` y `resolved` salen los dos de la MISMA
    // transición). Si compartieran correlationId solo por ser la misma transición, este test lo
    // detectaría.
    const created = await dispatch<{ id: number }>('requirements.new', {
      creator: CREATOR, title: 'Requisito para TS-33', description: 'x', projectId,
    });
    const id = created.data!.id;
    fakePublisher.reset();

    const reply = await dispatch(`requirements.${id}.edit`, {
      state: 'desarrollo', title: 'Requisito para TS-33 (editado)', editor: CREATOR,
    });
    reply.status.should.equal('success');

    verifyPublished();
    const stateChanged = ev('requirement.state.changed');
    const updated = ev('requirement.updated');

    fakePublisher.published.length.should.equal(2);
    stateChanged.correlationId.should.equal(updated.correlationId);
    stateChanged.eventId.should.not.equal(updated.eventId);
  });

  describe('comentarios de requisito (TS-28, TS-29)', () => {
    let id: number;
    let commentId: number;

    before(async () => {
      const reply = await dispatch<{ id: number }>('requirements.new', {
        creator: CREATOR, title: 'Requisito para comentarios', description: 'x', projectId,
      });
      id = reply.data!.id;
      fakePublisher.reset();
    });

    it('TS-28 · requirement.comment.created cumple el contrato', async () => {
      const reply = await dispatch<{ id: number }>(`requirements.${id}.comment`, {
        comment: 'El cliente pidió adelantar la entrega al 15.', author: CREATOR,
        visibilityLevel: 'internal',
      });
      reply.status.should.equal('success');
      commentId = reply.data!.id;

      verifyPublished();
      const event = ev('requirement.comment.created');
      event.comment!.should.deepEqual({
        id: commentId, body: 'El cliente pidió adelantar la entrega al 15.', fileIds: [],
      });
      event.visibilityLevel!.should.equal('internal');
      (event.snapshot as RequirementSnapshot).visibilityLevel.should.equal('public');
      ('changes' in event).should.be.false();
    });

    it('TS-29 · requirement.comment.edited cumple el contrato', async () => {
      const reply = await dispatch(`requirements.${id}.comment.${commentId}.edit`, {
        comment: 'Texto nuevo, revisado', editor: CREATOR,
      });
      reply.status.should.equal('success');

      verifyPublished();
      const event = ev('requirement.comment.edited');
      event.comment!.body.should.equal('Texto nuevo, revisado'); // sin `from`
      Object.keys(event.changes!).sort().should.deepEqual(['editedAt', 'editedBy']);
      ('visibilityLevel' in event.changes!).should.be.false();
    });
  });

  describe('suscripción (TS-30, TS-31, TS-32)', () => {
    let id: number;

    before(async () => {
      const reply = await dispatch<{ id: number }>('requirements.new', {
        creator: CREATOR, title: 'Requisito para suscripción', description: 'x', projectId,
      });
      id = reply.data!.id;
      fakePublisher.reset();
    });

    it('TS-30 · requirement.subscriptor.added cumple el contrato', async () => {
      const reply = await dispatch(`requirements.${id}.subscriptors.new`, {
        userId: SUBSCRIPTOR_USER,
      });
      reply.status.should.equal('success');

      verifyPublished();
      const event = ev('requirement.subscriptor.added');
      ('name' in event.actor).should.be.false(); // el sobre no lleva name (D-2 de S-064)
      event.recipients!.subscriptors.some((s) => s.userId === SUBSCRIPTOR_USER).should.be.true();
      event.changes!.should.deepEqual({ userId: SUBSCRIPTOR_USER });
    });

    it('TS-31 · requirement.subscriptor.removed cumple el contrato', async () => {
      const reply = await dispatch(`requirements.${id}.subscriptors.${SUBSCRIPTOR_USER}.delete`, {});
      reply.status.should.equal('success');

      verifyPublished();
      const event = ev('requirement.subscriptor.removed');
      ('name' in event.actor).should.be.false();
      event.recipients!.subscriptors.some((s) => s.userId === SUBSCRIPTOR_USER).should.be.false();
      event.changes!.should.deepEqual({ userId: SUBSCRIPTOR_USER });
    });

    it('TS-32 · email: null de una identidad de servicio pasa el schema, preservado', async () => {
      await dispatch(`requirements.${id}.subscriptors.new`, { userId: SERVICE_USER });
      fakePublisher.reset();

      const reply = await dispatch(`requirements.${id}.edit`, {
        title: 'Requisito para suscripción (editado)', editor: CREATOR,
      });
      reply.status.should.equal('success');

      verifyPublished();
      const event = ev('requirement.updated');
      const serviceSubscriptor = event.recipients!.subscriptors.find((s) => s.userId === SERVICE_USER);
      serviceSubscriptor!.should.be.ok();
      (serviceSubscriptor!.email === null).should.be.true();
    });
  });
});
