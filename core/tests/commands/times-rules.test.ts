import 'mocha';
import 'should';
import sinon from 'sinon';
import {
  Objective, Person, Project, Requirement, UnworkedTime, User, WorkedTime,
} from '@jiku/models';
import { ErrorCode, Reply, commandSubject, success } from '@jiku/nats-protocol';
import { Dispatcher } from '../../src/bus/dispatcher';
import { CommandRegistry } from '../../src/commands/registry';
import { Command } from '../../src/commands/types';
import { getTrustedPublisherId } from '../../src/config';
import {
  SUBMISSION_WINDOW_DAYS, isWithinSubmissionWindow, toDayUTC,
} from '../../src/commands/times/window';
import { dispatch } from '../helpers/dispatch';
import { HOY, HOY_M10, HOY_M11, MANANA, dayOffset } from '../helpers/dates';

/**
 * S-031 — LAS REGLAS DE HORAS Y AUSENCIAS, EN CORE.
 *
 * La ventana de carga (C-40), quién imputa a otra persona (C-41), la titularidad del registro al
 * borrar y la resolución del default de `personId` desde el actor. Todas vivían en la api, que es
 * quien conocía al usuario final; desde el sobre de S-029 core también lo conoce, y una regla que
 * vive en el único servicio que escribe vale por los DOS caminos (RF-6).
 *
 * ARCHIVO PROPIO Y NO DENTRO DE `times.test.ts` porque el juego de fixtures es OTRO: acá hacen
 * falta usuarios con roles, Personas vinculadas a ellos, una Persona SIN usuario y un usuario SIN
 * Persona. `times.test.ts` prueba el comando sin identidad y sigue haciéndolo.
 *
 * LOS TRES CANALES, con los nombres que usa el plan:
 *
 *   E (sobre)   -> `actor` DENTRO del payload, caller por defecto (el publicador de confianza)
 *   D (directo) -> `dispatch(cmd, payload, SUB)`, la identidad sale del subject
 *   X (exento)  -> caller por defecto y SIN `actor`: el publicador de confianza sin sobre
 */

/** Una persona con rol `user` y Persona vinculada. */
const ANA = 'sub-s031-ana';
/** Una persona con rol `admin` y Persona vinculada. */
const BETO = 'sub-s031-beto';
/** Un usuario con rol `user` y SIN fila en `people`: es el `person_not_found` de CA-5. */
const SIN_PERSONA = 'sub-s031-sin-persona';
/** El dueño de los fixtures con FK a `users`. No participa de ninguna regla. */
const OWNER = 'sub-s031-owner';
/** El `sub` del doble de comando de TS-39. Su fila en `users` la crea el espejo, no el fixture. */
const PROBE = 'sub-s031-probe';

describe('S-031 · reglas de horas y ausencias en core', () => {
  let projectId: number;
  let otherProjectId: number;
  let taskId: number;
  let requirementId: number;
  let otherRequirementId: number;
  /** La Persona de ANA. */
  let P_ANA: number;
  /** La Persona de BETO. */
  let P_BETO: number;
  /** Una Persona SIN usuario vinculado (`user_id IS NULL`): no es de nadie (D-3). */
  let P_SUELTA: number;

  before(async () => {
    await User.bulkCreate([
      { id: OWNER, name: 'Owner', username: 's031-owner', email: 's031-owner@t.local' },
      { id: ANA, name: 'Ana', username: 's031-ana', email: 's031-ana@t.local', roles: ['user'] },
      { id: BETO, name: 'Beto', username: 's031-beto', email: 's031-beto@t.local', roles: ['admin'] },
      {
        id: SIN_PERSONA, name: 'Sin Persona', username: 's031-sinp',
        email: 's031-sinp@t.local', roles: ['user'],
      },
    ]);

    const project = await Project.create({
      name: 'Proyecto S031', code: 'S031A', status: 'activo', type: 'comercial',
      description: 'x', initDate: new Date(), createdBy: OWNER,
    });
    projectId = project.id;

    const other = await Project.create({
      name: 'Otro S031', code: 'S031B', status: 'activo', type: 'comercial',
      description: 'x', initDate: new Date(), createdBy: OWNER,
    });
    otherProjectId = other.id;

    const task = await Objective.create({
      title: 'Task S031', state: 'backlog', area: 'desarrollo', priority: 0,
      projectId, createdBy: OWNER,
    });
    taskId = task.id;

    const requirement = await Requirement.create({
      title: 'Req S031', description: 'x', projectId, createdBy: OWNER,
    });
    requirementId = requirement.id;

    const otherRequirement = await Requirement.create({
      title: 'Req ajeno S031', description: 'x', projectId: otherProjectId, createdBy: OWNER,
    });
    otherRequirementId = otherRequirement.id;

    const pAna = await Person.create({
      firstName: 'Ana', lastName: 'S031', enabled: true,
      initDate: new Date('2026-01-01'), userId: ANA,
    });
    P_ANA = pAna.id;

    const pBeto = await Person.create({
      firstName: 'Beto', lastName: 'S031', enabled: true,
      initDate: new Date('2026-01-01'), userId: BETO,
    });
    P_BETO = pBeto.id;

    const pSuelta = await Person.create({
      firstName: 'Suelta', lastName: 'S031', enabled: true,
      initDate: new Date('2026-01-01'),
    });
    P_SUELTA = pSuelta.id;
  });

  after(async () => {
    await WorkedTime.destroy({ where: {} });
    await UnworkedTime.destroy({ where: {} });
    await Objective.destroy({ where: {} });
    await Requirement.destroy({ where: {} });
    await Person.destroy({ where: {} });
    await Project.destroy({ where: {} });
    // SOLO LOS DE ESTE ARCHIVO —incluida la fila que el ESPEJO crea para el doble de TS-39—: un
    // `where: {}` sobre `users` borraría fixtures de otros archivos si mañana alguien reordena.
    await User.destroy({ where: { id: [OWNER, ANA, BETO, SIN_PERSONA, PROBE] } });
  });

  afterEach(async () => {
    await WorkedTime.destroy({ where: {} });
    await UnworkedTime.destroy({ where: {} });
  });

  // ==========================================================================================
  // C-40 · LA VENTANA DE CARGA (Tarea 3)
  // ==========================================================================================

  describe('la ventana de carga (C-40)', () => {
    it('TS-1 · acepta el día actual y resuelve la Persona del actor', async () => {
      const reply = await dispatch<{ id: number }>('worked-times.new', {
        actor: { id: ANA, roles: ['user'] }, date: HOY, minutes: 120, projectId,
      });

      reply.status.should.equal('success');
      const worked = await WorkedTime.findByPk(reply.data!.id);
      worked!.personId.should.equal(P_ANA);
      worked!.minutes.should.equal(120);
    });

    it('TS-2 · acepta el borde inferior exacto (hoy − 10)', async () => {
      const reply = await dispatch('worked-times.new', {
        actor: { id: ANA, roles: ['user'] }, date: HOY_M10, minutes: 60, projectId,
      });

      reply.status.should.equal('success');
    });

    it('TS-3 · rechaza hoy − 11', async () => {
      const reply = await dispatch('worked-times.new', {
        actor: { id: ANA, roles: ['user'] }, date: HOY_M11, minutes: 60, projectId,
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_DATE_RANGE);
      (await WorkedTime.count()).should.equal(0);
    });

    it('TS-4 · rechaza el borde superior: mañana', async () => {
      const reply = await dispatch('worked-times.new', {
        actor: { id: ANA, roles: ['user'] }, date: MANANA, minutes: 60, projectId,
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_DATE_RANGE);
    });

    it('TS-5 · corta también a un `admin` (D-5: se migra la regla, no se amplía)', async () => {
      const reply = await dispatch('worked-times.new', {
        actor: { id: BETO, roles: ['admin'] },
        date: HOY_M11, minutes: 60, projectId, personId: P_BETO,
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_DATE_RANGE);
    });

    it('TS-6 · corta igual por el canal DIRECTO, con el mismo código', async () => {
      const reply = await dispatch(
        'worked-times.new', { date: HOY_M11, minutes: 60, projectId }, ANA
      );

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_DATE_RANGE);
    });
  });

  /**
   * EL HELPER, DIRECTO — la única excepción a "todo entra por `dispatch()`", y está justificada:
   * el bug de zona horaria del borde aparece SOLO ALGUNAS HORAS DEL DÍA, así que un test que use
   * el reloj del proceso no puede provocarlo. Acá se fija el "hoy" explícitamente.
   */
  describe('el helper de la ventana, en el borde de la zona horaria', () => {
    it('un `Date` de las 23:59:59Z del día − 10 está DENTRO', () => {
      const hoy = new Date('2026-08-25T12:00:00Z');
      isWithinSubmissionWindow(new Date('2026-08-15T23:59:59Z'), hoy).should.be.true();
    });

    it('un `Date` de las 00:00:00Z del día − 11 está FUERA', () => {
      const hoy = new Date('2026-08-25T12:00:00Z');
      isWithinSubmissionWindow(new Date('2026-08-14T00:00:00Z'), hoy).should.be.false();
    });

    it('el borde superior es el día de hoy: mañana a las 00:00:00Z está FUERA', () => {
      const hoy = new Date('2026-08-25T23:59:59Z');
      isWithinSubmissionWindow(new Date('2026-08-26T00:00:00Z'), hoy).should.be.false();
      isWithinSubmissionWindow(new Date('2026-08-25T00:00:00Z'), hoy).should.be.true();
    });

    it('normaliza string y `Date` al mismo día UTC', () => {
      toDayUTC('2026-08-25').should.equal('2026-08-25');
      toDayUTC(new Date('2026-08-25T23:59:59Z')).should.equal('2026-08-25');
    });

    it('la ventana son 10 días previos más el día actual', () => {
      SUBMISSION_WINDOW_DAYS.should.equal(10);
    });
  });

  // ==========================================================================================
  // CA-5 · `personId` OPCIONAL Y RESUELTO DESDE EL ACTOR + C-41 (Tarea 4)
  // ==========================================================================================

  describe('`personId` opcional y C-41 en `worked-times.new`', () => {
    it('TS-7 · sin `personId`, se resuelve desde el actor del sobre', async () => {
      const reply = await dispatch<{ id: number }>('worked-times.new', {
        actor: { id: ANA, roles: ['user'] }, date: HOY, minutes: 90, projectId,
      });

      reply.status.should.equal('success');
      (await WorkedTime.findByPk(reply.data!.id))!.personId.should.equal(P_ANA);
    });

    it('TS-8 · sin `personId`, se resuelve desde el caller del subject', async () => {
      const reply = await dispatch<{ id: number }>(
        'worked-times.new', { date: HOY, minutes: 90, projectId }, ANA
      );

      reply.status.should.equal('success');
      (await WorkedTime.findByPk(reply.data!.id))!.personId.should.equal(P_ANA);
    });

    it('TS-9 · sin `personId` y el actor no tiene Persona vinculada', async () => {
      const reply = await dispatch('worked-times.new', {
        actor: { id: SIN_PERSONA, roles: ['user'] }, date: HOY, minutes: 60, projectId,
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.PERSON_NOT_FOUND);
    });

    it('TS-10 · sin `personId` y sin actor (canal exento): `person_not_found`', async () => {
      const reply = await dispatch('worked-times.new', {
        date: HOY, minutes: 60, projectId,
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.PERSON_NOT_FOUND);
    });

    it('TS-11 · el `personId` explícito gana sobre el default', async () => {
      const reply = await dispatch<{ id: number }>('worked-times.new', {
        actor: { id: BETO, roles: ['admin'] },
        date: HOY, minutes: 60, projectId, personId: P_ANA,
      });

      reply.status.should.equal('success');
      (await WorkedTime.findByPk(reply.data!.id))!.personId.should.equal(P_ANA);
    });

    it('TS-12 · un `user` no imputa horas a otra Persona', async () => {
      const reply = await dispatch('worked-times.new', {
        actor: { id: ANA, roles: ['user'] },
        date: HOY, minutes: 60, projectId, personId: P_BETO,
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.ACCESS_DENIED);
      (await WorkedTime.count()).should.equal(0);
    });

    it('TS-13 · un `admin` sí imputa a otra Persona', async () => {
      const reply = await dispatch<{ id: number }>('worked-times.new', {
        actor: { id: BETO, roles: ['admin'] },
        date: HOY, minutes: 60, projectId, personId: P_ANA,
      });

      reply.status.should.equal('success');
      (await WorkedTime.findByPk(reply.data!.id))!.personId.should.equal(P_ANA);
    });

    it('TS-14 · un `user` imputa a su propia Persona explícitamente', async () => {
      const reply = await dispatch('worked-times.new', {
        actor: { id: ANA, roles: ['user'] },
        date: HOY, minutes: 60, projectId, personId: P_ANA,
      });

      reply.status.should.equal('success');
    });

    it('TS-15 · C-41 corta igual por el canal DIRECTO', async () => {
      const reply = await dispatch(
        'worked-times.new', { date: HOY, minutes: 60, projectId, personId: P_BETO }, ANA
      );

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.ACCESS_DENIED);
    });

    it('TS-16 · una Persona sin usuario vinculado no es de nadie (D-3)', async () => {
      const reply = await dispatch('worked-times.new', {
        actor: { id: ANA, roles: ['user'] },
        date: HOY, minutes: 60, projectId, personId: P_SUELTA,
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.ACCESS_DENIED);
    });

    it('TS-17 · el canal EXENTO no aplica C-41 (D-1)', async () => {
      const reply = await dispatch<{ id: number }>('worked-times.new', {
        date: HOY, minutes: 60, projectId, personId: P_BETO,
      });

      reply.status.should.equal('success');
      (await WorkedTime.findByPk(reply.data!.id))!.personId.should.equal(P_BETO);
    });

    it('TS-18 · `access_denied` no filtra información', async () => {
      const reply = await dispatch('worked-times.new', {
        actor: { id: ANA, roles: ['user'] },
        date: HOY, minutes: 60, projectId, personId: P_BETO,
      });

      reply.errorMessage!.should.not.containEql(String(P_BETO));
      reply.errorMessage!.should.not.containEql(ANA);
      reply.errorMessage!.should.not.containEql('jiku-commands');
    });

    it('TS-19 · la exclusión mutua sigue viviendo en core', async () => {
      const reply = await dispatch('worked-times.new', {
        actor: { id: ANA, roles: ['user'] },
        date: HOY, minutes: 60, projectId, taskId, requirementId,
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    });

    it('TS-43 · el orden de validación de las referencias no cambió', async () => {
      const reply = await dispatch('worked-times.new', {
        actor: { id: ANA, roles: ['user'] },
        date: HOY, minutes: 60, projectId, requirementId: otherRequirementId,
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.REQUIREMENT_PROJECT_MISMATCH);
    });
  });

  // ==========================================================================================
  // CA-7 · EL TOPE DIARIO Y SU `errorDetails` (Tarea 7)
  // ==========================================================================================

  describe('el tope diario y `errorDetails`', () => {
    it('TS-20 · `worked-times.new` rechaza y trae `remainingMinutes`', async () => {
      await WorkedTime.create({ date: HOY, minutes: 1400, projectId, personId: P_ANA });

      const reply = await dispatch('worked-times.new', {
        actor: { id: ANA, roles: ['user'] }, date: HOY, minutes: 60, projectId,
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.DAILY_LIMIT_EXCEEDED);
      reply.errorDetails!.should.deepEqual({ remainingMinutes: 40 });
    });

    it('TS-21 · la redacción del mensaje NO cambia: es lo que la api parsea', async () => {
      await WorkedTime.create({ date: HOY, minutes: 1400, projectId, personId: P_ANA });

      const reply = await dispatch('worked-times.new', {
        actor: { id: ANA, roles: ['user'] }, date: HOY, minutes: 60, projectId,
      });

      reply.errorMessage!.should.equal(
        'Se superaría el máximo de 24 horas (1440 minutos). Minutos disponibles: 40'
      );
      // EL REGEX DE LA API, LITERAL (`api/lib/utils/bus/protocol.ts:155-160`). Es el test que
      // impide romper la api desde core.
      const match = /Minutos disponibles: (-?\d+)/.exec(reply.errorMessage!);
      Number(match![1]).should.equal(40);
    });

    it('TS-22 · el tope de ausencias suma trabajadas y ausencias', async () => {
      await WorkedTime.create({ date: HOY, minutes: 1000, projectId, personId: P_ANA });
      await UnworkedTime.create({ date: HOY, minutes: 400, reason: 'medico', personId: P_ANA });

      const reply = await dispatch('unworked-times.new', {
        actor: { id: ANA, roles: ['user'] },
        date: HOY, minutes: 60, reason: 'tramite', personId: P_ANA,
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.DAILY_LIMIT_EXCEEDED);
      reply.errorDetails!.should.deepEqual({ remainingMinutes: 40 });
      reply.errorMessage!.should.equal(
        'Se superaría el máximo de 24 horas (1440 minutos). Minutos disponibles: 40'
      );
    });
  });

  // ==========================================================================================
  // CA-8 / CA-9 · TITULARIDAD Y VENTANA AL BORRAR UNA HORA (Tarea 5)
  // ==========================================================================================

  describe('`worked-times.{id}.delete`', () => {
    /** Crea una hora de la Persona indicada, en la fecha indicada. */
    async function hora(personId: number, date: string = HOY): Promise<number> {
      const worked = await WorkedTime.create({ date, minutes: 60, projectId, personId });
      return worked.id;
    }

    it('TS-23 · un `user` borra una hora de su propia Persona', async () => {
      const id = await hora(P_ANA);

      const reply = await dispatch(`worked-times.${id}.delete`, {
        actor: { id: ANA, roles: ['user'] },
      });

      reply.status.should.equal('success');
      ((await WorkedTime.findByPk(id)) === null).should.be.true();
    });

    it('TS-24 · un `user` no borra una hora ajena', async () => {
      const id = await hora(P_BETO);

      const reply = await dispatch(`worked-times.${id}.delete`, {
        actor: { id: ANA, roles: ['user'] },
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.ACCESS_DENIED);
      ((await WorkedTime.findByPk(id)) !== null).should.be.true();
    });

    it('TS-25 · un `admin` sí borra una hora ajena', async () => {
      const id = await hora(P_ANA);

      const reply = await dispatch(`worked-times.${id}.delete`, {
        actor: { id: BETO, roles: ['admin'] },
      });

      reply.status.should.equal('success');
    });

    it('TS-26 · la ventana corta el borrado', async () => {
      const id = await hora(P_ANA, HOY_M11);

      const reply = await dispatch(`worked-times.${id}.delete`, {
        actor: { id: ANA, roles: ['user'] },
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_DATE_RANGE);
      ((await WorkedTime.findByPk(id)) !== null).should.be.true();
    });

    it('TS-27 · el borde inferior del borrado también es inclusivo', async () => {
      const id = await hora(P_ANA, HOY_M10);

      const reply = await dispatch(`worked-times.${id}.delete`, {
        actor: { id: ANA, roles: ['user'] },
      });

      reply.status.should.equal('success');
    });

    it('TS-28 · el registro inexistente sigue respondiendo su código', async () => {
      const reply = await dispatch('worked-times.999999.delete', {
        actor: { id: ANA, roles: ['user'] },
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.WORKED_TIME_NOT_FOUND);
    });

    it('TS-29 · titularidad y ventana no adelantan al "no existe"', async () => {
      const reply = await dispatch('worked-times.999999.delete', {
        actor: { id: ANA, roles: ['user'] },
      });

      reply.errorCode!.should.not.equal(ErrorCode.ACCESS_DENIED);
      reply.errorCode!.should.not.equal(ErrorCode.INVALID_DATE_RANGE);
      reply.errorCode!.should.equal(ErrorCode.WORKED_TIME_NOT_FOUND);
    });

    it('TS-30 · la titularidad corta igual por el canal DIRECTO', async () => {
      const id = await hora(P_BETO);

      const reply = await dispatch(`worked-times.${id}.delete`, {}, ANA);

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.ACCESS_DENIED);
    });

    it('TS-31 · el canal EXENTO borra sin titularidad (D-1)', async () => {
      const id = await hora(P_BETO);

      const reply = await dispatch(`worked-times.${id}.delete`, {});

      reply.status.should.equal('success');
      ((await WorkedTime.findByPk(id)) === null).should.be.true();
    });
  });

  // ==========================================================================================
  // CA-10 · LA TITULARIDAD EN AUSENCIAS (Tarea 6)
  // ==========================================================================================

  describe('las ausencias', () => {
    /** Crea una ausencia de la Persona indicada. */
    async function ausencia(personId: number, date: string = HOY): Promise<number> {
      const unworked = await UnworkedTime.create({
        date, minutes: 60, reason: 'otro', personId,
      });
      return unworked.id;
    }

    it('TS-32 · un `user` no registra una ausencia a otra Persona', async () => {
      const reply = await dispatch('unworked-times.new', {
        actor: { id: ANA, roles: ['user'] },
        date: HOY, minutes: 60, reason: 'otro', personId: P_BETO,
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.ACCESS_DENIED);
      (await UnworkedTime.count()).should.equal(0);
    });

    it('TS-33 · un `admin` sí registra una ausencia a otra Persona', async () => {
      const reply = await dispatch('unworked-times.new', {
        actor: { id: BETO, roles: ['admin'] },
        date: HOY, minutes: 60, reason: 'otro', personId: P_ANA,
      });

      reply.status.should.equal('success');
    });

    it('TS-34 · un `user` no borra una ausencia ajena', async () => {
      const id = await ausencia(P_BETO);

      const reply = await dispatch(`unworked-times.${id}.delete`, {
        actor: { id: ANA, roles: ['user'] },
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.ACCESS_DENIED);
      ((await UnworkedTime.findByPk(id)) !== null).should.be.true();
    });

    it('TS-35 · un `user` sí borra su propia ausencia', async () => {
      const id = await ausencia(P_ANA);

      const reply = await dispatch(`unworked-times.${id}.delete`, {
        actor: { id: ANA, roles: ['user'] },
      });

      reply.status.should.equal('success');
      ((await UnworkedTime.findByPk(id)) === null).should.be.true();
    });

    it('TS-36 · un `admin` borra una ausencia ajena', async () => {
      const id = await ausencia(P_ANA);

      const reply = await dispatch(`unworked-times.${id}.delete`, {
        actor: { id: BETO, roles: ['admin'] },
      });

      reply.status.should.equal('success');
    });

    it('TS-37 · la ausencia inexistente sigue respondiendo su código', async () => {
      const reply = await dispatch('unworked-times.999999.delete', {
        actor: { id: ANA, roles: ['user'] },
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.UNWORKED_TIME_NOT_FOUND);
    });

    it('TS-38 · LA VENTANA NO SE APLICA A LAS AUSENCIAS, y no es un olvido', async () => {
      const reply = await dispatch('unworked-times.new', {
        actor: { id: ANA, roles: ['user'] },
        date: dayOffset(-30), minutes: 60, reason: 'otro', personId: P_ANA,
      });

      reply.status.should.equal('success');
    });
  });

  // ==========================================================================================
  // H-1 · `ctx.roles` LLEGA AL COMANDO POR LOS TRES CANALES (Tarea 1)
  // ==========================================================================================

  /**
   * EL ÚNICO LUGAR DONDE HACE FALTA UN DOBLE DE COMANDO, y la razón es que lo que se afirma es un
   * VALOR DEL CONTEXTO, no un efecto: los tests de C-41 lo verifican indirectamente —si el comando
   * no viera `['admin']`, TS-13 fallaría— pero indirectamente no se puede distinguir `[]` de
   * "no llegó". Acá se registra un comando falso con el patrón de uno real, para que la compuerta
   * lo autorice igual, y se lee `ctx.roles` a la salida.
   */
  describe('`ctx.roles`, el valor que el despachador ya tenía (H-1)', () => {
    let vistos: (readonly string[])[];
    let probeDispatcher: Dispatcher;

    beforeEach(() => {
      vistos = [];
      const doble: Command<Record<string, never>, void> = {
        pattern: 'worked-times.new',
        validate: (payload: unknown) => ({ value: (payload ?? {}) as Record<string, never> }),
        execute: async (_payload, ctx) => {
          vistos.push(ctx.roles);
          return success();
        },
      };
      probeDispatcher = new Dispatcher(new CommandRegistry().register(doble));
    });

    function probe(payload: unknown, caller = getTrustedPublisherId()): Promise<Reply<unknown>> {
      return probeDispatcher.dispatch(commandSubject('worked-times.new', caller), payload);
    }

    it('TS-39 · con sobre, los roles son los del SOBRE', async () => {
      const reply = await probe({ actor: { id: PROBE, roles: ['admin'] } });

      reply.status.should.equal('success');
      vistos[0].should.deepEqual(['admin']);
    });

    it('TS-40 · sin sobre, los roles salen de `users`', async () => {
      const reply = await probe({}, BETO);

      reply.status.should.equal('success');
      vistos[0].should.deepEqual(['admin']);
    });

    it('TS-41 · en el canal exento los roles son `[]` y NO se lee la base', async () => {
      const spy = sinon.spy(User, 'findByPk');
      try {
        const reply = await probe({});

        reply.status.should.equal('success');
        vistos[0].should.deepEqual([]);
        spy.called.should.be.false();
      } finally {
        spy.restore();
      }
    });

    it('TS-40 bis · un `admin` por el canal directo sí imputa a un tercero', async () => {
      const reply = await dispatch(
        'worked-times.new', { date: HOY, minutes: 60, projectId, personId: P_ANA }, BETO
      );

      reply.status.should.equal('success');
    });
  });
});
