import 'mocha';
import 'should';
import { Person, Project, User, WeekAssignedTime } from '@jiku/models';
import { ErrorCode } from '@jiku/nats-protocol';
import { registry } from '../../src/commands';
import { toDayUTC } from '../../src/commands/times/window';
import { dispatch } from '../helpers/dispatch';
import { LUNES, LUNES_ANTERIOR, LUNES_SIGUIENTE, desdeLunes } from '../helpers/dates';

/**
 * EL COMANDO 21 (S-032): comportamiento, esquema y las reglas que NO dependen de la identidad.
 *
 * C-38 —*solo `admin` edita la grilla*— NO SE PRUEBA ACÁ: la resuelve el mapa rol → método, antes
 * de que el comando exista para el caller, y su juego de fixtures es otro (usuarios con roles,
 * filas reales en `users`). Vive en `week-assigned-times-auth.test.ts`, siguiendo el precedente
 * que S-031 dejó con `times.test.ts` / `times-rules.test.ts`.
 *
 * TODOS ENTRAN POR `dispatch()`, nunca por `execute()`: es lo que exige ADR-003 y lo único que
 * verifica el comportamiento transaccional — TS-14, el test más importante de la story, no
 * significaría nada llamando al `execute` aislado.
 *
 * LAS FECHAS SON RELATIVAS A HOY. C-36 compara contra el lunes de la semana actual, así que un
 * literal pasa hoy y falla la semana que viene.
 */

const OWNER = 'sub-s032-owner';

describe('week-assigned-times.replace — el comando 21 (S-032)', () => {
  let PROJ_COM: number;
  let PROJ_INT: number;
  let P_ANA: number;
  let P_BETO: number;

  before(async () => {
    await User.create({
      id: OWNER, name: 'Owner', username: 's032-owner', email: 's032-owner@t.local',
    });

    const comercial = await Project.create({
      name: 'Proyecto S032 comercial', code: 'S032C', status: 'activo', type: 'comercial',
      description: 'x', initDate: new Date(), createdBy: OWNER,
    });
    PROJ_COM = comercial.id;

    const interno = await Project.create({
      name: 'Proyecto S032 interno', code: 'S032I', status: 'activo', type: 'interno',
      description: 'x', initDate: new Date(), createdBy: OWNER,
    });
    PROJ_INT = interno.id;

    const ana = await Person.create({
      firstName: 'Ana', lastName: 'Grilla', enabled: true, initDate: new Date('2026-01-01'),
    });
    P_ANA = ana.id;

    const beto = await Person.create({
      firstName: 'Beto', lastName: 'Grilla', enabled: true, initDate: new Date('2026-01-01'),
    });
    P_BETO = beto.id;
  });

  after(async () => {
    await WeekAssignedTime.destroy({ where: {} });
    await Person.destroy({ where: {} });
    await Project.destroy({ where: {} });
    await User.destroy({ where: { id: OWNER } });
  });

  // EL REEMPLAZO TOTAL HACE QUE LOS TESTS SE PISEN ENTRE SÍ si no se limpia: casi todos escriben
  // sobre `LUNES`, y el que quedó de un test anterior aparecería en el `count` del siguiente.
  afterEach(async () => {
    await WeekAssignedTime.destroy({ where: {} });
  });

  describe('el camino feliz y el reemplazo total', () => {
    it('TS-1 · reemplaza la semana con dos asignaciones', async () => {
      const reply = await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES,
        assignments: [
          { projectId: PROJ_COM, personId: P_ANA, minutes: 480 },
          { projectId: PROJ_COM, personId: P_BETO, minutes: 240 },
        ],
      });

      reply.status.should.equal('success');

      const filas = await WeekAssignedTime.findAll({ order: [['minutes', 'DESC']] });
      filas.length.should.equal(2);
      filas.map((f) => f.minutes).should.deepEqual([480, 240]);
      filas.forEach((f) => toDayUTC(f.dateFrom).should.equal(LUNES));
    });

    it('TS-2 · el reply es `ReplyEmpty`: no hay `id` que devolver (CA-8)', async () => {
      const reply = await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES,
        assignments: [{ projectId: PROJ_COM, personId: P_ANA, minutes: 480 }],
      });

      reply.status.should.equal('success');
      (reply.data === undefined).should.be.true();
    });

    it('TS-3 · `dateTo` se deriva como `dateFrom` + 4 días (viernes)', async () => {
      await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES,
        assignments: [{ projectId: PROJ_COM, personId: P_ANA, minutes: 60 }],
      });

      const fila = await WeekAssignedTime.findOne();
      toDayUTC(fila!.dateTo).should.equal(desdeLunes(LUNES, 4));
    });

    it('TS-4 · reemplazo TOTAL: la semana anterior desaparece entera', async () => {
      await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES,
        assignments: [
          { projectId: PROJ_COM, personId: P_ANA, minutes: 480 },
          { projectId: PROJ_COM, personId: P_BETO, minutes: 240 },
        ],
      });

      const reply = await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES,
        assignments: [{ projectId: PROJ_COM, personId: P_ANA, minutes: 120 }],
      });

      reply.status.should.equal('success');
      const filas = await WeekAssignedTime.findAll({ where: { dateFrom: LUNES } });
      filas.length.should.equal(1);
      filas[0].minutes.should.equal(120);
    });

    it('TS-5 · una lista vacía VACÍA la semana, y es válida', async () => {
      await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES,
        assignments: [{ projectId: PROJ_COM, personId: P_ANA, minutes: 480 }],
      });

      const reply = await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES,
        assignments: [],
      });

      reply.status.should.equal('success');
      (await WeekAssignedTime.count({ where: { dateFrom: LUNES } })).should.equal(0);
    });

    it('TS-6 · no toca OTRAS semanas', async () => {
      await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES_SIGUIENTE,
        assignments: [{ projectId: PROJ_COM, personId: P_ANA, minutes: 300 }],
      });

      await dispatch('week-assigned-times.replace', { dateFrom: LUNES, assignments: [] });

      (await WeekAssignedTime.count({ where: { dateFrom: LUNES_SIGUIENTE } })).should.equal(1);
    });
  });

  describe('la derivación de `internal` y el descarte de los ceros', () => {
    it('TS-7 · `internal: true` derivado de un proyecto `interno` (CA-6)', async () => {
      const reply = await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES,
        assignments: [{ projectId: PROJ_INT, personId: P_ANA, minutes: 480 }],
      });

      reply.status.should.equal('success');
      const fila = await WeekAssignedTime.findOne();
      fila!.internal.should.be.true();
    });

    it('TS-8 · `internal: false` derivado de un proyecto `comercial` (CA-6)', async () => {
      const reply = await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES,
        assignments: [{ projectId: PROJ_COM, personId: P_ANA, minutes: 480 }],
      });

      reply.status.should.equal('success');
      const fila = await WeekAssignedTime.findOne();
      fila!.internal.should.be.false();
    });

    it('TS-9 · `internal` NO se acepta del payload (CA-6)', async () => {
      const reply = await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES,
        assignments: [
          { projectId: PROJ_COM, personId: P_ANA, minutes: 60, internal: true },
        ],
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    });

    it('TS-10 · las asignaciones con `minutes: 0` se DESCARTAN (CA-7)', async () => {
      const reply = await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES,
        assignments: [
          { projectId: PROJ_COM, personId: P_ANA, minutes: 0 },
          { projectId: PROJ_COM, personId: P_BETO, minutes: 480 },
        ],
      });

      reply.status.should.equal('success');
      const filas = await WeekAssignedTime.findAll({ where: { dateFrom: LUNES } });
      filas.length.should.equal(1);
      filas[0].personId.should.equal(P_BETO);
    });

    it('TS-11 · todas en `0` deja la semana vacía SIN error (CA-7)', async () => {
      const reply = await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES,
        assignments: [{ projectId: PROJ_COM, personId: P_ANA, minutes: 0 }],
      });

      reply.status.should.equal('success');
      (await WeekAssignedTime.count({ where: { dateFrom: LUNES } })).should.equal(0);
    });
  });

  describe('las referencias del payload', () => {
    it('TS-12 · un proyecto inexistente → `project_not_found`', async () => {
      const reply = await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES,
        assignments: [{ projectId: 999999, personId: P_ANA, minutes: 60 }],
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.PROJECT_NOT_FOUND);
    });

    it('TS-13 · una persona inexistente → `person_not_found`', async () => {
      // ES LA ÚNICA DIFERENCIA DE COMPORTAMIENTO OBSERVABLE con la api, y está DECLARADA en el
      // contrato: la api no valida personas y una `personId` inexistente rompe por foreign key,
      // saliendo 500. El comando la valida y responde 400.
      const reply = await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES,
        assignments: [{ projectId: PROJ_COM, personId: 999999, minutes: 60 }],
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.PERSON_NOT_FOUND);
    });

    it('TS-14 · EL TEST MÁS IMPORTANTE: un fallo NO deja la semana a medio reemplazar', async () => {
      // La garantía es de ADR-003 y el comando no escribe una línea para obtenerla: el despachador
      // hace rollback en cuanto el reply no es `success`, así que un `destroy` ya ejecutado se
      // pierde solo. Este test convierte esa promesa en una regresión detectable.
      await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES,
        assignments: [
          { projectId: PROJ_COM, personId: P_ANA, minutes: 480 },
          { projectId: PROJ_COM, personId: P_BETO, minutes: 240 },
        ],
      });

      const reply = await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES,
        assignments: [
          { projectId: PROJ_COM, personId: P_ANA, minutes: 60 },
          { projectId: 999999, personId: P_BETO, minutes: 60 },
        ],
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.PROJECT_NOT_FOUND);

      // LA MITAD QUE IMPORTA: la semana quedó ENTERA, no vacía y no a medias.
      const filas = await WeekAssignedTime.findAll({
        where: { dateFrom: LUNES }, order: [['minutes', 'DESC']],
      });
      filas.length.should.equal(2);
      filas.map((f) => f.minutes).should.deepEqual([480, 240]);
    });

    it('TS-14b · lo mismo con una PERSONA inexistente', async () => {
      // EL CASO SIMÉTRICO, y es el que fallaría si alguien reordenara las validaciones y dejara
      // la de personas DESPUÉS del `destroy`.
      await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES,
        assignments: [
          { projectId: PROJ_COM, personId: P_ANA, minutes: 480 },
          { projectId: PROJ_COM, personId: P_BETO, minutes: 240 },
        ],
      });

      const reply = await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES,
        assignments: [
          { projectId: PROJ_COM, personId: P_ANA, minutes: 60 },
          { projectId: PROJ_COM, personId: 999999, minutes: 60 },
        ],
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.PERSON_NOT_FOUND);

      const filas = await WeekAssignedTime.findAll({
        where: { dateFrom: LUNES }, order: [['minutes', 'DESC']],
      });
      filas.length.should.equal(2);
      filas.map((f) => f.minutes).should.deepEqual([480, 240]);
    });
  });

  describe('C-36 · no se modifican semanas pasadas', () => {
    it('TS-15 · la semana ANTERIOR se rechaza con `invalid_date_range` (CA-4)', async () => {
      const reply = await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES_ANTERIOR,
        assignments: [],
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_DATE_RANGE);
      // EL TEXTO SE CONSERVA de `validate-week-not-past.ts`: cruza el bus y llega al usuario final.
      reply.errorMessage!.should.equal('No se pueden modificar semanas pasadas');
    });

    it('TS-16 · borde: la semana ACTUAL se acepta (CA-4)', async () => {
      const reply = await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES,
        assignments: [{ projectId: PROJ_COM, personId: P_ANA, minutes: 60 }],
      });

      reply.status.should.equal('success');
    });

    it('TS-17 · borde: la semana SIGUIENTE se acepta (CA-4)', async () => {
      const reply = await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES_SIGUIENTE,
        assignments: [{ projectId: PROJ_COM, personId: P_ANA, minutes: 60 }],
      });

      reply.status.should.equal('success');
    });

    it('TS-18 · al rechazar por C-36 NO borra nada', async () => {
      // La semana pasada no se puede sembrar por el comando —es justo lo que C-36 impide— así que
      // la fila se crea directo.
      await WeekAssignedTime.create({
        dateFrom: LUNES_ANTERIOR, dateTo: desdeLunes(LUNES_ANTERIOR, 4),
        internal: false, minutes: 300, projectId: PROJ_COM, personId: P_ANA,
      });

      const reply = await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES_ANTERIOR,
        assignments: [],
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_DATE_RANGE);
      (await WeekAssignedTime.count({ where: { dateFrom: LUNES_ANTERIOR } })).should.equal(1);
    });
  });

  describe('CA-5 · `dateFrom` tiene que ser lunes', () => {
    it('TS-19 · un martes se rechaza con `invalid_fields`, NO con `invalid_date_range`', async () => {
      const reply = await dispatch('week-assigned-times.replace', {
        dateFrom: desdeLunes(LUNES, 1),
        assignments: [],
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    });

    it('TS-20 · un domingo se rechaza — el borde de `getUTCDay() === 0`', async () => {
      const reply = await dispatch('week-assigned-times.replace', {
        dateFrom: desdeLunes(LUNES, -1),
        assignments: [],
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    });

    it('TS-21 · la regla del lunes corre ANTES que C-36: un martes pasado sale `invalid_fields`', async () => {
      // Joi corre en el despachador, antes de abrir la transacción y antes de `execute`. Es lo
      // que hace que las dos reglas no puedan confundirse en el reply.
      const reply = await dispatch('week-assigned-times.replace', {
        dateFrom: desdeLunes(LUNES_ANTERIOR, 1),
        assignments: [],
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    });
  });

  describe('el esquema', () => {
    it('TS-22 · falta `dateFrom`', async () => {
      const reply = await dispatch('week-assigned-times.replace', { assignments: [] });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    });

    it('TS-23 · falta `assignments`', async () => {
      const reply = await dispatch('week-assigned-times.replace', { dateFrom: LUNES });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    });

    it('TS-24 · `dateFrom` con formato inválido', async () => {
      const reply = await dispatch('week-assigned-times.replace', {
        dateFrom: '24/08/2026', assignments: [],
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    });

    it('TS-25 · un campo desconocido de primer nivel se rechaza — el gate de H-4', async () => {
      // EL CONTRATO DEL BUS Y EL HTTP USAN NOMBRES DISTINTOS, y no es un typo: por HTTP la ruta
      // recibe `weekStart`/`allocations`, por el bus `dateFrom`/`assignments`. La traducción la
      // hace la api. Un esquema escrito con los nombres de HTTP compila, pasa el lint y rechaza
      // TODO lo que la api mande — este test es lo que lo atrapa.
      const reply = await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES, assignments: [], weekStart: LUNES,
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    });

    it('TS-26 · falta `personId` en un ítem', async () => {
      const reply = await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES,
        assignments: [{ projectId: PROJ_COM, minutes: 60 }],
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    });

    it('TS-27 · `minutes` negativo se rechaza', async () => {
      const reply = await dispatch('week-assigned-times.replace', {
        dateFrom: LUNES,
        assignments: [{ projectId: PROJ_COM, personId: P_ANA, minutes: -5 }],
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
    });
  });

  describe('los gates estructurales', () => {
    it('TS-35 · el registry declara 23 comandos, e incluye el 21 (CA-1)', () => {
      // SUMAR EL COMANDO AL REGISTRO ES SUMAR EL ENDPOINT: `registerService` deriva un endpoint
      // por patrón de `patterns()`, así que este número ES el de `nats micro info jiku-commands`.
      // 23, no 21: REQ-011 (S-046) sumó los comandos 22 y 23.
      registry.patterns().length.should.equal(23);
      registry.patterns().should.containEql('week-assigned-times.replace');
    });
  });
});
