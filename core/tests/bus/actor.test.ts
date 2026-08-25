import 'mocha';
import 'should';
import * as fs from 'fs';
import * as path from 'path';
import sinon from 'sinon';
import { Op } from 'sequelize';
import {
  Attachment,
  Client,
  File,
  Person,
  PersonRequirement,
  Project,
  Requirement,
  RequirementActivity,
  RequirementSubscriptor,
  User,
  WorkedTime,
} from '@jiku/models';
import { Actor, ErrorCode } from '@jiku/nats-protocol';
import logger from '../../src/logger';
import { sequelize } from '../../src/models';
import { dispatch } from '../helpers/dispatch';
import { installS3Double, uninstallS3Double } from '../helpers/s3-double';

/**
 * S-029 — el sobre de identidad y su espejo.
 *
 * POR QUÉ ESTE ARCHIVO VIVE EN `tests/bus/` Y NO EN `tests/commands/`. `.mocharc.json` levanta los
 * `*.test.ts` de `tests/` recursivamente y el orden efectivo por carpeta es
 * `auth → bus → commands → events → models → queries`. `tests/auth/authorize-caller.test.ts` corre
 * PRIMERO a propósito —su CA-1 exige la tabla `users` completamente vacía— y deja `users` vacía al
 * terminar; `tests/bus/host.test.ts` y `service.test.ts` usan dobles y no tocan la base. Este
 * archivo ordena entre los dos, así que puede afirmar `User.count() === 0` para CA-10 sin depender
 * de ninguna otra suite.
 *
 * EL PRIMER `describe` ES EL DE `users` VACÍA, y tiene que seguir siéndolo: si otro sembrara antes,
 * su `before` falla con un mensaje que dice exactamente qué pasó, en vez de fallar por una causa
 * confusa. Mismo criterio que el `before` de CA-1 en `authorize-caller.test.ts`.
 *
 * TODOS LOS TESTS ENTRAN POR `dispatch()`, nunca por el `execute()` de un comando: es lo único que
 * verifica el comportamiento transaccional, incluido el rollback (ADR-013, convención `testing`).
 */

/**
 * El `sub` del sobre. NO SE SIEMBRA NUNCA como fixture: la fila la crea el espejo, y que exista
 * después de un despacho es la mitad de lo que esta story prueba.
 */
const ANA = 'sub-persona-ana';

/**
 * Un caller AUTORIZADO PARA LOS 20 COMANDOS que NO es el publicador de confianza: tiene fila en
 * `users` con `roles: ['internal-app']`. Es lo que hace que un rechazo de estos tests solo pueda
 * venir de la guarda del sobre y nunca de la compuerta de autorización.
 */
const EXT = 'sub-conector-externo-sobre';

/** El dueño de los fixtures que tienen FK a `users` (proyectos, requisitos). No es ANA. */
const OWNER = 'sub-dueno-fixtures-sobre';

/** Otra identidad, para los choques de CA-6. Nunca tiene fila: el comando se rechaza antes. */
const BETO = 'sub-persona-beto';

const SOBRE: Actor = {
  id: ANA,
  roles: ['user'],
  name: 'Ana Pérez',
  username: 'ana@grava.digital',
  email: 'ana@grava.digital',
};

/** El payload mínimo válido de `files.request-upload`. */
const uploadPayload = {
  fileName: 'informe.pdf',
  mimeType: 'application/pdf',
  fileSize: 1024,
};

/** Los fixtures de un proyecto, que necesita un dueño con fila en `users`. */
function projectFixture(): Record<string, unknown> {
  return {
    name: 'Proyecto Sobre',
    code: 'SOBRE',
    status: 'activo',
    type: 'comercial',
    description: 'x',
    initDate: new Date(),
    createdBy: OWNER,
  };
}

/** Borra todo lo que este archivo puede haber escrito, RESPETANDO EL ORDEN DE LAS FK. */
async function cleanUp(): Promise<void> {
  await Attachment.destroy({ where: {} });
  await File.destroy({ where: {} });
  await WorkedTime.destroy({ where: {} });
  await RequirementActivity.destroy({ where: {} });
  await RequirementSubscriptor.destroy({ where: {} });
  await PersonRequirement.destroy({ where: {} });
  await Requirement.destroy({ where: {} });
  await Person.destroy({ where: {} });
  await Project.destroy({ where: {} });
  await Client.destroy({ where: {} });
  await User.destroy({ where: {} });
}

describe('el sobre de identidad · CA-10: con la tabla `users` vacía', () => {
  before(async () => {
    // SE VERIFICA EN VEZ DE SUPONERSE. Es el estado que deja `tests/auth/` y lo único que lo
    // produce es el `TRUNCATE ... RESTART IDENTITY CASCADE` de `tests/global-setup.ts`.
    (await User.count()).should.equal(0);
  });

  after(cleanUp);

  it('TS-28a · con `users` VACÍA, el comando con sobre CREA la fila y ejecuta', async () => {
    (await User.count()).should.equal(0);

    const reply = await dispatch<{ id: number }>('clients.new', {
      actor: SOBRE,
      name: 'Acme Vacía',
    });

    reply.status.should.equal('success');
    (typeof reply.data!.id).should.equal('number');

    // Los cinco campos, y `identityType` entre ellos.
    const user = (await User.findByPk(ANA))!;
    user.name.should.equal('Ana Pérez');
    user.username.should.equal('ana@grava.digital');
    user.email!.should.equal('ana@grava.digital');
    user.roles.should.deepEqual(['user']);
    user.identityType.should.equal('person');
  });

  it('TS-28 · la FK `requirements.created_by → users.id` se satisface porque el espejo commiteó', async () => {
    // El proyecto necesita un dueño CON fila —su `created_by` también apunta a `users`— y ese
    // dueño NO es ANA: es lo que deja a ANA ausente mientras el proyecto existe.
    await User.create({
      id: OWNER, name: 'Dueño', username: 'dueno-sobre', email: 'dueno-sobre@test.local',
    });
    const project = await Project.create(projectFixture());
    await User.destroy({ where: { id: ANA } });
    ((await User.findByPk(ANA)) === null).should.be.true();

    const reply = await dispatch<{ id: number }>('requirements.new', {
      actor: SOBRE,
      creator: ANA,
      title: 'T',
      description: 'D',
      projectId: project.id,
    });

    // SIN EL ESPEJO ESTO ES UNA VIOLACIÓN DE FK que el despachador traduce a un `internal_error`
    // opaco: la fila de ANA no existía cuando se armó el INSERT. Pasa solo porque el espejo corrió
    // Y COMMITEÓ en su propia transacción antes de que se abriera la del comando.
    reply.status.should.equal('success');
    ((await User.findByPk(ANA)) !== null).should.be.true();
    const requirement = (await Requirement.findByPk(reply.data!.id))!;
    requirement.createdBy.should.equal(ANA);
  });
});

describe('el sobre de identidad · extracción, guarda, forma y choque', () => {
  let projectId: number;
  let requirementId: number;

  before(async () => {
    await User.bulkCreate([
      {
        id: EXT,
        name: 'Conector',
        username: 'conector-sobre',
        email: 'conector-sobre@test.local',
        // AUTORIZADO PARA LOS 20 y NO es el publicador de confianza: sin esta fila, un rechazo
        // podría venir de la compuerta y el test no probaría la guarda del sobre.
        roles: ['internal-app'],
      },
      {
        id: OWNER,
        name: 'Dueño',
        username: 'dueno-sobre',
        email: 'dueno-sobre@test.local',
        roles: ['admin'],
      },
    ]);

    const project = await Project.create(projectFixture());
    projectId = project.id;

    // El requisito se crea POR EL DESPACHADOR y con el dueño de los fixtures, no con ANA: el
    // fixture no puede depender de lo que el test está probando.
    const created = await dispatch<{ id: number }>('requirements.new', {
      creator: OWNER, title: 'Requisito Sobre', description: 'D', projectId,
    });
    requirementId = created.data!.id;
  });

  after(cleanUp);

  afterEach(async () => {
    sinon.restore();
    uninstallS3Double();
    await Attachment.destroy({ where: {} });
    await File.destroy({ where: {} });
    await Client.destroy({ where: {} });
    // ANTES QUE `users`, Y SOLO LO QUE ESCRIBIÓ EL TEST: `requirements.created_by` apunta a
    // `users`, así que un requisito a nombre de ANA impide borrar su fila. El requisito FIXTURE
    // es de OWNER y sobrevive: TS-18 lo necesita.
    await RequirementActivity.destroy({ where: {} });
    await PersonRequirement.destroy({ where: {} });
    await Requirement.destroy({ where: { createdBy: { [Op.in]: [ANA, BETO] } } });
    // ANA no es fixture: la crea el espejo, y cada test parte de que no está.
    await User.destroy({ where: { id: { [Op.in]: [ANA, BETO] } } });
  });

  it('TS-1 · el sobre NO llega al esquema Joi: el comando se ejecuta normal', async () => {
    const reply = await dispatch<{ id: number }>('clients.new', { actor: SOBRE, name: 'Acme' });

    reply.status.should.equal('success');
    (typeof reply.data!.id).should.equal('number');
    (await Client.count({ where: { name: 'Acme' } })).should.equal(1);
  });

  it('TS-2 · la extracción es QUIRÚRGICA: una clave desconocida real sigue rechazándose', async () => {
    const before = await Client.count();

    const reply = await dispatch('clients.new', { actor: SOBRE, name: 'Acme', pepe: 1 });

    reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    // Lo rechaza Joi, no el bloque del sobre: quitar `actor` no es quitar todo lo que sobra.
    reply.errorMessage!.should.containEql('pepe');
    (await Client.count()).should.equal(before);
  });

  it('TS-3 · el sobre se evalúa ANTES de `registry.resolve()`', async () => {
    const reply = await dispatch('widgets.explode', { actor: SOBRE }, EXT);

    reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    reply.errorCode!.should.not.equal(ErrorCode.UNKNOWN_COMMAND);
    reply.errorCode!.should.not.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
  });

  it('TS-4 · el sobre se evalúa ANTES de `sequelize.transaction()`', async () => {
    const transaction = sinon.spy(sequelize, 'transaction');

    const reply = await dispatch('clients.new', { actor: { roles: ['user'] }, name: 'X' });

    reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    // Ni la del comando NI la del espejo: un sobre malformado no consume una conexión del pool.
    transaction.callCount.should.equal(0);
  });

  it('TS-5 · `actor` sin `id`', async () => {
    const reply = await dispatch('clients.new', { actor: { roles: ['user'] }, name: 'X' });

    reply.status.should.equal('failure');
    reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    // `value: null` y NO `undefined`: `JSON.stringify` borra las claves con `undefined` y el
    // consumidor recibiría un detalle incompleto.
    reply.errorDetails!.should.deepEqual({ field: 'actor.id', value: null, expected: 'string' });
  });

  it('TS-6 · `actor` sin `roles`', async () => {
    const reply = await dispatch('clients.new', { actor: { id: ANA }, name: 'X' });

    reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    reply.errorDetails!.should.deepEqual({
      field: 'actor.roles', value: null, expected: 'string[]',
    });
  });

  it('TS-7 · `actor.roles` que no es un array', async () => {
    const reply = await dispatch('clients.new', { actor: { id: ANA, roles: 'user' }, name: 'X' });

    reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    reply.errorDetails!.should.deepEqual({
      field: 'actor.roles', value: 'user', expected: 'string[]',
    });
  });

  it('TS-8 · `actor.id` en cadena vacía', async () => {
    const reply = await dispatch('clients.new', { actor: { id: '', roles: ['user'] }, name: 'X' });

    reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    (reply.errorDetails!.field as string).should.equal('actor.id');
    // La cadena vacía es tan inválida como la ausencia: no puede quedar una fila con `id = ''`.
    (await User.count({ where: { id: '' } })).should.equal(0);
  });

  it('TS-9 · `actor: null` es un sobre PRESENTE y malformado, no la ausencia de sobre', async () => {
    const before = await Client.count();

    const reply = await dispatch('clients.new', { actor: null, name: 'X' });

    // Un `if (raw.actor)` habría dejado pasar esto como "no hay sobre".
    reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    (reply.errorDetails!.field as string).should.equal('actor.id');
    (await Client.count()).should.equal(before);
  });

  it('TS-10 · un caller autorizado que NO es el publicador de confianza no transporta identidad', async () => {
    const before = await Client.count();

    const reply = await dispatch('clients.new', { actor: SOBRE, name: 'Fantasma' }, EXT);

    reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    // El detalle nombra el campo Y NADA MÁS: a quien no puede mandar un sobre no se le explica qué
    // tenía mal el sobre que no podía mandar.
    reply.errorDetails!.should.deepEqual({ field: 'actor' });
    (await Client.count()).should.equal(before);
  });

  it('TS-11 · un caller no confiable con sobre NO llega a escribir en `users`', async () => {
    await dispatch('clients.new', { actor: SOBRE, name: 'X' }, EXT);

    ((await User.findByPk(ANA)) === null).should.be.true();
  });

  it('TS-12 · un caller no confiable SIN sobre no espeja nada', async () => {
    const before = await User.count();

    const reply = await dispatch('clients.new', { name: 'Y' }, EXT);

    reply.status.should.equal('success');
    // Sin sobre no hay espejo: ni una fila, ni una consulta, ni una transacción de más.
    (await User.count()).should.equal(before);
  });

  it('TS-17 · choque en `creator`', async () => {
    const before = await Requirement.count();

    const reply = await dispatch('requirements.new', {
      actor: SOBRE, creator: BETO, title: 'T', description: 'D', projectId,
    });

    reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    reply.errorDetails!.should.deepEqual({ field: 'creator', value: BETO, expected: ANA });
    (await Requirement.count()).should.equal(before);
  });

  it('TS-18 · choque en `author`', async () => {
    const reply = await dispatch(`requirements.${requirementId}.comment`, {
      actor: SOBRE, author: BETO, comment: 'hola',
    });

    reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    reply.errorDetails!.should.deepEqual({ field: 'author', value: BETO, expected: ANA });
  });

  it('TS-19 · choque en `uploader`', async () => {
    installS3Double();
    const before = await File.count();

    const reply = await dispatch('files.request-upload', {
      actor: SOBRE, uploader: BETO, ...uploadPayload,
    });

    reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    reply.errorDetails!.should.deepEqual({ field: 'uploader', value: BETO, expected: ANA });
    (await File.count()).should.equal(before);
  });

  it('TS-20 · el mensaje del choque NO lleva el subject', async () => {
    const reply = await dispatch('requirements.new', {
      actor: SOBRE, creator: BETO, title: 'T', description: 'D', projectId,
    });

    // El subject transporta el user id: no puede viajar en un mensaje de error (CA-32 del REQ).
    reply.errorMessage!.should.not.containEql('jiku-commands');
    reply.errorMessage!.should.not.containEql('dev.');
  });

  it('TS-21 · el campo de dominio sigue yendo a su columna: el sobre no lo reemplaza', async () => {
    const reply = await dispatch<{ id: number }>('requirements.new', {
      actor: SOBRE, creator: ANA, title: 'T', description: 'D', projectId,
    });

    reply.status.should.equal('success');
    // CA-16 se cumple ACÁ y sin tocar un comando: `createdBy` sale de `payload.creator`, que CA-6
    // ya garantizó que ES la persona del sobre.
    const requirement = (await Requirement.findByPk(reply.data!.id))!;
    requirement.createdBy.should.equal(ANA);
  });

  it('TS-22 · el sobre NO vuelve opcional al campo de dominio obligatorio', async () => {
    const reply = await dispatch('requirements.new', {
      actor: SOBRE, title: 'T', description: 'D', projectId,
    });

    reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    // Lo rechaza Joi: `creator` sigue siendo `.required()` en el esquema del comando (CA-7).
    reply.errorMessage!.should.containEql('creator');
  });
});

describe('el sobre de identidad · el espejo sobre `users`', () => {
  let projectId: number;

  before(async () => {
    await User.create({
      id: OWNER, name: 'Dueño', username: 'dueno-sobre', email: 'dueno-sobre@test.local',
      roles: ['admin'],
    });
    const project = await Project.create(projectFixture());
    projectId = project.id;
  });

  after(cleanUp);

  afterEach(async () => {
    sinon.restore();
    uninstallS3Double();
    await Attachment.destroy({ where: {} });
    await File.destroy({ where: {} });
    await WorkedTime.destroy({ where: {} });
    await RequirementActivity.destroy({ where: {} });
    await PersonRequirement.destroy({ where: {} });
    await Requirement.destroy({ where: {} });
    await Client.destroy({ where: {} });
    await User.destroy({ where: { id: ANA } });
  });

  it('TS-23 · el espejo CREA la fila con los cinco campos', async () => {
    await dispatch('clients.new', { actor: SOBRE, name: 'Acme' });

    const user = (await User.findByPk(ANA))!;
    user.name.should.equal('Ana Pérez');
    user.username.should.equal('ana@grava.digital');
    user.email!.should.equal('ana@grava.digital');
    user.roles.should.deepEqual(['user']);
    user.identityType.should.equal('person');
  });

  it('TS-24 · el espejo corre en su PROPIA transacción, además de la del comando', async () => {
    const transaction = sinon.spy(sequelize, 'transaction');

    const reply = await dispatch('clients.new', { actor: SOBRE, name: 'Acme' });

    reply.status.should.equal('success');
    // DOS, y en serie: la del espejo commitea antes de que se abra la del comando.
    transaction.callCount.should.equal(2);
  });

  it('TS-25 · el espejo corre ANTES de `registry.resolve()` y de la compuerta', async () => {
    const reply = await dispatch('widgets.explode', { actor: SOBRE });

    reply.errorCode!.should.equal(ErrorCode.UNKNOWN_COMMAND);
    // Un comando que NI SIQUIERA EXISTE ya espejó: es la prueba del orden.
    ((await User.findByPk(ANA)) !== null).should.be.true();
  });

  it('TS-26 · una fila con `roles: []` queda corregida por un comando RECHAZADO', async () => {
    await User.create({
      id: ANA, name: 'Vieja', username: 'vieja', email: 'v@t.local', roles: [],
    });

    const reply = await dispatch('worked-times.new', {
      actor: SOBRE, date: '2026-08-25', minutes: 60, projectId, personId: 999999,
    });

    reply.errorCode!.should.equal(ErrorCode.PERSON_NOT_FOUND);
    // El espejo SOBREVIVE al rollback del comando: es un hecho sobre la identidad, no sobre la
    // operación. Y es exactamente lo que corrige una fila cargada a mano antes de REQ-005.
    (await User.findByPk(ANA))!.roles.should.deepEqual(['user']);
    (await WorkedTime.count()).should.equal(0);
  });

  it('TS-27 · el espejo sobrevive al rollback de un comando que ya escribió varias filas', async () => {
    await User.create({
      id: ANA, name: 'Vieja', username: 'vieja', email: 'v@t.local', roles: [],
    });

    const reply = await dispatch('requirements.new', {
      actor: SOBRE,
      creator: ANA,
      title: 'T',
      description: 'D',
      projectId,
      // Falla DESPUÉS de crear el requisito: es lo que hace que el rollback tenga algo que
      // deshacer y que este sea el test más importante de la story.
      fileIds: [999999],
    });

    reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    (await Requirement.count()).should.equal(0);
    (await PersonRequirement.count()).should.equal(0);
    (await Attachment.count()).should.equal(0);
    // La fila de la identidad QUEDA, y quedó actualizada.
    (await User.findByPk(ANA))!.roles.should.deepEqual(['user']);
  });

  it('TS-29 · best-effort al CREAR: sin `name`, `username` ni `email`, cae al `sub`', async () => {
    const warn = sinon.spy(logger, 'warn');

    const reply = await dispatch('clients.new', {
      actor: { id: ANA, roles: ['user'] }, name: 'Acme',
    });

    // NO RECHAZA: un campo de perfil no puede tirar abajo una escritura (D-7).
    reply.status.should.equal('success');
    const user = (await User.findByPk(ANA))!;
    // `name` y `username` son NOT NULL y no hay `email` al que caer: queda el `sub`.
    user.name.should.equal(ANA);
    user.username.should.equal(ANA);
    (user.email === null).should.be.true();
    user.roles.should.deepEqual(['user']);
    user.identityType.should.equal('person');
    warn.callCount.should.be.aboveOrEqual(1);
  });

  it('TS-30 · best-effort al CREAR: con `email` y sin `name`/`username`, cae al `email`', async () => {
    await dispatch('clients.new', {
      actor: { id: ANA, roles: ['user'], email: 'ana@grava.digital' }, name: 'Acme',
    });

    const user = (await User.findByPk(ANA))!;
    user.name.should.equal('ana@grava.digital');
    user.username.should.equal('ana@grava.digital');
    user.email!.should.equal('ana@grava.digital');
  });

  it('TS-31 · best-effort al ACTUALIZAR: un campo ausente NO pisa lo que ya había', async () => {
    await User.create({
      id: ANA,
      name: 'Ana Pérez',
      username: 'ana@grava.digital',
      email: 'ana@grava.digital',
      roles: [],
    });

    await dispatch('clients.new', {
      actor: { id: ANA, roles: ['user', 'admin'] }, name: 'Acme',
    });

    const user = (await User.findByPk(ANA))!;
    // Los tres de PERFIL, intactos: es la diferencia con el camino del evento, que reemplaza todo.
    user.name.should.equal('Ana Pérez');
    user.username.should.equal('ana@grava.digital');
    user.email!.should.equal('ana@grava.digital');
    // `roles` NO es de perfil: se reemplaza SIEMPRE, y el JSONB reemplaza el valor entero.
    user.roles.should.deepEqual(['user', 'admin']);
  });

  it('TS-32 · el espejo NUNCA escribe `identity_type: service`, aunque el sobre traiga la clave', async () => {
    await dispatch('clients.new', {
      actor: { ...SOBRE, identity_type: 'service' }, name: 'Acme',
    });

    // Darle a la api la capacidad de decir que una persona es un servicio es superficie de
    // seguridad regalada a cambio de nada: el literal gana siempre.
    (await User.findByPk(ANA))!.identityType.should.equal('person');
  });

  it('TS-33 · un fallo del espejo NO rechaza el comando (D-P1)', async () => {
    // El publicador de confianza está EXENTO de la compuerta, así que este `findByPk` solo lo
    // llama el espejo: el stub no puede romper otra cosa.
    sinon.stub(User, 'findByPk').rejects(new Error('boom'));
    const error = sinon.spy(logger, 'error');

    const reply = await dispatch<{ id: number }>('clients.new', { actor: SOBRE, name: 'Acme' });

    // RESUELVE, no rechaza: "el despachador nunca lanza" no admite un camino donde sí, y rechazar
    // convertiría un hipo de `users` en una caída total de escritura.
    reply.status.should.equal('success');
    (await Client.count({ where: { name: 'Acme' } })).should.equal(1);
    error.callCount.should.be.aboveOrEqual(1);
    String(error.firstCall.args[0]).should.startWith('[dispatch]');
  });
});

describe('el sobre de identidad · `resolveActor` y sus tres ramas', () => {
  before(async () => {
    await User.bulkCreate([
      {
        id: EXT, name: 'Conector', username: 'conector-sobre',
        email: 'conector-sobre@test.local', roles: ['internal-app'],
      },
      {
        id: ANA, name: 'Ana Pérez', username: 'ana@grava.digital',
        email: 'ana@grava.digital', roles: ['user'],
      },
    ]);
  });

  after(cleanUp);

  beforeEach(() => {
    installS3Double();
  });

  afterEach(async () => {
    sinon.restore();
    uninstallS3Double();
    await File.destroy({ where: {} });
  });

  it('TS-13 · SIN sobre, la identidad de un caller directo sale del subject (rama 3)', async () => {
    const reply = await dispatch<{ id: number }>(
      'files.request-upload',
      { uploader: 'otro-sub', ...uploadPayload },
      EXT
    );

    reply.status.should.equal('success');
    // Lo declarado en el cuerpo SE IGNORA: el subject es infalsificable y el cuerpo no.
    (await File.findByPk(reply.data!.id))!.uploadedBy.should.equal(EXT);
  });

  it('TS-14 · CON sobre, el actor es `actor.id` aunque el campo de dominio no venga (rama 1)', async () => {
    const reply = await dispatch<{ id: number }>('files.request-upload', {
      actor: SOBRE, ...uploadPayload,
    });

    reply.status.should.equal('success');
    (await File.findByPk(reply.data!.id))!.uploadedBy.should.equal(ANA);
  });

  it('TS-15 · con sobre y campo de dominio IGUALES no hay choque', async () => {
    const reply = await dispatch<{ id: number }>('files.request-upload', {
      actor: SOBRE, uploader: ANA, ...uploadPayload,
    });

    reply.status.should.equal('success');
    (await File.findByPk(reply.data!.id))!.uploadedBy.should.equal(ANA);
  });

  it('TS-16 · SIN sobre y con el publicador de confianza, gana el campo de dominio (rama 2)', async () => {
    const reply = await dispatch<{ id: number }>('files.request-upload', {
      uploader: ANA, ...uploadPayload,
    });

    reply.status.should.equal('success');
    (await File.findByPk(reply.data!.id))!.uploadedBy.should.equal(ANA);
  });
});

describe('el sobre de identidad · gates estructurales', () => {
  /** El fuente sin comentarios: la prosa que explica el porqué no cuenta como código. */
  function codeOf(relative: string): string {
    const source = fs.readFileSync(path.join(__dirname, '../../', relative), 'utf8');
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  }

  it('TS-34 · `user-sync.ts` NO tiene escritura propia: delega en el módulo compartido', () => {
    const code = codeOf('src/events/auth/user-sync.ts');

    // CA-12: dos implementaciones del mismo espejo divergen, y el síntoma aparece meses después
    // como "a esta persona el nombre se le borró sola".
    code.should.not.containEql('User.create');
    code.should.not.containEql('User.findByPk');
    code.should.not.containEql('.update(');
  });

  it('TS-35 · el sobre NO entró a ningún esquema Joi de comando', () => {
    const commandsDir = path.join(__dirname, '../../src/commands');
    const entities = fs
      .readdirSync(commandsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    // Los 7 directorios de entidad tienen que estar: si alguien los moviera, este gate dejaría de
    // mirar nada y pasaría por vacío.
    entities.length.should.be.aboveOrEqual(7);

    for (const entity of entities) {
      const dir = path.join(commandsDir, entity);
      for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.ts'))) {
        const code = codeOf(path.join('src/commands', entity, file));
        // Una clave de esquema Joi se declara `actor:`. Si apareciera, los 20 esquemas habrían
        // tenido que tocarse y se habría perdido la propiedad entera de S-017 CA-15 (D-1).
        /\bactor\s*:/.test(code).should.be.false();
      }
    }
  });
});
