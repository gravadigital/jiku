import 'mocha';
import 'should';
import sinon from 'sinon';
import { Op } from 'sequelize';
import { Attachment, ByteStatus, File, Objective, ObjectiveActivity, Person, PersonObjective, PersonRequirement, Project, Requirement, RequirementActivity, RequirementSubscriptor, RetentionStatus, User } from '@jiku/models';
import { ErrorCode } from '@jiku/nats-protocol';
import logger from '../../src/logger';
import { dispatch } from '../helpers/dispatch';
import { installS3Double, uninstallS3Double } from '../helpers/s3-double';

const CREATOR = 'zitadel-sub-reqs';
const OTHER_USER = 'zitadel-sub-reqs-2';

/**
 * `CORE_TRUSTED_PUBLISHER_ID` de `.env.test`: el `caller` que ejercita la rama de la api. El
 * default de `dispatch()` (`'api'`) NO coincide con él a propósito, así que la rama confiable
 * se pide SIEMPRE explícitamente. Mismos nombres que en `files.test.ts`, para que los dos
 * archivos hablen el mismo idioma.
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
    for (const [id, username] of [
      [UPLOADER_A, 'uploader-a-s3'], [UPLOADER_B, 'uploader-b-s3'],
      [ADMIN, 'admin-s3'], [EXTERNAL, 'externo-s3'], [EXTERNAL_B, 'externo-b-s3'],
      [TRUSTED, 'api-su-s3'],
    ] as [string, string][]) {
      await User.create({ id, name: id, username, email: `${username}@test.local` });
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
