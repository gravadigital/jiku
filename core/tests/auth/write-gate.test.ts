import 'mocha';
import 'should';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import sinon from 'sinon';
import {
  Attachment,
  AttachmentEntityType,
  Client,
  File,
  Objective,
  ObjectiveActivity,
  Person,
  Project,
  Requirement,
  RequirementActivity,
  RequirementSubscriptor,
  RetentionStatus,
  User,
  UserProjectPermission,
} from '@jiku/models';
import { ErrorCode } from '@jiku/nats-protocol';
import { registry } from '../../src/commands';
import { getTrustedPublisherId } from '../../src/config';
import {
  COMMAND_ENTITY,
  ENTITY_PROJECT_RESOLVERS,
  authorizeEntityAccess,
} from '../../src/entity-project';
import logger from '../../src/logger';
import { sequelize } from '../../src/models';
import { dispatch } from '../helpers/dispatch';
import { installS3Double, uninstallS3Double } from '../helpers/s3-double';

/**
 * S-030 · LA COMPUERTA DE ESCRITURA: el mapa decide con el rol de la PERSONA, y el chequeo de
 * `user_project_permissions` se aplica SOLO EN MODO EXTERNO.
 *
 * VIVE BAJO `tests/auth/` Y NO ES DECORATIVO: esa carpeta corre primero por orden alfabético, y
 * ese orden es parte del contrato de los tests de la compuerta desde S-017.
 *
 * ENTRA SIEMPRE POR `dispatch()` (convención `testing`), nunca llamando a `execute()`: es lo único
 * que verifica el comportamiento transaccional, incluido el rollback.
 *
 * EL TEST QUE MÁS IMPORTA DE TODO EL ARCHIVO ES TS-48, y tiene nombre explícito: un `admin` SIN
 * fila en `user_project_permissions` ESCRIBE. Si ese test falla, el síntoma en producción es
 * "nadie puede hacer nada".
 */

/** Los callers. `SIN_FILA` no se crea nunca. */
const EXT = 'sub-s030-conector';
const ADM = 'sub-s030-admin';
const USR = 'sub-s030-user';
const CLI = 'sub-s030-externo';
/**
 * EL CALLER QUE HACE ALCANZABLE EL CHEQUEO DE ENTIDAD POR EL CANAL DIRECTO.
 *
 * `roles: ['user','external-user']` es una persona externa a la que además se le dio un rol
 * interno. La UNIÓN de `rolesAuthorize` lo autoriza en los 18 de `user`; la PRECEDENCIA de
 * `resolveCallerClass` lo pone en clase `external`. Sin él, el modo externo sería inalcanzable por
 * el canal directo —`external-user` solo no autoriza ningún comando— y el chequeo de entidad no
 * se podría probar de punta a punta.
 */
const MIX = 'sub-s030-mixto';
const VACIO = 'sub-s030-sin-roles';
const RARO = 'sub-s030-rol-raro';
const SIN_FILA = 'sub-s030-sin-fila';

const uploadPayload = { fileName: 'informe.pdf', mimeType: 'application/pdf', fileSize: 1024 };

describe('S-030 · la compuerta de escritura', () => {
  let P1: number;
  let P2: number;
  let R1: number;
  let O1: number;
  let RA1: number;
  let OA1: number;

  before(async () => {
    // Los comandos de `files` firman contra S3: el doble evita salir a la red y deja el foco en
    // la compuerta, que es lo que este archivo prueba.
    installS3Double();

    await User.bulkCreate([
      { id: EXT, name: 'Conector', username: 's030-ext', email: 's030-ext@t.local',
        roles: ['internal-app'] },
      { id: ADM, name: 'Admin', username: 's030-adm', email: 's030-adm@t.local',
        roles: ['admin'] },
      { id: USR, name: 'User', username: 's030-usr', email: 's030-usr@t.local',
        roles: ['user'] },
      { id: CLI, name: 'Cliente', username: 's030-cli', email: 's030-cli@t.local',
        roles: ['external-user'] },
      { id: MIX, name: 'Mixto', username: 's030-mix', email: 's030-mix@t.local',
        roles: ['user', 'external-user'] },
      { id: VACIO, name: 'Sin Roles', username: 's030-vacio', email: 's030-vacio@t.local' },
      { id: RARO, name: 'Raro', username: 's030-raro', email: 's030-raro@t.local',
        roles: ['wizard'] },
    ]);

    const p1 = await Project.create({
      name: 'Proyecto S030', code: 'S030A', status: 'activo', type: 'comercial',
      description: 'x', initDate: new Date(), createdBy: ADM,
    });
    P1 = p1.id;
    const p2 = await Project.create({
      name: 'Proyecto S030 B', code: 'S030B', status: 'activo', type: 'comercial',
      description: 'x', initDate: new Date(), createdBy: ADM,
    });
    P2 = p2.id;

    const r1 = await Requirement.create({
      title: 'Req S030', description: 'x', projectId: P1, createdBy: ADM,
    });
    R1 = r1.id;
    const o1 = await Objective.create({
      title: 'Task S030', state: 'backlog', area: 'desarrollo', priority: 0,
      projectId: P1, createdBy: ADM,
    });
    O1 = o1.id;
    const ra1 = await RequirementActivity.create({
      typeOfActivity: 'comment', previousValue: '', newValue: 'hola',
      requirementId: R1, changedBy: ADM,
    } as any);
    RA1 = ra1.id;
    const oa1 = await ObjectiveActivity.create({
      typeOfActivity: 'comment', previousValue: '', newValue: 'hola',
      objectiveId: O1, changedBy: ADM,
    } as any);
    OA1 = oa1.id;
  });

  after(async () => {
    uninstallS3Double();
    await Attachment.destroy({ where: {} });
    await File.destroy({ where: {} });
    await UserProjectPermission.destroy({ where: {} });
    await RequirementSubscriptor.destroy({ where: {} });
    await RequirementActivity.destroy({ where: {} });
    await ObjectiveActivity.destroy({ where: {} });
    await Requirement.destroy({ where: {} });
    await Objective.destroy({ where: {} });
    await Person.destroy({ where: {} });
    await Client.destroy({ where: {} });
    await Project.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  afterEach(async () => {
    sinon.restore();
    await UserProjectPermission.destroy({ where: {} });
    await Client.destroy({ where: {} });
  });

  /** Le da al caller la fila `(caller, projectId)` que el modo externo exige. */
  const permitir = (userId: string, projectId: number) =>
    UserProjectPermission.create({ userId, projectId });

  // ==========================================================================================
  // EL CANAL DEL SOBRE — el camino de la api, que es el 100% del tráfico de hoy
  // ==========================================================================================

  describe('el canal del SOBRE (CA-2, CA-3)', () => {
    it('TS-25 · un `user` con sobre ESCRIBE: decide `actor.roles`, no el rol de la api', async () => {
      // ANTES DE S-030 EL MAPA NO SE CONSULTABA CON EL ROL DEL ACTOR: el caller era la api,
      // `internal-app`, y tenía `ALL`. Ahora decide el rol de la persona, y el resultado es el
      // mismo porque la enumeración se derivó del `x-roles` que la api ya aplica.
      const reply = await dispatch<{ id: number }>('clients.new', {
        name: 'Acme S030',
        actor: { id: USR, roles: ['user'] },
      });

      reply.status.should.equal('success');
      (typeof reply.data!.id).should.equal('number');
      (await Client.count()).should.equal(1);
    });

    it('TS-26 · un `admin` con sobre escribe', async () => {
      const reply = await dispatch('requirements.new', {
        title: 'Desde sobre', description: 'x', projectId: P1, creator: ADM,
        actor: { id: ADM, roles: ['admin'] },
      });

      reply.status.should.equal('success');
      await Requirement.destroy({ where: { title: 'Desde sobre' } });
    });

    it('TS-27 · H-1: un sobre `external-user` SÍ escribe los seis del portal', async () => {
      // ES EL CAMINO DEL PORTAL Y NO PUEDE ROMPERSE. La api manda el sobre con los roles de la
      // persona desde S-029, y `POST /api/opus/requirements` declara
      // `hasAnyRole(['user','external-user'])`. Con `commands: []` a secas este despacho daría
      // 403 y el portal dejaría de escribir — que es exactamente lo que D-1 evita.
      await permitir(CLI, P1);

      const reply = await dispatch('requirements.new', {
        title: 'Desde el portal', description: 'x', projectId: P1, creator: CLI,
        actor: { id: CLI, roles: ['external-user'] },
      });

      reply.status.should.equal('success');
      await Requirement.destroy({ where: { title: 'Desde el portal' } });
    });

    it('TS-28 · un sobre `external-user` sobre un comando FUERA de los 6 se rechaza', async () => {
      const reply = await dispatch('clients.new', {
        name: 'X',
        actor: { id: CLI, roles: ['external-user'] },
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
      reply.errorMessage!.should.equal('El caller no está autorizado a ejecutar este método');
      (await Client.count()).should.equal(0);
    });

    it('TS-29 · un sobre con `roles: []` no escribe', async () => {
      const reply = await dispatch('clients.new', {
        name: 'X',
        actor: { id: USR, roles: [] },
      });

      reply.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
      (await Client.count()).should.equal(0);
    });

    it('TS-30 · un sobre con solo roles DESCONOCIDOS no escribe', async () => {
      const reply = await dispatch('clients.new', {
        name: 'X',
        actor: { id: USR, roles: ['wizard'] },
      });

      reply.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
      (await Client.count()).should.equal(0);
    });

    it('TS-31 · el ESPEJO corre igual, ANTES del rechazo (S-029 CA-9, no se toca)', async () => {
      const reply = await dispatch('clients.new', {
        name: 'X',
        actor: {
          id: 'sub-s030-nuevo', roles: ['wizard'],
          name: 'Nuevo', username: 's030-nuevo', email: 's030-nuevo@t.local',
        },
      });

      reply.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
      const espejado = await User.findByPk('sub-s030-nuevo');
      espejado!.roles.should.deepEqual(['wizard']);
      await User.destroy({ where: { id: 'sub-s030-nuevo' } });
    });

    it('TS-32 · con sobre, la COMPUERTA no lee `users` — el claim es la fuente', async () => {
      // El claim ya fue verificado contra Zitadel por la api y es MÁS FRESCO que la fila.
      // `findByPk` no se invoca: las lecturas del espejo son `findByPk` de `mirrorUser`? No —
      // el espejo hace upsert por PK dentro de su transacción, así que un `findByPk` SIN
      // transacción solo puede venir de la compuerta.
      const findByPk = sinon.spy(User, 'findByPk');

      const reply = await dispatch('clients.new', {
        name: 'Sin lectura',
        actor: { id: USR, roles: ['user'] },
      });

      reply.status.should.equal('success');
      const deLaCompuerta = findByPk
        .getCalls()
        .filter((call) => !call.args[1] || !(call.args[1] as any).transaction);
      deLaCompuerta.length.should.equal(0);
    });
  });

  // ==========================================================================================
  // EL CANAL DIRECTO — una persona o un conector publicando al bus
  // ==========================================================================================

  describe('el canal DIRECTO (CA-1, CA-3, CA-4, CA-13)', () => {
    it('TS-33 · un `user` directo escribe, leyendo sus roles de la base', async () => {
      const reply = await dispatch('clients.new', { name: 'Directo' }, USR);

      reply.status.should.equal('success');
    });

    it('TS-34 · un `external-user` DIRECTO no escribe ninguno de los 6, ni con fila', async () => {
      // LA SEGUNDA DEFENSA DE CA-3: aunque la plantilla del callout se equivocara y le diera
      // permiso de publicación, el mapa no lo autoriza por el bus.
      await permitir(CLI, P1);

      const reply = await dispatch(
        'requirements.new',
        { title: 'No debería', description: 'x', projectId: P1, creator: CLI },
        CLI
      );

      reply.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
      (await Requirement.count({ where: { title: 'No debería' } })).should.equal(0);
    });

    it('TS-35 · un caller SIN fila en `users` es rechazado y no escribe nada', async () => {
      const reply = await dispatch('clients.new', { name: 'Fantasma' }, SIN_FILA);

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
      reply.errorMessage!.should.equal('El caller no está autorizado a ejecutar este método');
      (await Client.count()).should.equal(0);
    });

    it('TS-36 · con fila y `roles: []`, todo se rechaza', async () => {
      const reply = await dispatch('files.request-upload', uploadPayload, VACIO);

      reply.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
      (await File.count()).should.equal(0);
    });

    it('TS-37 · con solo roles desconocidos, todo se rechaza', async () => {
      const reply = await dispatch('clients.new', { name: 'X' }, RARO);

      reply.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
    });

    it('TS-38 · el publicador de confianza SIN sobre sigue exento y sin leer la base', async () => {
      // S-017 CA-1: es el caso donde `users` puede estar VACÍA porque el evento de autenticación
      // se perdió. Hacerlo depender de esa fila reintroduce la caída total de escritura.
      const findByPk = sinon.spy(User, 'findByPk');

      const reply = await dispatch('clients.new', { name: 'Exento' });

      reply.status.should.equal('success');
      findByPk.callCount.should.equal(0);
    });

    it('TS-39 · un conector que NO es la api pasa por su rol', async () => {
      const reply = await dispatch('clients.new', { name: 'Conector' }, EXT);

      reply.status.should.equal('success');
    });

    it('TS-40 · CA-13: UN SOLO `SELECT` a `users` por comando directo', async () => {
      // El MISMO resultado alimenta el mapa Y la clase de caller. Dos lecturas serían dos
      // fuentes para una decisión que tiene que ser una.
      const findByPk = sinon.spy(User, 'findByPk');

      await dispatch('clients.new', { name: 'Una sola lectura' }, USR);

      findByPk.callCount.should.equal(1);
    });

    it('TS-41 · la compuerta corre ANTES de `registry.resolve()`', async () => {
      const reply = await dispatch('widgets.explode', {}, SIN_FILA);

      reply.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
      reply.errorCode!.should.not.equal(ErrorCode.UNKNOWN_COMMAND);
    });

    it('TS-42 · un rechazo NO abre ninguna transacción', async () => {
      const transaction = sinon.spy(sequelize, 'transaction');

      await dispatch('clients.new', { name: 'X' }, SIN_FILA);

      transaction.callCount.should.equal(0);
    });

    it('TS-43 · si `findByPk` rechaza, se DENIEGA con `internal_error` (falla cerrada)', async () => {
      sinon.stub(User, 'findByPk').rejects(new Error('base caída'));

      const reply = await dispatch('clients.new', { name: 'X' }, USR);

      reply.errorCode!.should.equal(ErrorCode.INTERNAL_ERROR);
      reply.errorMessage!.should.equal('Internal error');
    });

    it('TS-44 · un `roles` que NO es array deniega, no explota', async () => {
      // `roles` es JSONB SIN CHECK y la tabla es escribible por SQL: un valor que no sea array es
      // alcanzable. `readCallerRoles` lo convierte en "sin roles", no en `internal_error`.
      await sequelize.query(`UPDATE users SET roles = '"admin"'::jsonb WHERE id = :id`, {
        replacements: { id: RARO },
      });
      try {
        const reply = await dispatch('clients.new', { name: 'X' }, RARO);
        reply.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
      } finally {
        await User.update({ roles: ['wizard'] }, { where: { id: RARO } });
      }
    });

    it('TS-45 · un cambio de roles aplica en el despacho SIGUIENTE (sin cache)', async () => {
      const antes = await dispatch('clients.new', { name: 'Antes' }, VACIO);
      antes.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);

      await User.update({ roles: ['user'] }, { where: { id: VACIO } });
      try {
        const despues = await dispatch('clients.new', { name: 'Después' }, VACIO);
        despues.status.should.equal('success');
      } finally {
        await User.update({ roles: [] }, { where: { id: VACIO } });
      }
    });

    it('TS-46 · el rechazo loguea UN `warn` con caller y método, y SIN el payload', async () => {
      const warn = sinon.spy(logger, 'warn');

      await dispatch('clients.new', { name: 'SECRETO' }, SIN_FILA);

      warn.callCount.should.equal(1);
      const message = String(warn.firstCall.args[0]);
      message.should.startWith('[auth] commands:');
      message.should.containEql(SIN_FILA);
      message.should.containEql('clients.new');
      message.should.not.containEql('SECRETO');
    });

    it('TS-47 · el camino AUTORIZADO no loguea nada', async () => {
      const warn = sinon.spy(logger, 'warn');

      await dispatch('clients.new', { name: 'X' });

      warn.called.should.be.false();
    });
  });

  // ==========================================================================================
  // EL CHEQUEO DE ENTIDAD — solo en modo externo
  // ==========================================================================================

  describe('el chequeo de entidad (CA-6, CA-7, CA-10)', () => {
    const comentario = { comment: 'hola', author: ADM };

    it(
      'TS-48 · H-3 (REGRESIÓN): un admin SIN fila en user_project_permissions ESCRIBE — ' +
        'aplicar el chequeo a todo caller rompería TODA la escritura interna',
      async () => {
        // LOS USUARIOS INTERNOS NO TIENEN FILAS en `user_project_permissions`: la tabla sostiene
        // el aislamiento del portal y no se administra desde ninguna interfaz. Si este test
        // falla, el síntoma en producción es "nadie puede hacer nada".
        (await UserProjectPermission.count()).should.equal(0);

        const reply = await dispatch(`requirements.${R1}.comment`, comentario, ADM);

        reply.status.should.equal('success');
      }
    );

    it('TS-49 · H-3, el otro rol interno: un `user` sin fila escribe', async () => {
      const reply = await dispatch(
        `requirements.${R1}.comment`,
        { ...comentario, author: USR },
        USR
      );

      reply.status.should.equal('success');
    });

    it('TS-50 · un CONECTOR sin fila escribe', async () => {
      const reply = await dispatch(
        `requirements.${R1}.comment`,
        { ...comentario, author: EXT },
        EXT
      );

      reply.status.should.equal('success');
    });

    it('TS-51 · el publicador de confianza SIN sobre escribe sin chequeo', async () => {
      const reply = await dispatch(`requirements.${R1}.comment`, comentario);

      reply.status.should.equal('success');
    });

    it('TS-52 · modo externo SIN fila para el proyecto de la entidad → `access_denied`', async () => {
      const reply = await dispatch(
        `requirements.${R1}.comment`,
        { ...comentario, author: MIX },
        MIX
      );

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.ACCESS_DENIED);
      // EL MENSAJE VA EN ESPAÑOL Y SIN DATOS INTERNOS: ni el proyecto, ni la entidad, ni la
      // tabla, ni el subject —que transporta el user id (CA-32 del REQ)—.
      reply.errorMessage!.should.equal('No tenés permiso sobre esta entidad');
      reply.errorMessage!.should.not.containEql(String(P1));
      reply.errorMessage!.should.not.containEql('user_project_permissions');
      reply.errorMessage!.should.not.containEql(MIX);
    });

    it('TS-53 · modo externo CON fila → pasa', async () => {
      await permitir(MIX, P1);

      const reply = await dispatch(
        `requirements.${R1}.comment`,
        { ...comentario, author: MIX },
        MIX
      );

      reply.status.should.equal('success');
    });

    it('TS-54 · el rechazo por entidad NO abre transacción', async () => {
      const transaction = sinon.spy(sequelize, 'transaction');

      await dispatch(`requirements.${R1}.comment`, { ...comentario, author: MIX }, MIX);

      transaction.callCount.should.equal(0);
    });

    it('TS-55 · el rechazo por entidad no escribe nada', async () => {
      const antes = await RequirementActivity.count();

      await dispatch(`requirements.${R1}.comment`, { ...comentario, author: MIX }, MIX);

      (await RequirementActivity.count()).should.equal(antes);
    });

    it('TS-56 · CA-10: `access_denied` y `caller_not_authorized` son DOS códigos', async () => {
      // Responden preguntas distintas: "¿podés tocar ESTA entidad?" vs "¿tu rol habilita este
      // método?". Fusionarlos obligaría a un consumidor a mapear un código a dos causas.
      const porEntidad = await dispatch(
        `requirements.${R1}.comment`,
        { ...comentario, author: MIX },
        MIX
      );
      const porRol = await dispatch(
        `requirements.${R1}.comment`,
        { ...comentario, author: CLI },
        CLI
      );

      porEntidad.errorCode!.should.equal(ErrorCode.ACCESS_DENIED);
      porRol.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
      porEntidad.errorMessage!.should.not.equal(porRol.errorMessage!);
    });

    it('TS-57 · el chequeo corre DESPUÉS de la validación Joi', async () => {
      const reply = await dispatch(`requirements.${R1}.comment`, { campoDesconocido: 1 }, MIX);

      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
      reply.errorCode!.should.not.equal(ErrorCode.ACCESS_DENIED);
    });

    it('TS-58 · un comando con descriptor `null` PASA en modo externo sin fila', async () => {
      // PARIDAD EXACTA CON `POST /api/opus/attachments`, cuya ruta no lleva capa 3 porque al
      // pedir el ticket todavía no hay vínculo sobre el que operar.
      const reply = await dispatch('files.request-upload', uploadPayload, MIX);

      reply.status.should.equal('success');
    });

    it('TS-59 · `unworked-times.new` (descriptor `null`) no da `access_denied`', async () => {
      // LA PERSONA ES DE `MIX`, Y ES UN CAMBIO DE FIXTURE, NO DE ASERCIÓN (S-031). Desde esta
      // story `unworked-times.new` aplica TITULARIDAD POR ACTOR (CA-10): una ausencia a nombre de
      // una Persona ajena responde `access_denied` POR UNA REGLA DE DOMINIO. Este test afirma que
      // la COMPUERTA DE ENTIDAD no lo tocó, así que la Persona tiene que ser la del caller o el
      // rechazo vendría de otro lado y el test dejaría de probar lo que dice su nombre.
      const person = await Person.create({
        firstName: 'Ana', lastName: 'S030', enabled: true,
        initDate: new Date('2026-01-01'), userId: MIX,
      });

      const reply = await dispatch(
        'unworked-times.new',
        { date: '2026-08-24', minutes: 60, reason: 'vacaciones', personId: person.id },
        MIX
      );

      // Puede fallar por una regla de dominio, que es OTRA cosa. Lo que se afirma es que la
      // compuerta de entidad no lo tocó. Se compara el BOOLEANO y no el código: un reply exitoso
      // no trae `errorCode`, y `undefined.should` explotaría antes de afirmar nada.
      (reply.errorCode === ErrorCode.ACCESS_DENIED).should.be.false();
    });
  });

  // ==========================================================================================
  // LOS 9 TIPOS DE ENTIDAD, UNO POR UNO (CA-8)
  // ==========================================================================================

  describe('los 9 tipos de entidad, por `attachments.{id}.delete` (CA-8)', () => {
    /**
     * Crea un archivo con su vínculo del tipo pedido y devuelve el id DEL VÍNCULO, que es el que
     * `attachments.{id}.delete` recibe en el subject.
     */
    async function vincular(
      entityType: AttachmentEntityType,
      entityId: number | null
    ): Promise<number> {
      const file = await File.create({
        fileName: 'a.png', mimeType: 'image/png', fileSize: 10,
        storageKey: `s030/${Date.now()}-${Math.random()}`,
        storageBucket: 'test-bucket', storageRegion: 'us-east-1',
        uploadedBy: ADM, retentionStatus: RetentionStatus.Active,
      } as any);
      const attachment = await Attachment.create({
        entityType, entityId, fileId: file.id, uploadedBy: ADM,
      } as any);
      return attachment.id;
    }

    /** Despacha el borrado del vínculo como `MIX` (clase externa) y devuelve el reply. */
    const borrar = (attachmentId: number) =>
      dispatch(`attachments.${attachmentId}.delete`, {}, MIX);

    /** Sin fila deniega; con fila para `projectId` pasa. Es la aserción de los 9 tipos. */
    async function denyThenAllow(attachmentId: number, projectId: number): Promise<void> {
      const sinFila = await borrar(attachmentId);
      sinFila.errorCode!.should.equal(ErrorCode.ACCESS_DENIED);

      await permitir(MIX, projectId);
      const conFila = await borrar(attachmentId);
      conFila.status.should.equal('success');
    }

    it('TS-60 · `project`: el `entity_id` ES el `project_id`', async () => {
      await denyThenAllow(await vincular(AttachmentEntityType.Project, P1), P1);
    });

    it('TS-61 · `requirement` → `Requirement.projectId`', async () => {
      await denyThenAllow(await vincular(AttachmentEntityType.Requirement, R1), P1);
    });

    it('TS-62 · `objective` → `Objective.projectId`', async () => {
      await denyThenAllow(await vincular(AttachmentEntityType.Objective, O1), P1);
    });

    it('TS-63 · `requirement_comment` → `RequirementActivity` → `Requirement.projectId`', async () => {
      await denyThenAllow(await vincular(AttachmentEntityType.RequirementComment, RA1), P1);
    });

    it('TS-64 · `objective_comment` → `ObjectiveActivity` → `Objective.projectId`', async () => {
      await denyThenAllow(await vincular(AttachmentEntityType.ObjectiveComment, OA1), P1);
    });

    it('TS-65 · `comment` (LEGADO): prueba LAS DOS cadenas', async () => {
      // Los ids de `objective_activity` y `requirement_activity` SE PISAN, así que el legado
      // prueba las dos y en el mismo orden que la api.
      await denyThenAllow(await vincular(AttachmentEntityType.Comment, OA1), P1);
      await UserProjectPermission.destroy({ where: {} });
      await denyThenAllow(await vincular(AttachmentEntityType.Comment, RA1), P1);
    });

    it('TS-66 · `comment_draft`: prueba requisito Y objetivo', async () => {
      await denyThenAllow(await vincular(AttachmentEntityType.CommentDraft, R1), P1);
      await UserProjectPermission.destroy({ where: {} });
      await denyThenAllow(await vincular(AttachmentEntityType.CommentDraft, O1), P1);
    });

    it('TS-67 · `objective_draft` / `requirement_draft`: el `entity_id` ES el `project_id`', async () => {
      await denyThenAllow(await vincular(AttachmentEntityType.ObjectiveDraft, P1), P1);
      await UserProjectPermission.destroy({ where: {} });
      await denyThenAllow(await vincular(AttachmentEntityType.RequirementDraft, P1), P1);
    });

    it('TS-68 · `stage`: DENIEGA SIEMPRE, aun con fila', async () => {
      // La tabla ya no existe: no hay proyecto que verificar, así que no se autoriza.
      const attachmentId = await vincular(AttachmentEntityType.Stage, P1);
      await permitir(MIX, P1);

      (await borrar(attachmentId)).errorCode!.should.equal(ErrorCode.ACCESS_DENIED);
    });

    it('TS-69 · un `entity_type` FUERA de los 9 deniega (ADR-008)', async () => {
      const attachmentId = await vincular(AttachmentEntityType.ObjectiveCommentDraft, R1);
      await permitir(MIX, P1);

      (await borrar(attachmentId)).errorCode!.should.equal(ErrorCode.ACCESS_DENIED);
    });

    it('TS-70 · una entidad INEXISTENTE deniega — nunca `success`, nunca `internal_error`', async () => {
      const attachmentId = await vincular(AttachmentEntityType.Requirement, 999999);
      await permitir(MIX, P1);

      const reply = await borrar(attachmentId);
      reply.errorCode!.should.equal(ErrorCode.ACCESS_DENIED);
      reply.errorCode!.should.not.equal(ErrorCode.INTERNAL_ERROR);
    });

    it('TS-60b · el proyecto EQUIVOCADO no alcanza: la fila tiene que ser la del proyecto resuelto', async () => {
      const attachmentId = await vincular(AttachmentEntityType.Requirement, R1);
      await permitir(MIX, P2);

      (await borrar(attachmentId)).errorCode!.should.equal(ErrorCode.ACCESS_DENIED);
    });
  });

  // ==========================================================================================
  // `files.{fileId}.request-download` — la doctrina del recorte `bridge` (S-027)
  // ==========================================================================================

  describe('`files.{fileId}.request-download`: los vínculos vivos y el huérfano propio', () => {
    async function crearArchivo(uploadedBy: string): Promise<number> {
      const file = await File.create({
        fileName: 'a.png', mimeType: 'image/png', fileSize: 10,
        storageKey: `s030-file/${Date.now()}-${Math.random()}`,
        storageBucket: 'test-bucket', storageRegion: 'us-east-1',
        uploadedBy, retentionStatus: RetentionStatus.Active,
      } as any);
      return file.id;
    }

    const bajar = (fileId: number) =>
      dispatch(`files.${fileId}.request-download`, { disposition: 'inline' }, MIX);

    it('TS-72 · vínculo vivo a un proyecto NO permitido → `access_denied`', async () => {
      const fileId = await crearArchivo(ADM);
      await Attachment.create({
        entityType: AttachmentEntityType.Requirement, entityId: R1, fileId, uploadedBy: ADM,
      } as any);

      (await bajar(fileId)).errorCode!.should.equal(ErrorCode.ACCESS_DENIED);
    });

    it('TS-73 · vínculo vivo a un proyecto PERMITIDO → pasa', async () => {
      const fileId = await crearArchivo(ADM);
      await Attachment.create({
        entityType: AttachmentEntityType.Requirement, entityId: R1, fileId, uploadedBy: ADM,
      } as any);
      await permitir(MIX, P1);

      (await bajar(fileId)).status.should.equal('success');
    });

    it('TS-74 · archivo HUÉRFANO PROPIO pasa', async () => {
      const fileId = await crearArchivo(MIX);

      (await bajar(fileId)).status.should.equal('success');
    });

    it('TS-75 · archivo HUÉRFANO AJENO no pasa', async () => {
      const fileId = await crearArchivo(ADM);

      (await bajar(fileId)).errorCode!.should.equal(ErrorCode.ACCESS_DENIED);
    });

    it('TS-74b · un archivo PROPIO con vínculo inalcanzable NO se filtra a quien lo subió', async () => {
      // LA RAMA DEL HUÉRFANO NO ES UN `orSelfColumn`: entra SOLO cuando no hay ningún vínculo
      // vivo. Si entrara siempre, un archivo vinculado a una entidad que el caller no puede ver
      // se le filtraría a quien lo subió.
      const fileId = await crearArchivo(MIX);
      await Attachment.create({
        entityType: AttachmentEntityType.Requirement, entityId: R1, fileId, uploadedBy: MIX,
      } as any);

      (await bajar(fileId)).errorCode!.should.equal(ErrorCode.ACCESS_DENIED);
    });
  });

  // ==========================================================================================
  // EL ORDEN COMPLETO Y LOS GATES DE ALCANCE
  // ==========================================================================================

  describe('el orden de la compuerta y los gates de alcance', () => {
    it('TS-76 · el orden es sobre → espejo → método → clase → entidad', async () => {
      // LA GUARDA DEL SOBRE GANA: un caller que no es el publicador de confianza mandando un
      // `actor` se rechaza con `invalid_fields` antes de que la compuerta mire nada.
      const reply = await dispatch(
        `requirements.${R1}.comment`,
        { comment: 'x', author: CLI, actor: { id: CLI, roles: ['external-user'] } },
        'otro-caller'
      );

      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
      reply.errorCode!.should.not.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
      reply.errorCode!.should.not.equal(ErrorCode.ACCESS_DENIED);
    });

    const REPO_ROOT = join(__dirname, '../../..');
    const grep = (pattern: string, where: string): string[] =>
      execSync(`grep -rl "${pattern}" ${where} || true`, { cwd: REPO_ROOT, encoding: 'utf8' })
        .trim()
        .split('\n')
        .filter(Boolean);

    it('TS-77 · (gate) CA-15: ningún comando conoce `UserProjectPermission`', async () => {
      // El chequeo vive EN LA COMPUERTA, no dentro de cada comando: es lo que permite saber si
      // un bug es de la compuerta o del comando, y lo que mantiene los 20 `execute()` intactos.
      grep('UserProjectPermission', 'core/src/commands/').should.deepEqual([]);
    });

    it('TS-78 · (gate) ningún comando importa el resolutor de entidad', async () => {
      grep('entity-project\\|resolveEntityProject', 'core/src/commands/').should.deepEqual([]);
    });

    it('TS-79 · (gate) la compuerta NO abre transacción (ADR-003)', async () => {
      // MIRA EL CÓDIGO Y NO LA PROSA, igual que el gate de "sin cache": los tres archivos de la
      // compuerta EXPLICAN en sus comentarios por qué no abren transacción —es una excepción
      // deliberada a la convención `orm`— y nombran `sequelize.transaction()` al hacerlo. Un
      // grep crudo confundiría esa explicación con lo que prohíbe.
      for (const file of [
        'core/src/authorize-caller.ts',
        'core/src/entity-project.ts',
        'core/src/caller-class.ts',
      ]) {
        const code = readFileSync(join(REPO_ROOT, file), 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*$/gm, '');
        code.includes('sequelize.transaction').should.be.false(file);
      }
    });

    it('TS-23 · (gate) D-3: `CLASS_BY_ROLE` y `PRECEDENCE` se declaran UNA SOLA VEZ', async () => {
      // Dos copias de una tabla de precedencia divergen, y el día que divergieran el aislamiento
      // del portal tendría DOS definiciones en vez de una con tres puntos de aplicación.
      grep('const CLASS_BY_ROLE', 'core/src/').should.deepEqual(['core/src/caller-class.ts']);
      grep('const PRECEDENCE', 'core/src/').should.deepEqual(['core/src/caller-class.ts']);
    });

    it('TS-24 · (gate) D-3: ningún archivo de `queries/` importa `./caller-class`', async () => {
      grep("from './caller-class'", 'core/src/queries/').should.deepEqual([]);
    });

    it('TS-71 · (gate) `ENTITY_PROJECT_RESOLVERS` declara EXACTAMENTE los 9 tipos', () => {
      // 10 CLAVES PARA 9 RENGLONES de `api/conventions/authorization.md`: el renglón
      // "`objective_draft`, `requirement_draft`" declara dos tipos con la misma resolución.
      Object.keys(ENTITY_PROJECT_RESOLVERS)
        .sort()
        .should.deepEqual([
          'comment',
          'comment_draft',
          'objective',
          'objective_comment',
          'objective_draft',
          'project',
          'requirement',
          'requirement_comment',
          'requirement_draft',
          'stage',
        ]);
    });

    it('TS-71b · (gate) los valores del enum SIN resolución no se autorizan (ADR-008)', () => {
      // `AttachmentEntityType` tiene 12 valores y la tabla resuelve 10. Los dos que faltan
      // tampoco los resuelve la api, así que DENIEGAN. Es deny-by-default, no un olvido — y si
      // alguien agrega un tipo al enum, este gate lo obliga a decidir qué hacer con él.
      const sinResolver = Object.values(AttachmentEntityType).filter(
        (value) => !(value in ENTITY_PROJECT_RESOLVERS)
      );
      sinResolver
        .sort()
        .should.deepEqual(['objective_comment_draft', 'requirement_comment_draft']);
    });

    it('TS-71c · (gate) `COMMAND_ENTITY` declara EXACTAMENTE los 20 del registry', () => {
      // NI UNA MÁS NI UNA MENOS, y contra el REGISTRY y no contra una lista a mano: un comando
      // que falte DENIEGA en modo externo (ADR-008) y uno que sobre es un patrón muerto.
      Object.keys(COMMAND_ENTITY).sort().should.deepEqual([...registry.patterns()].sort());
    });

    it('TS-71d · (gate) los 12 comandos sin entidad llevan `null` EXPLÍCITO', () => {
      // `null` ("no hay entidad que chequear: PASA") y AUSENTE ("DENIEGA") son dos cosas
      // distintas, y confundirlas es un bug de seguridad en las dos direcciones.
      const conNull = Object.entries(COMMAND_ENTITY)
        .filter(([, descriptor]) => descriptor === null)
        .map(([command]) => command);
      conNull.length.should.equal(12);
      // El que más importa: su ruta NO aplica capa 3 y su test de la api afirma que un
      // external-user sin ningún permiso de proyecto recibe 201.
      conNull.should.containEql('files.request-upload');
    });

    it('TS-71e · un comando AUSENTE del mapa DENIEGA en modo externo (D-6, ADR-008)', async () => {
      // No es alcanzable por `dispatch()` —los 20 están todos declarados— así que se prueba
      // contra la función. Es la rama que protege al comando 21 el día que S-032 lo registre
      // sin pasar por acá.
      const reply = await authorizeEntityAccess('week-assigned-times.replace', MIX, {}, {});

      (reply === null).should.be.false();
      reply!.errorCode!.should.equal(ErrorCode.ACCESS_DENIED);
    });

    it('TS-51b · el exento sin sobre y sin fila en `users` NO se rechaza por falta de clase', async () => {
      // S-017 CA-1 otra vez, ahora contra la compuerta de CLASE: su clase se resuelve como
      // `connector` aunque `resolveCallerClass([])` devuelva `null`. Sin ese `??`, el caso pasa
      // de "escribe" a "no escribe nada".
      (await User.findByPk(getTrustedPublisherId()) === null).should.be.true();

      const reply = await dispatch('clients.new', { name: 'Exento sin fila' });

      reply.status.should.equal('success');
    });
  });
});
