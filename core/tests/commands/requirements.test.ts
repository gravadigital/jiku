import 'mocha';
import 'should';
import sinon from 'sinon';
import { Op } from 'sequelize';
import { Attachment, ByteStatus, File, Objective, ObjectiveActivity, Person, PersonObjective, PersonRequirement, Project, Requirement, RequirementActivity, RequirementState, RequirementSubscriptor, RetentionStatus, User } from '@jiku/models';
import { ErrorCode } from '@jiku/nats-protocol';
import * as fs from 'fs';
import * as path from 'path';
import logger from '../../src/logger';
import { dispatch } from '../helpers/dispatch';
import { installS3Double, uninstallS3Double } from '../helpers/s3-double';

const CREATOR = 'zitadel-sub-reqs';
const OTHER_USER = 'zitadel-sub-reqs-2';
const ADMIN_ID_REQS = 'zitadel-sub-reqs-admin';

/**
 * `CORE_TRUSTED_PUBLISHER_ID` de `.env.test`: el `caller` que ejercita la rama de la api, y desde
 * S-017 TAMBIÉN el default de `dispatch()` — la compuerta de autorización rechazaría cualquier
 * otro default por no tener fila en `users`. Se sigue pasando explícito donde el test afirma
 * sobre la rama confiable. Mismos nombres que en `files.test.ts`, para que los dos archivos
 * hablen el mismo idioma.
 */
const TRUSTED = 'api-service-user-sub';
const EXTERNAL = 'servicio-externo-sub';
const EXTERNAL_B = 'servicio-externo-b-sub';
const UPLOADER_A = 'zitadel-user-a';
const UPLOADER_B = 'zitadel-user-b';
const ADMIN = 'zitadel-admin';

/**
 * Los cinco `entityType` de draft que S-001 dejó sin ninguna fila. El modelo todavía los
 * declara —retirarlos del ENUM de PostgreSQL no es soportado sin recrear el tipo— pero
 * ninguna escritura de S-003 los usa, y TS-2 / TS-35 lo verifican.
 */
const DRAFT_TYPES = [
  'requirement_draft', 'objective_draft', 'comment_draft', 'comment', 'stage',
];

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
    // SIN `roles` en la fila: el rol admin de estos tests viaja SIEMPRE por el sobre de
    // identidad (`actor: { id: ADMIN_ID_REQS, roles: ['admin'] }`), nunca por `users.roles` —
    // es la única forma de que `ctx.roles` sea realmente `['admin']` (REQ-011, CA-4).
    await User.create({
      id: ADMIN_ID_REQS, name: 'Admin', username: 'admin-reqs', email: 'admin-reqs@mail.com',
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

    it('falla sin creator y sin sobre: ninguna fuente resuelve el actor', async () => {
      const reply = await dispatch('requirements.new', {
        title: 'x', description: 'y', projectId,
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
    });

    it('con sobre, creator es redundante: no hace falta mandarlo', async () => {
      const reply = await dispatch<{ id: number }>('requirements.new', {
        title: 'Con sobre', description: 'x', projectId,
        actor: { id: CREATOR, roles: ['user'] },
      });
      reply.status.should.equal('success');
      const requirement = await Requirement.findByPk(reply.data!.id);
      // El `createdBy` sale de `actor.id`, no de un `creator` que nunca se mandó.
      requirement!.createdBy.should.equal(CREATOR);
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
      // Fixture propio, NO el `requirementId` del `beforeEach` compartido (que sigue en
      // `analisis` a propósito para los demás tests de este describe). Desde REQ-012 (S-049)
      // las transiciones son libres, así que `analisis -> desarrollo` también sería válido; se
      // mantiene `en_cola -> desarrollo` porque es el caso más simple, sin relación con ninguna
      // restricción de secuencia.
      const requirement = await Requirement.create({
        title: 'En cola', description: 'x', projectId, createdBy: CREATOR,
        state: 'en_cola',
      });
      await dispatch(`requirements.${requirement.id}.edit`, {
        editor: CREATOR, state: 'desarrollo',
      });
      const updated = await Requirement.findByPk(requirement.id);
      (updated!.inProgressAt === null).should.be.false();
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

    it('falla sin editor y sin sobre: ninguna fuente resuelve el actor', async () => {
      const reply = await dispatch(`requirements.${requirementId}.edit`, { title: 'x' });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
    });

    it('con sobre, editor es redundante: no hace falta mandarlo', async () => {
      const reply = await dispatch(`requirements.${requirementId}.edit`, {
        title: 'Editado con sobre', actor: { id: CREATOR, roles: ['user'] },
      });
      reply.status.should.equal('success');

      const activities = await RequirementActivity.findAll({ where: { requirementId } });
      // El `changedBy` de la actividad sale de `actor.id`, no de un `editor` que nunca se mandó.
      activities.forEach((a) => a.changedBy.should.equal(CREATOR));
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
      // El fixture es `type: 'otro'` (no `incidencia`): desde REQ-012 la conclusión es opcional
      // para ese tipo, así que mandarla acá no afirma nada sobre la obligatoriedad de la regla.
      await dispatch(`requirements.${requirementId}.resolve`, {
        editor: CREATOR, type: 'otro', conclusion: 'Resuelto',
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

    it('TS-7 · resuelve una funcionalidad sin tipo ni conclusión (REQ-012: acotado a incidencia)', async () => {
      const funcionalidad = await Requirement.create({
        title: 'Funcionalidad', description: 'x', projectId, createdBy: CREATOR,
        type: 'funcionalidad', state: 'resuelto',
      });

      const reply = await dispatch(`requirements.${funcionalidad.id}.resolve`, {
        editor: CREATOR, type: 'otro', conclusion: 'Rehecho',
      });
      reply.status.should.equal('success');

      const updated = await Requirement.findByPk(funcionalidad.id);
      updated!.resolutionConclusion!.should.equal('Rehecho');
    });

    it('falla sin type', async () => {
      const reply = await dispatch(`requirements.${requirementId}.resolve`, {
        editor: CREATOR,
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
    });

    it('falla sin editor y sin sobre: ninguna fuente resuelve el actor', async () => {
      const reply = await dispatch(`requirements.${requirementId}.resolve`, {
        type: 'otro', conclusion: 'Resuelto',
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
    });

    it('con sobre, editor es redundante: no hace falta mandarlo', async () => {
      const reply = await dispatch(`requirements.${requirementId}.resolve`, {
        type: 'otro', conclusion: 'Resuelto con sobre',
        actor: { id: CREATOR, roles: ['user'] },
      });
      reply.status.should.equal('success');

      const activity = await RequirementActivity.findOne({
        where: { requirementId, typeOfActivity: 'state' },
      });
      // El `changedBy` sale de `actor.id`, no de un `editor` que nunca se mandó.
      activity!.changedBy.should.equal(CREATOR);
    });
  });

  describe('el workflow de estados sin secuencia (S-049)', () => {
    /** Crea un requisito ya en `state`, opcionalmente con `type`. Reduce la repetición de las
     * celdas de la tabla — cada test sigue siendo legible por separado. */
    async function createRequirement(
      state: string,
      type?: string | null
    ): Promise<number> {
      const requirement = await Requirement.create({
        title: 'Workflow', description: 'x', projectId, createdBy: CREATOR,
        state, type: type === undefined ? undefined : type,
      });
      return requirement.id;
    }

    /** Crea un requisito ya resuelto, con sus datos de resolución y sus marcas cargadas. Es el
     * fixture de la REAPERTURA: los tests de S-049 necesitan una fila que YA pasó por el ciclo. */
    async function createResolvedRequirement(overrides: Record<string, unknown> = {}): Promise<number> {
      const requirement = await Requirement.create({
        title: 'Resuelto', description: 'x', projectId, createdBy: CREATOR,
        state: 'resuelto', type: 'incidencia',
        resolutionType: 'error_interno',
        resolutionConclusion: 'Conclusión',
        resolutionComment: 'Comentario',
        ...overrides,
      });
      return requirement.id;
    }

    it('TS-1 · salto hacia adelante salteando un paso, en una funcionalidad', async () => {
      const id = await createRequirement('planificacion', 'funcionalidad');
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'desarrollo',
      });
      reply.status.should.equal('success');
      const requirement = await Requirement.findByPk(id);
      requirement!.state.should.equal('desarrollo');
    });

    it('TS-2 · salto de dos pasos (analisis -> desarrollo)', async () => {
      const id = await createRequirement('analisis', 'funcionalidad');
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'desarrollo',
      });
      reply.status.should.equal('success');
      const requirement = await Requirement.findByPk(id);
      requirement!.state.should.equal('desarrollo');
    });

    it('TS-3 · transición hacia atrás', async () => {
      const id = await createRequirement('revision');
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'analisis',
      });
      reply.status.should.equal('success');
      const requirement = await Requirement.findByPk(id);
      requirement!.state.should.equal('analisis');
    });

    it('TS-4 · resuelto deja de ser terminal', async () => {
      const id = await createRequirement('resuelto');
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'desarrollo',
      });
      reply.status.should.equal('success');
      const requirement = await Requirement.findByPk(id);
      requirement!.state.should.equal('desarrollo');
    });

    it('TS-5 · cancelado deja de ser terminal', async () => {
      const id = await createRequirement('cancelado');
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'en_cola',
      });
      reply.status.should.equal('success');
      const requirement = await Requirement.findByPk(id);
      requirement!.state.should.equal('en_cola');
    });

    it('TS-6 · cancelado -> resuelto en una funcionalidad, sin resolución', async () => {
      const id = await createRequirement('cancelado', 'funcionalidad');
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'resuelto',
      });
      reply.status.should.equal('success');
      const requirement = await Requirement.findByPk(id);
      requirement!.state.should.equal('resuelto');
    });

    it('TS-8 · resolver una funcionalidad sin tipo ni conclusión, por .edit', async () => {
      const id = await createRequirement('revision', 'funcionalidad');
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'resuelto',
      });
      reply.status.should.equal('success');
      const requirement = await Requirement.findByPk(id);
      requirement!.state.should.equal('resuelto');
      (requirement!.resolutionType === null).should.be.true();
      (requirement!.resolutionConclusion === null).should.be.true();
    });

    it('TS-9 · resolver una mejora sin tipo ni conclusión', async () => {
      const id = await createRequirement('revision', 'mejora');
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'resuelto',
      });
      reply.status.should.equal('success');
      const requirement = await Requirement.findByPk(id);
      requirement!.state.should.equal('resuelto');
    });

    it('TS-10 · resolver un otro sin tipo ni conclusión', async () => {
      const id = await createRequirement('revision', 'otro');
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'resuelto',
      });
      reply.status.should.equal('success');
      const requirement = await Requirement.findByPk(id);
      requirement!.state.should.equal('resuelto');
    });

    it('TS-11 · resolver un requisito sin type (NULL) sin resolución', async () => {
      const id = await createRequirement('revision', null);
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'resuelto',
      });
      reply.status.should.equal('success');
      const requirement = await Requirement.findByPk(id);
      requirement!.state.should.equal('resuelto');
    });

    it('TS-12 · resolver una incidencia con tipo y conclusión, por .edit', async () => {
      const id = await createRequirement('desarrollo', 'incidencia');
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'resuelto',
        resolutionType: 'error_interno', resolutionConclusion: 'Se corrigió el cálculo',
      });
      reply.status.should.equal('success');
      const requirement = await Requirement.findByPk(id);
      requirement!.state.should.equal('resuelto');
      requirement!.resolutionType!.should.equal('error_interno');
      requirement!.resolutionConclusion!.should.equal('Se corrigió el cálculo');
    });

    it('TS-13 · resolver una incidencia con la conclusión ya almacenada, sin mandarla en el payload', async () => {
      const id = await createRequirement('desarrollo', 'incidencia');
      await Requirement.update(
        { resolutionType: 'error_interno', resolutionConclusion: 'Conclusión previa' },
        { where: { id } }
      );
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'resuelto',
      });
      reply.status.should.equal('success');
      const requirement = await Requirement.findByPk(id);
      requirement!.state.should.equal('resuelto');
      requirement!.resolutionConclusion!.should.equal('Conclusión previa');
    });

    it('TS-14 · rechazo de incidencia sin resolución, por .edit, sin escribir nada', async () => {
      const id = await createRequirement('desarrollo', 'incidencia');
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'resuelto',
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('resolution_required');
      const requirement = await Requirement.findByPk(id);
      requirement!.state.should.equal('desarrollo');
      (await RequirementActivity.count({ where: { requirementId: id } })).should.equal(0);
    });

    it('TS-15 · rechazo de incidencia sin resolución, por .resolve', async () => {
      const id = await createRequirement('desarrollo', 'incidencia');
      const reply = await dispatch(`requirements.${id}.resolve`, {
        editor: CREATOR, type: 'error_interno',
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('resolution_required');
      const requirement = await Requirement.findByPk(id);
      requirement!.state.should.equal('desarrollo');
    });

    it('TS-16 · rechazo de incidencia con solo resolutionType, sin conclusión, por .edit', async () => {
      const id = await createRequirement('revision', 'incidencia');
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'resuelto', resolutionType: 'otro',
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('resolution_required');
    });

    it('TS-17 · rechazo de incidencia con solo resolutionConclusion, sin tipo, por .edit', async () => {
      const id = await createRequirement('revision', 'incidencia');
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'resuelto', resolutionConclusion: 'x',
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('resolution_required');
    });

    it('TS-18 · el tipo se lee de la fila: una incidencia no esquiva la regla declarándose funcionalidad', async () => {
      const id = await createRequirement('revision', 'incidencia');
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, type: 'funcionalidad', state: 'resuelto',
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('resolution_required');
      const requirement = await Requirement.findByPk(id);
      requirement!.type!.should.equal('incidencia');
    });

    it('TS-19 · el tipo se lee de la fila: una funcionalidad no gana la regla declarándose incidencia', async () => {
      const id = await createRequirement('revision', 'funcionalidad');
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, type: 'incidencia', state: 'resuelto',
      });
      reply.status.should.equal('success');
      const requirement = await Requirement.findByPk(id);
      requirement!.state.should.equal('resuelto');
      requirement!.type!.should.equal('incidencia');
    });

    it('TS-20 · limpieza de los tres datos de resolución al salir de resuelto', async () => {
      const id = await createResolvedRequirement();
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'desarrollo',
      });
      reply.status.should.equal('success');
      const requirement = await Requirement.findByPk(id);
      requirement!.state.should.equal('desarrollo');
      (requirement!.resolutionType === null).should.be.true();
      (requirement!.resolutionConclusion === null).should.be.true();
      (requirement!.resolutionComment === null).should.be.true();
    });

    it('TS-21 · la limpieza no ocurre al pasar de resuelto a cancelado (destino terminal)', async () => {
      const id = await createResolvedRequirement();
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'cancelado',
      });
      reply.status.should.equal('success');
      const requirement = await Requirement.findByPk(id);
      requirement!.state.should.equal('cancelado');
      requirement!.resolutionType!.should.equal('error_interno');
      requirement!.resolutionConclusion!.should.equal('Conclusión');
    });

    it('TS-22 · la limpieza no ocurre en una edición que no cambia el estado', async () => {
      const id = await createResolvedRequirement();
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, title: 'Nuevo título',
      });
      reply.status.should.equal('success');
      const requirement = await Requirement.findByPk(id);
      requirement!.resolutionType!.should.equal('error_interno');
      requirement!.resolutionConclusion!.should.equal('Conclusión');
    });

    it('TS-23 · un valor de resolución explícito en el mismo payload que saca de resuelto gana sobre la limpieza', async () => {
      const id = await createResolvedRequirement();
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'desarrollo', resolutionComment: 'Nota de reapertura',
      });
      reply.status.should.equal('success');
      const requirement = await Requirement.findByPk(id);
      requirement!.state.should.equal('desarrollo');
      (requirement!.resolutionType === null).should.be.true();
      (requirement!.resolutionConclusion === null).should.be.true();
      requirement!.resolutionComment!.should.equal('Nota de reapertura');
    });

    it('TS-24 · inProgressAt conserva la primera fecha al reentrar a desarrollo', async () => {
      const originalDate = new Date('2026-01-01T10:00:00Z');
      const id = await createResolvedRequirement({ inProgressAt: originalDate });
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'desarrollo',
      });
      reply.status.should.equal('success');
      const requirement = await Requirement.findByPk(id);
      requirement!.inProgressAt!.toISOString().should.equal(originalDate.toISOString());
    });

    it('TS-25 · finishedAt se reescribe al reentrar a resuelto', async () => {
      const originalDate = new Date('2026-01-01T10:00:00Z');
      const id = await createRequirement('desarrollo', 'funcionalidad');
      await Requirement.update({ finishedAt: originalDate }, { where: { id } });
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'resuelto',
      });
      reply.status.should.equal('success');
      const requirement = await Requirement.findByPk(id);
      requirement!.finishedAt!.getTime().should.be.above(originalDate.getTime());
    });

    it('TS-26 · finishedAt no se toca al salir de resuelto', async () => {
      const originalDate = new Date('2026-01-01T10:00:00Z');
      const id = await createResolvedRequirement({ finishedAt: originalDate });
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'desarrollo',
      });
      reply.status.should.equal('success');
      const requirement = await Requirement.findByPk(id);
      requirement!.finishedAt!.toISOString().should.equal(originalDate.toISOString());
    });

    it('TS-27 · scheduledAt sigue siendo write-once', async () => {
      const originalDate = new Date('2026-01-01T10:00:00Z');
      const id = await createRequirement('desarrollo');
      await Requirement.update({ scheduledAt: originalDate }, { where: { id } });
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'planificacion',
      });
      reply.status.should.equal('success');
      const requirement = await Requirement.findByPk(id);
      requirement!.scheduledAt!.toISOString().should.equal(originalDate.toISOString());
    });

    it('TS-28 · inReviewAt sigue siendo write-once', async () => {
      const originalDate = new Date('2026-01-01T10:00:00Z');
      const id = await createRequirement('desarrollo');
      await Requirement.update({ inReviewAt: originalDate }, { where: { id } });
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'revision',
      });
      reply.status.should.equal('success');
      const requirement = await Requirement.findByPk(id);
      requirement!.inReviewAt!.toISOString().should.equal(originalDate.toISOString());
    });

    it('TS-29 · la actividad de tipo state se sigue registrando en un salto que antes se rechazaba', async () => {
      const id = await createRequirement('analisis', 'funcionalidad');
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'desarrollo',
      });
      reply.status.should.equal('success');
      const activity = await RequirementActivity.findOne({
        where: { requirementId: id, typeOfActivity: 'state' },
      });
      activity!.previousValue.should.equal('analisis');
      activity!.newValue.should.equal('desarrollo');
      activity!.changedBy.should.equal(CREATOR);
      activity!.visibilityLevel.should.equal('public');
    });

    it('TS-30 · un edit que manda el mismo estado no registra actividad ni dispara la limpieza', async () => {
      const id = await createResolvedRequirement();
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'resuelto',
      });
      reply.status.should.equal('success');
      const stateActivity = await RequirementActivity.findOne({
        where: { requirementId: id, typeOfActivity: 'state' },
      });
      (stateActivity === null).should.be.true();
      const requirement = await Requirement.findByPk(id);
      requirement!.resolutionConclusion!.should.equal('Conclusión');
    });

    it('TS-31 · el requisito inexistente sigue fallando antes de cualquier regla', async () => {
      const reply = await dispatch('requirements.999999.edit', {
        editor: CREATOR, state: 'desarrollo',
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('requirement_not_found');
    });

    it('TS-32 · un state fuera del enum sigue siendo invalid_fields', async () => {
      const id = await createRequirement('analisis');
      const reply = await dispatch(`requirements.${id}.edit`, {
        editor: CREATOR, state: 'inventado',
      });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
    });

    describe('invalid_state_transition quedó sin emisor (S-049)', () => {
      it('TS-33 · sigue definido en el catálogo del protocolo', () => {
        ErrorCode.INVALID_STATE_TRANSITION.should.equal('invalid_state_transition');
      });

      it('TS-34 · ningún archivo de core/src/ lo emite', () => {
        const srcDir = path.join(__dirname, '../../src');
        const offenders: string[] = [];

        function walk(dir: string): void {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              walk(full);
            } else if (entry.isFile() && entry.name.endsWith('.ts')) {
              const content = fs.readFileSync(full, 'utf-8');
              if (content.includes('invalid_state_transition') || content.includes('INVALID_STATE_TRANSITION')) {
                offenders.push(full);
              }
            }
          }
        }

        walk(srcDir);
        offenders.should.deepEqual([]);
      });

      it('TS-35 · el archivo state-transitions.ts ya no existe', () => {
        const removedPath = path.join(__dirname, '../../src/commands/requirements/state-transitions.ts');
        fs.existsSync(removedPath).should.be.false();
      });
    });

    it('TS-36 · los siete estados son alcanzables desde los siete (barrido completo)', async () => {
      const states = Object.values(RequirementState);
      for (const from of states) {
        for (const to of states) {
          if (from === to) continue;
          const id = await createRequirement(from, 'funcionalidad');
          const reply = await dispatch(`requirements.${id}.edit`, { editor: CREATOR, state: to });
          reply.status.should.equal('success', `${from} -> ${to} debería aceptarse`);
          const requirement = await Requirement.findByPk(id);
          requirement!.state.should.equal(to, `${from} -> ${to} no quedó escrito`);
        }
      }
    });

    describe('regresión de autorización (CA-13, CA-14)', () => {
      const WF_EXTERNAL = 'sub-s049-externo';

      before(async () => {
        // Fila real en `users` con el rol `external-user`: sin fila, `dispatch()` cae en el
        // mismo `caller_not_authorized` pero por "sin fila", que no es lo que este test afirma
        // (queda cubierto igual, pero la intención es "el ROL no alcanza").
        await User.create({
          id: WF_EXTERNAL, name: 'Externo', username: 's049-externo',
          email: 's049-externo@test.local', roles: ['external-user'],
        });
      });

      after(async () => {
        await User.destroy({ where: { id: WF_EXTERNAL } });
      });

      it('TS-37 · external-user sigue sin poder publicar requirements.edit (regresión de autorización)', async () => {
        const id = await createRequirement('analisis', 'funcionalidad');
        const reply = await dispatch(
          `requirements.${id}.edit`,
          { editor: WF_EXTERNAL, state: 'desarrollo' },
          WF_EXTERNAL
        );
        reply.status.should.equal('failure');
        reply.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
        const requirement = await Requirement.findByPk(id);
        requirement!.state.should.equal('analisis');
      });

      it('TS-38 · access_denied se evalúa antes que cualquier regla de resolución', async () => {
        // `MIX` — roles `['user','external-user']` — pasa la compuerta de rol (unión) pero cae
        // en clase `external` por precedencia, así que el chequeo de entidad SÍ se ejecuta. Sin
        // fila en `UserProjectPermission` para el proyecto de este requisito, la respuesta tiene
        // que ser `access_denied`, no `resolution_required`, aunque la incidencia no tenga
        // resolución cargada.
        const MIX = 'sub-s049-mixto';
        await User.create({
          id: MIX, name: 'Mixto', username: 's049-mixto',
          email: 's049-mixto@test.local', roles: ['user', 'external-user'],
        });
        try {
          const id = await createRequirement('desarrollo', 'incidencia');
          const reply = await dispatch(
            `requirements.${id}.edit`,
            { editor: MIX, state: 'resuelto' },
            MIX
          );
          reply.status.should.equal('failure');
          reply.errorCode!.should.equal(ErrorCode.ACCESS_DENIED);
        } finally {
          await User.destroy({ where: { id: MIX } });
        }
      });
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

    it('falla sin author y sin sobre: ninguna fuente resuelve el actor', async () => {
      const reply = await dispatch(`requirements.${requirementId}.comment`, { comment: 'x' });
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal('invalid_fields');
    });

    it('con sobre, author es redundante: no hace falta mandarlo', async () => {
      const reply = await dispatch<{ id: number }>(`requirements.${requirementId}.comment`, {
        comment: 'Con sobre', actor: { id: CREATOR, roles: ['user'] },
      });
      reply.status.should.equal('success');
      const activity = await RequirementActivity.findByPk(reply.data!.id);
      // El `changedBy` sale de `actor.id`, no de un `author` que nunca se mandó.
      activity!.changedBy.should.equal(CREATOR);
    });
  });

  /** REQ-011 (S-046): `requirements.{id}.comment.{cid}.edit` — comandos 22/23. */
  describe('requirements.{id}.comment.{cid}.edit', () => {
    let requirementId: number;
    let cid: number;

    beforeEach(async () => {
      const requirement = await Requirement.create({
        title: 'Para editar comentario', description: 'x', projectId, createdBy: CREATOR,
      });
      requirementId = requirement.id;

      // Fixture con el MODELO, no despachando el comando de alta: más rápido, no depende de
      // otro comando, y deja explícito el estado inicial que el test afirma.
      const activity = await RequirementActivity.create({
        typeOfActivity: 'comment',
        previousValue: '',
        newValue: 'texto original',
        visibilityLevel: 'internal',
        requirementId,
        changedBy: CREATOR,
      });
      cid = activity.id;
    });

    it('TS-1: el autor edita el texto de su comentario', async () => {
      const reply = await dispatch(
        `requirements.${requirementId}.comment.${cid}.edit`,
        { editor: CREATOR, comment: 'texto editado' }
      );

      reply.status.should.equal('success');
      (reply.data === undefined).should.be.true();

      const activity = await RequirementActivity.findByPk(cid);
      activity!.newValue.should.equal('texto editado');
      (activity!.editedBy as string).should.equal(CREATOR);
      (activity!.editedAt instanceof Date).should.be.true();
      activity!.changedBy.should.equal(CREATOR);
    });

    it('TS-3: `editedAt` se pisa en cada edición y no hay tope de cantidad', async () => {
      const r1 = await dispatch(`requirements.${requirementId}.comment.${cid}.edit`, {
        editor: CREATOR, comment: 'v1',
      });
      const first = await RequirementActivity.findByPk(cid);

      const r2 = await dispatch(`requirements.${requirementId}.comment.${cid}.edit`, {
        editor: CREATOR, comment: 'v2',
      });
      const second = await RequirementActivity.findByPk(cid);

      const r3 = await dispatch(`requirements.${requirementId}.comment.${cid}.edit`, {
        editor: CREATOR, comment: 'v3',
      });
      const third = await RequirementActivity.findByPk(cid);

      [r1, r2, r3].forEach((r) => r.status.should.equal('success'));
      third!.newValue.should.equal('v3');
      (third!.editedAt!.getTime() >= second!.editedAt!.getTime()).should.be.true();
      (second!.editedAt!.getTime() >= first!.editedAt!.getTime()).should.be.true();
    });

    it('TS-4: el comando NO escribe `previous_value`', async () => {
      const reply = await dispatch(`requirements.${requirementId}.comment.${cid}.edit`, {
        editor: CREATOR, comment: 'nuevo',
      });

      reply.status.should.equal('success');
      const activity = await RequirementActivity.findByPk(cid);
      activity!.previousValue.should.equal('');
      activity!.newValue.should.equal('nuevo');
    });

    it('TS-5: el admin edita un comentario ajeno — editedBy es el admin, changedBy no se toca', async () => {
      const reply = await dispatch(`requirements.${requirementId}.comment.${cid}.edit`, {
        comment: 'editado por admin', actor: { id: ADMIN_ID_REQS, roles: ['admin'] },
      });

      reply.status.should.equal('success');
      const activity = await RequirementActivity.findByPk(cid);
      activity!.newValue.should.equal('editado por admin');
      (activity!.editedBy as string).should.equal(ADMIN_ID_REQS);
      activity!.changedBy.should.equal(CREATOR);
    });

    it('TS-7: rechazo por falta de autoría, sin rol admin', async () => {
      const reply = await dispatch(`requirements.${requirementId}.comment.${cid}.edit`, {
        comment: 'x', actor: { id: OTHER_USER, roles: ['user'] },
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.COMMENT_NOT_OWNED);
      const activity = await RequirementActivity.findByPk(cid);
      activity!.newValue.should.equal('texto original');
      (activity!.editedAt === null).should.be.true();
      (activity!.editedBy === null).should.be.true();
    });

    it('TS-9: en el canal exento (`ctx.roles === []`) un no-autor es rechazado', async () => {
      // Canal exento: caller = publicador confiable (el default de `dispatch()`), SIN clave
      // `actor` en el payload. `[]` no habilita la excepción de admin.
      const reply = await dispatch(`requirements.${requirementId}.comment.${cid}.edit`, {
        editor: OTHER_USER, comment: 'x',
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.COMMENT_NOT_OWNED);
      const activity = await RequirementActivity.findByPk(cid);
      activity!.newValue.should.equal('texto original');
    });

    it('TS-10: rechazo sobre una actividad que no es comentario', async () => {
      const stateActivity = await RequirementActivity.create({
        typeOfActivity: 'state',
        previousValue: 'backlog',
        newValue: 'activo',
        visibilityLevel: 'internal',
        requirementId,
        changedBy: CREATOR,
      });

      const reply = await dispatch(
        `requirements.${requirementId}.comment.${stateActivity.id}.edit`,
        { editor: CREATOR, comment: 'x' }
      );

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.ACTIVITY_NOT_EDITABLE);
      const reread = await RequirementActivity.findByPk(stateActivity.id);
      reread!.newValue.should.equal('activo');
      (reread!.editedAt === null).should.be.true();
    });

    it('TS-12: el chequeo de tipo corre ANTES que el de autoría', async () => {
      const stateActivity = await RequirementActivity.create({
        typeOfActivity: 'state',
        previousValue: 'backlog',
        newValue: 'activo',
        visibilityLevel: 'internal',
        requirementId,
        changedBy: CREATOR,
      });

      // Ni autor ni admin, y tampoco es comentario: si el orden estuviera invertido,
      // respondería `comment_not_owned`.
      const reply = await dispatch(
        `requirements.${requirementId}.comment.${stateActivity.id}.edit`,
        { comment: 'x', actor: { id: OTHER_USER, roles: ['user'] } }
      );

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.ACTIVITY_NOT_EDITABLE);
    });

    it('TS-13: `visibilityLevel` en el payload se rechaza', async () => {
      const reply = await dispatch(`requirements.${requirementId}.comment.${cid}.edit`, {
        editor: CREATOR, comment: 'x', visibilityLevel: 'public',
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
      const activity = await RequirementActivity.findByPk(cid);
      activity!.visibilityLevel.should.equal('internal');
      activity!.newValue.should.equal('texto original');
    });

    it('TS-15: cualquier campo desconocido se rechaza', async () => {
      const reply = await dispatch(`requirements.${requirementId}.comment.${cid}.edit`, {
        editor: CREATOR, comment: 'x', attachmentIds: [1],
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    });

    it('TS-16: falla sin `comment` (campo requerido)', async () => {
      const reply = await dispatch(`requirements.${requirementId}.comment.${cid}.edit`, {
        editor: CREATOR,
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    });

    it('TS-17: falla sin actor resoluble', async () => {
      const reply = await dispatch(`requirements.${requirementId}.comment.${cid}.edit`, {
        comment: 'x',
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    });

    it('TS-18: comentario inexistente', async () => {
      const before = await RequirementActivity.count();

      const reply = await dispatch(
        `requirements.${requirementId}.comment.999999.edit`,
        { editor: CREATOR, comment: 'x' }
      );

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.COMMENT_NOT_FOUND);
      (await RequirementActivity.count()).should.equal(before);
    });

    it('TS-20: el comentario existe pero pertenece a OTRO requisito', async () => {
      const otherRequirement = await Requirement.create({
        title: 'Otro requisito', description: 'x', projectId, createdBy: CREATOR,
      });

      const reply = await dispatch(
        `requirements.${otherRequirement.id}.comment.${cid}.edit`,
        { editor: CREATOR, comment: 'x' }
      );

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.COMMENT_NOT_FOUND);
      const activity = await RequirementActivity.findByPk(cid);
      activity!.newValue.should.equal('texto original');
    });

    it('TS-22: el requisito del subject no existe', async () => {
      const reply = await dispatch(
        `requirements.999999.comment.${cid}.edit`,
        { editor: CREATOR, comment: 'x' }
      );

      reply.status.should.equal('failure');
      // El comando va directo al par (id, requirementId): un requisito inexistente no tiene
      // ningún comentario que coincida con ese par, así que responde `comment_not_found`.
      reply.errorCode!.should.equal(ErrorCode.COMMENT_NOT_FOUND);
    });

    it('TS-25 (parcial, ver suite de adjuntos): con `fileIds` ausente el comando igual escribe el texto', async () => {
      const reply = await dispatch(`requirements.${requirementId}.comment.${cid}.edit`, {
        editor: CREATOR, comment: 'solo texto',
      });

      reply.status.should.equal('success');
      const activity = await RequirementActivity.findByPk(cid);
      activity!.newValue.should.equal('solo texto');
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

/**
 * S-003: `fileIds`, titularidad y el vínculo contra la entidad ya existente.
 *
 * Todo entra por `dispatch()` (ADR-013), que es lo único que ejercita el comportamiento
 * transaccional: el test que importa de la titularidad no es que devuelva `file_not_owned`,
 * es que NO QUEDE la entidad.
 *
 * EL `caller` SE PASA SIEMPRE EXPLÍCITO: el default de `dispatch()` (`'api'`) NO coincide con
 * `CORE_TRUSTED_PUBLISHER_ID` a propósito, así que un test que se lo olvide cae en la rama
 * externa, pasa en verde y no prueba lo que dice probar.
 */
describe('requirements — vinculación de archivos (S-003)', () => {
  let projectId: number;
  let personId: number;
  let requirementId: number;
  let fileSeq = 0;

  /** Un `File` de fixture, con los campos que cada test quiera pisar. */
  async function makeFile(overrides: Record<string, unknown> = {}): Promise<File> {
    fileSeq += 1;
    return File.create({
      fileName: 'informe.pdf',
      fileSize: 4194304,
      mimeType: 'application/pdf',
      storageKey: `grava-gestion/f/fixture-${fileSeq}.pdf`,
      storageBucket: 'test-bucket',
      storageRegion: 'us-east-1',
      byteStatus: ByteStatus.Pending,
      uploadedBy: UPLOADER_A,
      retentionStatus: RetentionStatus.Active,
      ...overrides,
    });
  }

  /** Payload mínimo válido de `requirements.new`, con lo que cada test agregue. */
  function newReq(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      creator: UPLOADER_A, title: 'Req', description: 'd', projectId, ...overrides,
    };
  }

  before(async () => {
    // `roles` desde S-017, y SOLO para los dos callers externos: la compuerta de autorización lee
    // esta lista, y `internal-app` —el rol de conector— autoriza todo comando, incluidos los tres
    // subjects de requisitos que este archivo ejercita por la rama externa. Los dos son conectores
    // que NO son la api: sus `sub` no coinciden con `CORE_TRUSTED_PUBLISHER_ID`, que es lo que los
    // manda por la rama externa de `resolveActor`.
    //
    // `ADMIN` NO lleva roles a propósito: acá es un autor DECLARADO EN EL CUERPO, nunca un
    // `caller`, y darle `['admin']` sugeriría que su rol influye en algo — lo contrario de lo que
    // afirma `TS-13: sin excepción por rol`.
    const ROLES_BY_ID: Record<string, string[]> = {
      [EXTERNAL]: ['internal-app'],
      [EXTERNAL_B]: ['internal-app'],
    };
    for (const [id, username] of [
      [UPLOADER_A, 'uploader-a-s3'], [UPLOADER_B, 'uploader-b-s3'],
      [ADMIN, 'admin-s3'], [EXTERNAL, 'externo-s3'], [EXTERNAL_B, 'externo-b-s3'],
      [TRUSTED, 'api-su-s3'],
    ] as [string, string][]) {
      await User.create({
        id, name: id, username, email: `${username}@test.local`,
        ...(ROLES_BY_ID[id] ? { roles: ROLES_BY_ID[id] } : {}),
      });
    }
    const project = await Project.create({
      name: 'Proyecto Files', code: 'FILES', status: 'activo', type: 'comercial',
      description: 'x', initDate: new Date(), createdBy: UPLOADER_A,
    });
    projectId = project.id;
    const person = await Person.create({
      firstName: 'Ana', lastName: 'F', enabled: true, initDate: new Date('2026-01-01'),
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
    await PersonRequirement.destroy({ where: {} });
    await Requirement.destroy({ where: {} });
    await Person.destroy({ where: {} });
    await Project.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  beforeEach(async () => {
    const requirement = await Requirement.create({
      title: 'Para comentar', description: 'x', projectId, createdBy: UPLOADER_A,
    });
    requirementId = requirement.id;
  });

  afterEach(async () => {
    await Attachment.destroy({ where: {}, force: true });
    await File.destroy({ where: {} });
    await ObjectiveActivity.destroy({ where: {} });
    await PersonObjective.destroy({ where: {} });
    await Objective.destroy({ where: {} });
    await RequirementActivity.destroy({ where: {} });
    await PersonRequirement.destroy({ where: {} });
    await Requirement.destroy({ where: {} });
  });

  describe('requirements.new', () => {
    it('TS-1: vincula tres archivos propios al requisito creado', async () => {
      const [f1, f2, f3] = [await makeFile(), await makeFile(), await makeFile()];

      const reply = await dispatch<{ id: number }>(
        'requirements.new', newReq({ fileIds: [f1.id, f2.id, f3.id] }), TRUSTED
      );

      reply.status.should.equal('success');
      (await Requirement.findByPk(reply.data!.id))!.should.be.ok();
      const links = await Attachment.findAll({
        where: { entityType: 'requirement', entityId: reply.data!.id },
      });
      links.length.should.equal(3);
      links.map((a) => a.fileId).sort().should.deepEqual([f1.id, f2.id, f3.id].sort());
    });

    it('TS-2: el vínculo se crea por INSERT, sin ningún entityType de draft', async () => {
      const f1 = await makeFile();

      const reply = await dispatch<{ id: number }>(
        'requirements.new', newReq({ fileIds: [f1.id] }), TRUSTED
      );

      reply.status.should.equal('success');
      (await Attachment.count({ where: { entityType: { [Op.in]: DRAFT_TYPES } } }))
        .should.equal(0);
      const link = await Attachment.findOne({ where: { fileId: f1.id } });
      // El vínculo nació después del archivo: es un INSERT nuevo, no un reanclaje del draft.
      link!.createdAt.getTime().should.be.aboveOrEqual(f1.createdAt.getTime());
    });

    it('TS-3: `attachmentScope` ya no se acepta', async () => {
      const f1 = await makeFile();

      const reply = await dispatch(
        'requirements.new',
        newReq({ fileIds: [f1.id], attachmentScope: 'project' }),
        TRUSTED
      );

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
      (await Requirement.count({ where: { title: 'Req' } })).should.equal(0);
    });

    it('TS-4: `attachmentIds` ya no se acepta', async () => {
      const reply = await dispatch(
        'requirements.new', newReq({ attachmentIds: [1] }), TRUSTED
      );
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    });

    it('TS-5: si un fileId falla, no queda ni el requisito ni un solo vínculo', async () => {
      const [f1, f2] = [await makeFile(), await makeFile()];

      const reply = await dispatch(
        'requirements.new', newReq({ fileIds: [f1.id, f2.id, 999999] }), TRUSTED
      );

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
      (await Requirement.count({ where: { title: 'Req' } })).should.equal(0);
      (await Attachment.count()).should.equal(0);
    });

    it('TS-6: los File sobreviven al rollback, sin vínculo y sin el UPDATE', async () => {
      const [f1, f2] = [await makeFile(), await makeFile()];

      await dispatch('requirements.new', newReq({ fileIds: [f1.id, f2.id, 999999] }), TRUSTED);

      for (const file of [f1, f2]) {
        const alive = await File.findByPk(file.id);
        alive!.should.be.ok();
        // El UPDATE de byte_status revirtió con el resto de la transacción.
        alive!.byteStatus.should.equal(ByteStatus.Pending);
      }
      (await Attachment.count({ where: { fileId: { [Op.in]: [f1.id, f2.id] } } })).should.equal(0);
    });

    it('TS-7: byte_status pasa a uploaded al vincular con éxito', async () => {
      const [f1, f2] = [await makeFile(), await makeFile()];

      const reply = await dispatch(
        'requirements.new', newReq({ fileIds: [f1.id, f2.id] }), TRUSTED
      );

      reply.status.should.equal('success');
      for (const file of [f1, f2]) {
        (await File.findByPk(file.id))!.byteStatus.should.equal(ByteStatus.Uploaded);
      }
    });

    it('TS-8: un File ya uploaded que se vincula de nuevo sigue uploaded', async () => {
      const f1 = await makeFile({ byteStatus: ByteStatus.Uploaded });

      const reply = await dispatch('requirements.new', newReq({ fileIds: [f1.id] }), TRUSTED);

      reply.status.should.equal('success');
      (await File.findByPk(f1.id))!.byteStatus.should.equal(ByteStatus.Uploaded);
    });

    it('TS-14: un fileId inexistente da invalid_fields, no file_not_owned', async () => {
      const reply = await dispatch('requirements.new', newReq({ fileIds: [999999] }), TRUSTED);

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
      reply.errorCode!.should.not.equal(ErrorCode.FILE_NOT_OWNED);
      (await Requirement.count({ where: { title: 'Req' } })).should.equal(0);
    });

    it('TS-15: un fileId con retention_status no active da invalid_fields', async () => {
      const f1 = await makeFile({ retentionStatus: RetentionStatus.ScheduledForDeletion });

      const reply = await dispatch('requirements.new', newReq({ fileIds: [f1.id] }), TRUSTED);

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
      (await Requirement.count({ where: { title: 'Req' } })).should.equal(0);
    });

    it('TS-16: ajeno Y retirado da invalid_fields — la vida se chequea primero', async () => {
      const f1 = await makeFile({
        retentionStatus: RetentionStatus.Deleted, uploadedBy: UPLOADER_B,
      });

      const reply = await dispatch('requirements.new', newReq({ fileIds: [f1.id] }), TRUSTED);

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    });

    it('TS-17: 11 fileIds los rechaza Joi sin tocar la base', async () => {
      const reply = await dispatch(
        'requirements.new',
        newReq({ fileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }),
        TRUSTED
      );

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
      reply.errorMessage!.should.match(/items/);
      (await Requirement.count({ where: { title: 'Req' } })).should.equal(0);
    });

    it('TS-18: exactamente 10 fileIds se aceptan — el límite es inclusivo', async () => {
      const files = [];
      for (let i = 0; i < 10; i += 1) {
        files.push(await makeFile());
      }

      const reply = await dispatch<{ id: number }>(
        'requirements.new', newReq({ fileIds: files.map((f) => f.id) }), TRUSTED
      );

      reply.status.should.equal('success');
      (await Attachment.count({
        where: { entityType: 'requirement', entityId: reply.data!.id },
      })).should.equal(10);
    });

    it('TS-20: un fileId no entero o <= 0 lo rechaza Joi', async () => {
      for (const fileIds of [[0], ['abc']]) {
        const reply = await dispatch('requirements.new', newReq({ fileIds }), TRUSTED);
        reply.status.should.equal('failure');
        reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
      }
    });

    it('TS-21: `fileIds` ausente no rompe nada y no toca `files`', async () => {
      const f1 = await makeFile();

      const reply = await dispatch('requirements.new', newReq(), TRUSTED);

      reply.status.should.equal('success');
      (await Attachment.count()).should.equal(0);
      (await File.findByPk(f1.id))!.byteStatus.should.equal(ByteStatus.Pending);
    });

    it('TS-38: un fileId repetido se deduplica en un solo vínculo', async () => {
      const f1 = await makeFile();

      const reply = await dispatch<{ id: number }>(
        'requirements.new', newReq({ fileIds: [f1.id, f1.id] }), TRUSTED
      );

      reply.status.should.equal('success');
      (await Attachment.count({ where: { fileId: f1.id } })).should.equal(1);
    });

    it('TS-36: subir y vincular por el mismo canal da titularidad verdadera', async () => {
      const s3 = installS3Double();
      try {
        const upload = await dispatch<{ id: number }>('files.request-upload', {
          uploader: UPLOADER_A, fileName: 'x.pdf', mimeType: 'application/pdf', fileSize: 100,
        }, TRUSTED);
        upload.status.should.equal('success');

        const reply = await dispatch<{ id: number }>(
          'requirements.new', newReq({ fileIds: [upload.data!.id] }), TRUSTED
        );

        // `resolveActor` es LA MISMA función en los dos comandos: si divergieran, este
        // vínculo sería imposible de crear.
        reply.status.should.equal('success');
        (await Attachment.count({ where: { fileId: upload.data!.id } })).should.equal(1);
      } finally {
        uninstallS3Double();
        void s3;
      }
    });
  });

  describe('requirements.{id}.comment — las cuatro combinaciones de titularidad', () => {
    /** Cuenta los comentarios del requisito del test: lo que NO tiene que quedar. */
    function comments(): Promise<number> {
      return RequirementActivity.count({
        where: { requirementId, typeOfActivity: 'comment' },
      });
    }

    it('TS-34: vincula el archivo al comentario ya creado', async () => {
      const f1 = await makeFile();

      const reply = await dispatch<{ id: number }>(`requirements.${requirementId}.comment`, {
        author: UPLOADER_A, comment: 'hola', fileIds: [f1.id],
      }, TRUSTED);

      reply.status.should.equal('success');
      const links = await Attachment.findAll({ where: { fileId: f1.id } });
      links.length.should.equal(1);
      links[0].entityType.should.equal('requirement_comment');
      links[0].entityId!.should.equal(reply.data!.id);
    });

    it('TS-9: web↔web — el usuario B no vincula un archivo de A', async () => {
      const f1 = await makeFile({ uploadedBy: UPLOADER_A });

      const reply = await dispatch(`requirements.${requirementId}.comment`, {
        author: UPLOADER_B, comment: 'hola', fileIds: [f1.id],
      }, TRUSTED);

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.FILE_NOT_OWNED);
      // Lo que importa: NO QUEDA EL COMENTARIO.
      (await comments()).should.equal(0);
      (await Attachment.count()).should.equal(0);
    });

    it('TS-10: web→externo — el externo no vincula un archivo de una persona', async () => {
      const f1 = await makeFile({ uploadedBy: UPLOADER_A });

      // El `author` declarado coincide con el `uploaded_by`, pero se IGNORA: por la rama
      // externa el actor es el `caller`.
      const reply = await dispatch(`requirements.${requirementId}.comment`, {
        author: UPLOADER_A, comment: 'hola', fileIds: [f1.id],
      }, EXTERNAL);

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.FILE_NOT_OWNED);
      (await comments()).should.equal(0);
    });

    it('TS-11: externo↔externo — el servicio B no vincula un archivo del A', async () => {
      const f1 = await makeFile({ uploadedBy: EXTERNAL });

      // El `author` declarado es un usuario real (`changed_by` tiene FK contra `users`) pero
      // ajeno al `caller`: por la rama externa se IGNORA para la titularidad, que es
      // justamente lo que este test verifica.
      const reply = await dispatch(`requirements.${requirementId}.comment`, {
        author: UPLOADER_A, comment: 'hola', fileIds: [f1.id],
      }, EXTERNAL_B);

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.FILE_NOT_OWNED);
      (await comments()).should.equal(0);
    });

    it('TS-12: el servicio externo SÍ vincula lo que él mismo subió', async () => {
      const f1 = await makeFile({ uploadedBy: EXTERNAL });

      // El `author` declarado es OTRO usuario, y se ignora: el actor es el `caller`, que es
      // quien subió el archivo. Por eso el vínculo se crea.
      const reply = await dispatch<{ id: number }>(`requirements.${requirementId}.comment`, {
        author: UPLOADER_A, comment: 'hola', fileIds: [f1.id],
      }, EXTERNAL);

      reply.status.should.equal('success');
      const link = await Attachment.findOne({ where: { fileId: f1.id } });
      link!.entityType.should.equal('requirement_comment');
      link!.entityId!.should.equal(reply.data!.id);
    });

    it('TS-13: sin excepción por rol — el admin tampoco vincula lo ajeno', async () => {
      const f1 = await makeFile({ uploadedBy: UPLOADER_A });

      const reply = await dispatch(`requirements.${requirementId}.comment`, {
        author: ADMIN, comment: 'hola', fileIds: [f1.id],
      }, TRUSTED);

      // Idéntico a TS-9: no hay ninguna rama de código que consulte rol.
      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.FILE_NOT_OWNED);
      (await comments()).should.equal(0);
    });

    it('TS-12 (S-034): con sobre y rol admin RESUELTO, sigue sin excepción por rol', async () => {
      // Distinto del test anterior: acá el ACTOR RESUELTO (no solo un campo declarado en el
      // cuerpo) lleva `roles: ['admin']` de verdad, vía el sobre de identidad (S-029/S-030).
      // `resolveActor` devuelve `ctx.actor.id` (ADMIN) y `ctx.roles` es realmente `['admin']` —
      // es la evidencia que TS-12 del Story Plan pide: ni siquiera con el rol admin RESUELTO
      // hay una rama que lo consulte para la titularidad.
      const f1 = await makeFile({ uploadedBy: UPLOADER_A });

      const reply = await dispatch(`requirements.${requirementId}.comment`, {
        author: ADMIN, comment: 'hola', fileIds: [f1.id], actor: { id: ADMIN, roles: ['admin'] },
      }, TRUSTED);

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.FILE_NOT_OWNED);
      (await comments()).should.equal(0);
    });

    it('TS-4/TS-19: rechaza `attachmentIds` y 11 `fileIds`', async () => {
      const conAttachments = await dispatch(`requirements.${requirementId}.comment`, {
        author: UPLOADER_A, comment: 'hola', attachmentIds: [1],
      }, TRUSTED);
      conAttachments.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);

      const conOnce = await dispatch(`requirements.${requirementId}.comment`, {
        author: UPLOADER_A, comment: 'hola', fileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      }, TRUSTED);
      conOnce.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    });

    it('TS-37: la rama externa loguea en warn sin filtrar el payload', async () => {
      const f1 = await makeFile({ uploadedBy: EXTERNAL });
      const warn = sinon.spy(logger, 'warn');

      try {
        await dispatch(`requirements.${requirementId}.comment`, {
          author: UPLOADER_A, comment: 'secreto', fileIds: [f1.id],
        }, EXTERNAL);

        warn.callCount.should.equal(1);
        const message = String(warn.firstCall.args[0]);
        message.should.containEql(EXTERNAL);
        message.should.not.containEql('secreto');
        message.should.not.containEql(String(f1.id));
      } finally {
        warn.restore();
      }
    });
  });

  /** REQ-011 (S-046): adjuntos de `requirements.{id}.comment.{cid}.edit`, vía `syncFileLinks`. */
  describe('requirements.{id}.comment.{cid}.edit — adjuntos (conjunto completo)', () => {
    let editCid: number;

    beforeEach(async () => {
      const activity = await RequirementActivity.create({
        typeOfActivity: 'comment',
        previousValue: '',
        newValue: 'texto original',
        visibilityLevel: 'internal',
        requirementId,
        changedBy: UPLOADER_A,
      });
      editCid = activity.id;
    });

    function links(): Promise<Attachment[]> {
      return Attachment.findAll({
        where: { entityType: 'requirement_comment', entityId: editCid }, order: [['id', 'ASC']],
      });
    }

    it('TS-23: agrega uno nuevo y quita uno existente en la misma edición', async () => {
      const f1 = await makeFile();
      const f2 = await makeFile();
      const f3 = await makeFile();
      const seeded = await dispatch(`requirements.${requirementId}.comment.${editCid}.edit`, {
        editor: UPLOADER_A, comment: 'con adjuntos iniciales', fileIds: [f1.id, f2.id],
      }, TRUSTED);
      seeded.status.should.equal('success');
      const before = await links();
      const originalOfF1 = before.find((a) => a.fileId === f1.id)!;

      const reply = await dispatch(`requirements.${requirementId}.comment.${editCid}.edit`, {
        editor: UPLOADER_A, comment: 'con adjuntos', fileIds: [f1.id, f3.id],
      }, TRUSTED);

      reply.status.should.equal('success');
      const after = await links();
      after.map((a) => a.fileId).sort().should.deepEqual([f1.id, f3.id].sort());
      // El vínculo de f1 CONSERVA su fila original: mismo id, mismo createdAt.
      const nowOfF1 = after.find((a) => a.fileId === f1.id)!;
      nowOfF1.id.should.equal(originalOfF1.id);
      nowOfF1.createdAt.getTime().should.equal(originalOfF1.createdAt.getTime());
      const f3File = await File.findByPk(f3.id);
      f3File!.byteStatus.should.equal(ByteStatus.Uploaded);
      const activity = await RequirementActivity.findByPk(editCid);
      activity!.newValue.should.equal('con adjuntos');
      (activity!.editedAt === null).should.be.false();
    });

    it('TS-25: `fileIds` ausente no toca los vínculos', async () => {
      const f1 = await makeFile();
      const seeded = await dispatch(`requirements.${requirementId}.comment.${editCid}.edit`, {
        editor: UPLOADER_A, comment: 'con un adjunto', fileIds: [f1.id],
      }, TRUSTED);
      seeded.status.should.equal('success');
      const before = await links();
      before.length.should.equal(1);

      const reply = await dispatch(`requirements.${requirementId}.comment.${editCid}.edit`, {
        editor: UPLOADER_A, comment: 'solo texto',
      }, TRUSTED);

      reply.status.should.equal('success');
      const activity = await RequirementActivity.findByPk(editCid);
      activity!.newValue.should.equal('solo texto');
      // `fileIds` ausente (no `[]`): el vínculo previo SIGUE EXISTIENDO, misma fila.
      const after = await links();
      after.length.should.equal(1);
      after[0].id.should.equal(before[0].id);
      after[0].fileId!.should.equal(f1.id);
    });

    it('TS-26: la titularidad se valida solo sobre los ids NUEVOS', async () => {
      const fB = await makeFile({ uploadedBy: UPLOADER_B });
      const fA = await makeFile({ uploadedBy: UPLOADER_A });
      // Vínculo previo a un archivo ajeno, armado A MANO en el fixture: ningún comando puede
      // crearlo (la titularidad se lo impediría). Existe para probar que la revalidación NO
      // ocurre sobre lo que ya estaba vinculado — es la asimetría deliberada de
      // `link-files.ts` (titularidad solo sobre los ids nuevos del conjunto).
      await Attachment.create({ entityType: 'requirement_comment', entityId: editCid, fileId: fB.id });

      const reply = await dispatch(`requirements.${requirementId}.comment.${editCid}.edit`, {
        editor: UPLOADER_A, comment: 'x', fileIds: [fB.id, fA.id],
      }, TRUSTED);

      reply.status.should.equal('success');
      const after = await links();
      after.map((a) => a.fileId).sort().should.deepEqual([fA.id, fB.id].sort());
    });

    it('TS-27: un `fileId` nuevo ajeno se rechaza y NO deja escritura parcial', async () => {
      const fX = await makeFile({ uploadedBy: UPLOADER_B });

      const reply = await dispatch(`requirements.${requirementId}.comment.${editCid}.edit`, {
        editor: UPLOADER_A, comment: 'texto nuevo', fileIds: [fX.id],
      }, TRUSTED);

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.FILE_NOT_OWNED);
      const activity = await RequirementActivity.findByPk(editCid);
      activity!.newValue.should.equal('texto original');
      (activity!.editedAt === null).should.be.true();
      (activity!.editedBy === null).should.be.true();
      (await Attachment.count()).should.equal(0);
    });

    it('TS-28: sin excepción por rol — el admin tampoco vincula lo ajeno', async () => {
      const fX = await makeFile({ uploadedBy: UPLOADER_B });
      const adminActivity = await RequirementActivity.create({
        typeOfActivity: 'comment', previousValue: '', newValue: 'original admin',
        visibilityLevel: 'internal', requirementId, changedBy: ADMIN,
      });

      const reply = await dispatch(`requirements.${requirementId}.comment.${adminActivity.id}.edit`, {
        comment: 'x', fileIds: [fX.id], actor: { id: ADMIN, roles: ['admin'] },
      }, TRUSTED);

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.FILE_NOT_OWNED);
      const reread = await RequirementActivity.findByPk(adminActivity.id);
      reread!.newValue.should.equal('original admin');
      (await Attachment.count()).should.equal(0);
    });

    it('TS-29: más de 10 `fileIds` se rechaza antes de la transacción', async () => {
      const reply = await dispatch(`requirements.${requirementId}.comment.${editCid}.edit`, {
        editor: UPLOADER_A, comment: 'x', fileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      }, TRUSTED);

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
      const activity = await RequirementActivity.findByPk(editCid);
      activity!.newValue.should.equal('texto original');
    });

    it('TS-30: un `fileId` inexistente da `invalid_fields`, no `file_not_owned`', async () => {
      const reply = await dispatch(`requirements.${requirementId}.comment.${editCid}.edit`, {
        editor: UPLOADER_A, comment: 'x', fileIds: [999999],
      }, TRUSTED);

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
      const activity = await RequirementActivity.findByPk(editCid);
      activity!.newValue.should.equal('texto original');
    });
  });

  describe('requirements.{id}.edit — conjunto completo', () => {
    let editId: number;
    let f1: File;
    let f2: File;
    let f3: File;

    beforeEach(async () => {
      const requirement = await Requirement.create({
        title: 'viejo', description: 'x', projectId, createdBy: UPLOADER_A,
      });
      editId = requirement.id;
      [f1, f2, f3] = [await makeFile(), await makeFile(), await makeFile()];
      // Se vinculan por el propio comando, para que las filas nazcan como en producción.
      const seeded = await dispatch(`requirements.${editId}.edit`, {
        editor: UPLOADER_A, fileIds: [f1.id, f2.id, f3.id],
      }, TRUSTED);
      seeded.status.should.equal('success');
    });

    function links(): Promise<Attachment[]> {
      return Attachment.findAll({
        where: { entityType: 'requirement', entityId: editId }, order: [['id', 'ASC']],
      });
    }

    it('TS-24: conserva los declarados y borra el resto', async () => {
      const reply = await dispatch(`requirements.${editId}.edit`, {
        editor: UPLOADER_A, fileIds: [f1.id, f2.id],
      }, TRUSTED);

      reply.status.should.equal('success');
      const remaining = await links();
      remaining.length.should.equal(2);
      remaining.map((a) => a.fileId).sort().should.deepEqual([f1.id, f2.id].sort());
      (await Attachment.count({ where: { fileId: f3.id } })).should.equal(0);
    });

    it('TS-25: el File del vínculo borrado se conserva intacto', async () => {
      const before = await File.findByPk(f3.id);

      await dispatch(`requirements.${editId}.edit`, {
        editor: UPLOADER_A, fileIds: [f1.id, f2.id],
      }, TRUSTED);

      const after = await File.findByPk(f3.id);
      after!.should.be.ok();
      after!.retentionStatus.should.equal(RetentionStatus.Active);
      after!.byteStatus.should.equal(before!.byteStatus);
    });

    it('TS-26: agregar uno nuevo no recrea los que ya estaban', async () => {
      const f4 = await makeFile();
      const before = await links();
      const originalOfF1 = before.find((a) => a.fileId === f1.id)!;

      const reply = await dispatch(`requirements.${editId}.edit`, {
        editor: UPLOADER_A, fileIds: [f1.id, f2.id, f3.id, f4.id],
      }, TRUSTED);

      reply.status.should.equal('success');
      const after = await links();
      after.length.should.equal(4);
      const nowOfF1 = after.find((a) => a.fileId === f1.id)!;
      nowOfF1.id.should.equal(originalOfF1.id);
      nowOfF1.createdAt.getTime().should.equal(originalOfF1.createdAt.getTime());
    });

    it('TS-27: `fileIds` ausente no toca los vínculos', async () => {
      const before = await links();

      const reply = await dispatch(`requirements.${editId}.edit`, {
        editor: UPLOADER_A, title: 'nuevo',
      }, TRUSTED);

      reply.status.should.equal('success');
      const after = await links();
      after.map((a) => a.id).should.deepEqual(before.map((a) => a.id));
    });

    it('TS-28: `fileIds: []` desvincula todo y conserva los File', async () => {
      const reply = await dispatch(`requirements.${editId}.edit`, {
        editor: UPLOADER_A, fileIds: [],
      }, TRUSTED);

      reply.status.should.equal('success');
      (await links()).length.should.equal(0);
      for (const file of [f1, f2, f3]) {
        (await File.findByPk(file.id))!.should.be.ok();
      }
    });

    it('TS-29: un archivo ajeno descarta también el resto de la edición', async () => {
      const ajeno = await makeFile({ uploadedBy: UPLOADER_B });

      const reply = await dispatch(`requirements.${editId}.edit`, {
        editor: UPLOADER_A, title: 'nuevo', fileIds: [ajeno.id],
      }, TRUSTED);

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.FILE_NOT_OWNED);
      // El rollback descartó también el cambio de título.
      (await Requirement.findByPk(editId))!.title.should.equal('viejo');
      (await links()).length.should.equal(3);
    });

    it('TS-4/TS-19: rechaza `attachmentIds` y 11 `fileIds`', async () => {
      const conAttachments = await dispatch(`requirements.${editId}.edit`, {
        editor: UPLOADER_A, attachmentIds: [1],
      }, TRUSTED);
      conAttachments.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);

      const conOnce = await dispatch(`requirements.${editId}.edit`, {
        editor: UPLOADER_A, fileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      }, TRUSTED);
      conOnce.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    });
  });

  describe('regresión transversal', () => {
    it('TS-35: ninguna entidad de tipo draft se escribe nunca', async () => {
      const f1 = await makeFile();
      await dispatch('requirements.new', newReq({ fileIds: [f1.id] }), TRUSTED);

      const f2 = await makeFile();
      await dispatch(`requirements.${requirementId}.comment`, {
        author: UPLOADER_A, comment: 'hola', fileIds: [f2.id],
      }, TRUSTED);

      const f3 = await makeFile();
      await dispatch('tasks.new', {
        creator: UPLOADER_A, title: 'T', projectId, responsiblePersonIds: [personId],
        fileIds: [f3.id],
      }, TRUSTED);

      (await Attachment.count({ where: { entityType: { [Op.in]: DRAFT_TYPES } } }))
        .should.equal(0);
      (await Attachment.count()).should.equal(3);
    });
  });
});
