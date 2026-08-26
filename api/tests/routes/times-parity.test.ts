import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { Person, Project, UnworkedTime, User, WorkedTime } from '@jiku/models';
import { start } from '../mocks/app';
import { HOY, HOY_M11 } from '../helpers/dates';

/**
 * LA MITAD DE LA API DEL TEST DE PARIDAD (CA-14, RF-6).
 *
 * POR QUÉ ESTA MITAD NO COMPARA CONTRA `dispatch()`, y no es que esté incompleta:
 *
 * `core` YA PROBÓ que el sobre y el subject producen el mismo `Reply`
 * (`core/tests/commands/times-parity.test.ts`, TS-42.1…42.6). Repetir esa matriz acá sería
 * imposible —POR HTTP SOLO EXISTE EL CANAL DEL SOBRE— y cargar el dispatcher de core desde un test
 * de la api duplicaría la carga perezosa del `FakeBus` y estaría probando core desde el repo
 * equivocado (D-5 del plan).
 *
 * LO QUE ESTA MITAD AGREGA ES EL ESLABÓN QUE FALTABA: que **la traducción a HTTP de cada decisión
 * de `core` es la que el frontend ya conocía**. Cada `it` ejerce por HTTP la misma regla que un
 * `it` de core ejerce por `dispatch()`, y afirma el par `(status, code)` que CA-12 congela. Las dos
 * mitades juntas son lo que hace innecesario leer los dos codebases para creerle a RF-6.
 *
 * NINGÚN ESCENARIO USA `fakeBus.reply()`: todo el valor está en que `core` decida de verdad.
 */

/** El resultado reducido a lo que CA-12 congela: el par (status, code). */
function decision(res: request.Response): [number, string | null] {
  return [res.status, res.body?.code ?? null];
}

describe('S-031 · paridad HTTP de las reglas mudadas a core (CA-14, RF-6)', () => {
  let application: Application;

  /** Persona de `token_01_user` (`zitadel-sub-01`), rol `user`. */
  let P_ANA: number;
  /** Persona de `token_03_admin` (`zitadel-sub-03`), rol `admin`. */
  let P_BETO: number;
  let projectId: number;

  before(async () => {
    application = start();

    // Los TOKENS se reusan del mock —agregar uno por un archivo de test acopla el mock a este
    // archivo—. Lo que sí es PROPIO son las Personas y el proyecto: sus ids los pone la base, así
    // que no pueden colisionar con los que otros archivos siembran a mano.
    await User.bulkCreate([
      { id: 'zitadel-sub-01', name: 'Ana', username: 's031p-ana', email: 's031p-ana@t.local' },
      { id: 'zitadel-sub-03', name: 'Beto', username: 's031p-beto', email: 's031p-beto@t.local' },
    ]);

    const project = await Project.create({
      name: 'Proyecto S031 paridad HTTP', code: 'S031PH', status: 'activo', type: 'comercial',
      priority: 5, initDate: new Date(), createdBy: 'zitadel-sub-01',
    });
    projectId = project.id;

    const ana = await Person.create({
      firstName: 'Ana', lastName: 'Paridad', enabled: true, mustChargeWorkedTime: true,
      initDate: new Date('2024-01-01'), userId: 'zitadel-sub-01',
    });
    P_ANA = ana.id;

    const beto = await Person.create({
      firstName: 'Beto', lastName: 'Paridad', enabled: true, mustChargeWorkedTime: true,
      initDate: new Date('2024-01-01'), userId: 'zitadel-sub-03',
    });
    P_BETO = beto.id;
  });

  after(async () => {
    await WorkedTime.destroy({ where: {} });
    await UnworkedTime.destroy({ where: {} });
    await Person.destroy({ where: {} });
    await Project.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  // CADA ESCENARIO CREA SU PROPIA FILA y acá se limpian: si dos casos compartieran registro, el
  // primero lo borraría y el segundo dejaría de comparar lo mismo.
  afterEach(async () => {
    await WorkedTime.destroy({ where: {} });
    await UnworkedTime.destroy({ where: {} });
  });

  it('TS-40 · la VENTANA EN EL ALTA sale 400 `invalid_date_range` por HTTP (↔ TS-42.1 de core)', async () => {
    const res = await request(application)
      .post('/api/worked-times')
      .send({ date: HOY_M11, minutes: 60, projectId })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user');

    // SE AFIRMA EL PAR, no dos valores sueltos: lo que el test tiene que señalar es LA
    // DIVERGENCIA con el contrato congelado, no el valor nuevo.
    decision(res).should.deepEqual([400, 'invalid_date_range']);
  });

  it('TS-41 · la VENTANA EN EL BORRADO sale 400 `invalid_date_range` por HTTP (↔ TS-42.2)', async () => {
    const worked = await WorkedTime.create({
      date: HOY_M11, minutes: 60, projectId, personId: P_ANA,
    });

    const res = await request(application)
      .delete(`/api/worked-times/${worked.id}`)
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user');

    decision(res).should.deepEqual([400, 'invalid_date_range']);
  });

  it('TS-42 · C-41 (imputar a terceros) sale 403 `access_denied` por HTTP (↔ TS-42.3)', async () => {
    const res = await request(application)
      .post('/api/worked-times')
      .send({ date: HOY, minutes: 60, projectId, personId: P_BETO })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user');

    decision(res).should.deepEqual([403, 'access_denied']);
  });

  it('TS-43 · la TITULARIDAD AL BORRAR UNA HORA sale 403 `access_denied` por HTTP (↔ TS-42.4)', async () => {
    const worked = await WorkedTime.create({
      date: HOY, minutes: 60, projectId, personId: P_BETO,
    });

    const res = await request(application)
      .delete(`/api/worked-times/${worked.id}`)
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user');

    decision(res).should.deepEqual([403, 'access_denied']);
  });

  it('TS-44 · la TITULARIDAD EN AUSENCIAS sale 403 en el alta Y en el borrado (↔ TS-42.5)', async () => {
    const alta = await request(application)
      .post('/api/unworked-times')
      .send({ date: HOY, minutes: 60, reason: 'otro', personId: P_BETO })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user');

    decision(alta).should.deepEqual([403, 'access_denied']);

    // La ausencia se crea recién ahora y con `created_at` de hoy: el `validateDeadline` de la api
    // corre ANTES de publicar, así que una fila vencida cortaría antes de llegar a la titularidad
    // y el test mediría otra regla (H-4).
    const unworked = await UnworkedTime.create({
      date: HOY, minutes: 60, reason: 'otro', personId: P_BETO,
    });

    const borrado = await request(application)
      .delete(`/api/unworked-times/${unworked.id}`)
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user');

    decision(borrado).should.deepEqual([403, 'access_denied']);
  });

  it('TS-45 · CA-4: un `admin` imputa a un tercero y SE ACEPTA, con la fila escrita (↔ TS-42.6)', async () => {
    const res = await request(application)
      .post('/api/worked-times')
      .send({ date: HOY, minutes: 60, projectId, personId: P_ANA })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_03_admin');

    decision(res).should.deepEqual([201, null]);
    // LA PARIDAD NO ES SOLO DE CÓDIGOS DE ERROR: la escritura tiene que haber ocurrido, y sobre la
    // Persona que el `admin` indicó.
    (await WorkedTime.count({ where: { personId: P_ANA } })).should.equal(1);
  });
});
