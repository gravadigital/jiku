import 'mocha';
import 'should';
import * as sinon from 'sinon';
import { Op } from 'sequelize';
import { User } from '@jiku/models';
import { AuthEvent } from '@jiku/nats-protocol';
import { sequelize } from '../../src/models';
import logger from '../../src/logger';
import { EventDispatcher } from '../../src/events/dispatcher';
import { EventContext, EventOutcome } from '../../src/events/types';

const PERSON_ID = '281234567890123456';
const SERVICE_ID = '281234567890999999';

/**
 * Evento válido mínimo, sobre el que cada test cambia UN campo.
 *
 * `instance: 'dev'` porque `core/.env.test` fija `NATS_INSTANCE=dev` y `@jiku/nats-protocol` lee
 * `INSTANCE` AL IMPORTARSE: no se puede cambiar desde un test, y no hace falta — la mitad
 * realista del escenario de CA-12 es un evento con OTRA instancia, no un consumidor con otra.
 */
const validEvent = (): Record<string, unknown> => ({
  type: 'authenticated',
  version: 1,
  id: PERSON_ID,
  name: 'Ana Pérez',
  username: 'ana@grava.digital',
  email: 'ana@grava.digital',
  roles: ['user'],
  instance: 'dev',
  identity_type: 'person',
});

const SESSION = 'UAWUJEWODGQJGMUGZBJH4Y6XKTVD5V4G5EQZXUJA5QV3ZL2TP2JY3ZNH';

/**
 * Handlers de prueba. Van definidos acá y no en `src/`: un stub en `src/` es código muerto que
 * el próximo lector cree que sirve para algo (es la nota que dejó S-013).
 */
const applied = (): Promise<EventOutcome> => Promise.resolve<EventOutcome>('applied');

/** Siembra la fila con los seis campos, para los tests que verifican que NO cambió. */
function seedPerson(overrides: Partial<Record<string, unknown>> = {}): Promise<User> {
  return User.create({
    id: PERSON_ID,
    name: 'Ana Pérez',
    username: 'ana@grava.digital',
    email: 'ana@grava.digital',
    roles: ['user'],
    identityType: 'person',
    ...overrides,
  } as any);
}

describe('events/dispatcher', () => {
  afterEach(async () => {
    // SOLO los dos ids de este archivo. `User.destroy({ where: {} })` borraría los usuarios que
    // siembran otras suites: el truncado es al arrancar la corrida, no entre tests.
    await User.destroy({ where: { id: { [Op.in]: [PERSON_ID, SERVICE_ID] } } });
    sinon.restore();
  });

  it('TS-1 · instance distinta → descarta, y el warn imprime LOS DOS valores', async () => {
    const warn = sinon.spy(logger, 'warn');
    const transaction = sinon.spy(sequelize, 'transaction');
    const dispatcher = new EventDispatcher(applied);

    await dispatcher.dispatch({ ...validEvent(), instance: 'prod' });

    ((await User.findByPk(PERSON_ID)) === null).should.be.true();
    warn.callCount.should.equal(1);
    const message = String(warn.firstCall.args[0]);
    message.should.startWith('[events]');
    // LOS DOS VALORES son el criterio: tres causas distintas dan el mismo síntoma ("no llega ni
    // un evento") y esta línea es lo único que las separa.
    message.should.containEql('prod');
    message.should.containEql('dev');
    transaction.callCount.should.equal(0);
  });

  it('TS-2 · instance ausente → descarta con los dos valores (uno undefined)', async () => {
    const warn = sinon.spy(logger, 'warn');
    const dispatcher = new EventDispatcher(applied);
    const event = validEvent();
    delete event.instance;

    await dispatcher.dispatch(event);

    ((await User.findByPk(PERSON_ID)) === null).should.be.true();
    warn.callCount.should.equal(1);
    const message = String(warn.firstCall.args[0]);
    message.should.containEql('undefined');
    message.should.containEql('dev');
  });

  it('TS-3 · type ≠ authenticated → descarta, y NO toca una fila existente', async () => {
    await seedPerson();
    const warn = sinon.spy(logger, 'warn');
    const dispatcher = new EventDispatcher(applied);

    await dispatcher.dispatch({
      ...validEvent(),
      type: 'deauthenticated',
      name: 'Otro Nombre',
    });

    warn.callCount.should.equal(1);
    String(warn.firstCall.args[0]).should.startWith('[events]');
    // La aserción es "la fila no cambió", no "no hubo excepción".
    const user = (await User.findByPk(PERSON_ID))!;
    user.name.should.equal('Ana Pérez');
    user.roles.should.deepEqual(['user']);
  });

  it('TS-4 · version ≠ 1 → descarta sin escribir', async () => {
    const warn = sinon.spy(logger, 'warn');
    const dispatcher = new EventDispatcher(applied);

    await dispatcher.dispatch({ ...validEvent(), version: 2 });

    warn.callCount.should.equal(1);
    ((await User.findByPk(PERSON_ID)) === null).should.be.true();
  });

  it('TS-5 · falta un obligatorio → descarta SIN crear fila parcial (4 casos)', async () => {
    const dispatcher = new EventDispatcher(applied);

    // `email` SIGUE ACÁ, y es el punto: los cuatro obligatorios lo son PARA UNA PERSONA. Que
    // `identity_type: 'service'` lo vuelva opcional no aflojó nada de este lado — la guarda es
    // condicional, no se removió.
    for (const field of ['id', 'name', 'username', 'email']) {
      const warn = sinon.spy(logger, 'warn');
      const event = validEvent();
      delete event[field];

      await dispatcher.dispatch(event);

      warn.callCount.should.equal(1);
      // El mensaje NOMBRA el campo faltante: es lo que hace diagnosticable el modo de falla de
      // `CALLOUT_IDP_ENRICH` ausente, donde `name` y `email` llegan vacíos en CADA evento.
      String(warn.firstCall.args[0]).should.containEql(field);
      (await User.count({ where: { id: PERSON_ID } })).should.equal(0);
      warn.restore();
    }
  });

  it('TS-5b · una PERSONA sin email sigue siendo descarte en las TRES formas', async () => {
    const dispatcher = new EventDispatcher(applied);

    // Ausente, `null` y cadena vacía. Las tres tienen que descartar para una persona: una
    // persona SÍ tiene dirección de correo, así que las tres significan que el emisor está mal
    // configurado (`CALLOUT_IDP_ENRICH` ausente es el caso real), y ese diagnóstico es el que
    // el `warn` conserva. Inventarle un valor taparía el problema.
    const shapes: Record<string, unknown>[] = [
      (() => {
        const e = validEvent();
        delete e.email;
        return e;
      })(),
      { ...validEvent(), email: null },
      { ...validEvent(), email: '' },
    ];

    for (const event of shapes) {
      const warn = sinon.spy(logger, 'warn');

      await dispatcher.dispatch(event);

      warn.callCount.should.equal(1);
      String(warn.firstCall.args[0]).should.containEql('email');
      (await User.count({ where: { id: PERSON_ID } })).should.equal(0);
      warn.restore();
    }
  });

  it('TS-5c · identity_type AUSENTE sin email descarta: el default es `person`', async () => {
    const warn = sinon.spy(logger, 'warn');
    const dispatcher = new EventDispatcher(applied);
    const event = validEvent();
    delete event.identity_type;
    delete event.email;

    await dispatcher.dispatch(event);

    // La excepción se apoya en `identity_type === 'service'`, y su ausencia cae en el default
    // `person`. Un emisor que dejara de mandar `identity_type` NO abre la puerta a filas sin
    // email: falla del lado seguro.
    warn.callCount.should.equal(1);
    String(warn.firstCall.args[0]).should.containEql('email');
    (await User.count({ where: { id: PERSON_ID } })).should.equal(0);
  });

  it('TS-6 · un cuerpo que no es un objeto no rompe la guarda', async () => {
    const transaction = sinon.spy(sequelize, 'transaction');
    const dispatcher = new EventDispatcher(applied);

    // Los cinco son JSON válido, así que `msg.json()` los entrega sin lanzar.
    await dispatcher.dispatch(null);
    await dispatcher.dispatch(undefined);
    await dispatcher.dispatch('texto');
    await dispatcher.dispatch([1, 2]);
    await dispatcher.dispatch(7);

    transaction.callCount.should.equal(0);
    (await User.count({ where: { id: { [Op.in]: [PERSON_ID, SERVICE_ID] } } })).should.equal(0);
  });

  it('TS-7 · un campo desconocido se IGNORA y el evento se procesa', async () => {
    const warn = sinon.spy(logger, 'warn');
    let received: AuthEvent | null = null;
    const dispatcher = new EventDispatcher(async (event, ctx: EventContext) => {
      received = event;
      await User.create(
        {
          id: event.id,
          name: event.name,
          username: event.username,
          email: event.email,
          roles: event.roles,
          identityType: event.identity_type,
        } as any,
        { transaction: ctx.transaction }
      );
      return 'applied';
    });

    await dispatcher.dispatch({
      ...validEvent(),
      campo_futuro_del_callout: 'x',
      otro: { anidado: true },
    });

    // `.unknown(true)` ejercitado: el schema del emisor vive en OTRO repo y puede crecer.
    const user = (await User.findByPk(PERSON_ID))!;
    user.name.should.equal('Ana Pérez');
    warn.callCount.should.equal(0);
    (received !== null).should.be.true();
  });

  it('TS-8 · los seis campos ignorados de hoy no rompen nada y NO se persisten', async () => {
    const dispatcher = new EventDispatcher(async (event, ctx: EventContext) => {
      await User.create(
        {
          id: event.id,
          name: event.name,
          username: event.username,
          email: event.email,
          roles: event.roles,
          identityType: event.identity_type,
        } as any,
        { transaction: ctx.transaction }
      );
      return 'applied';
    });

    await dispatcher.dispatch({
      ...validEvent(),
      authenticated_at: '2026-08-23T18:04:11.123Z',
      expires_at: '2026-08-23T19:04:11Z',
      client_ip: '10.1.2.3',
      session: SESSION,
      matched_role: 'user',
      template: 'templates/person.yaml',
    });

    const user = (await User.findByPk(PERSON_ID))!;
    const columns = Object.keys(user.get());
    // No hay bitácora de accesos por IP: RF-12 es explícito, y `client_ip` / `session` además
    // son minimización de datos personales.
    for (const ignored of [
      'client_ip',
      'session',
      'matched_role',
      'template',
      'authenticated_at',
      'expires_at',
    ]) {
      columns.should.not.containEql(ignored);
    }
  });

  it('TS-9 · el handler devuelve discarded → rollback, nada escrito', async () => {
    const dispatcher = new EventDispatcher(async (event, ctx: EventContext) => {
      await User.create(
        { id: event.id, name: 'x', username: 'x', email: 'x@y.z' } as any,
        { transaction: ctx.transaction }
      );
      return 'discarded';
    });

    await dispatcher.dispatch(validEvent());

    // La fila que el handler insertó SE PERDIÓ sin que pidiera nada: es ADR-003 con el
    // discriminante nuevo (`outcome` en vez de `reply.status`).
    ((await User.findByPk(PERSON_ID)) === null).should.be.true();
  });

  it('TS-10 · el handler LANZA → dispatch() resuelve, rollback y logger.error', async () => {
    const error = sinon.spy(logger, 'error');
    const dispatcher = new EventDispatcher(async (event, ctx: EventContext) => {
      await User.create(
        { id: event.id, name: 'x', username: 'x', email: 'x@y.z' } as any,
        { transaction: ctx.transaction }
      );
      throw new Error('boom');
    });

    // Resuelve, no rechaza: un rechazo mataría el `for await` de la suscripción.
    await dispatcher.dispatch(validEvent());

    ((await User.findByPk(PERSON_ID)) === null).should.be.true();
    error.callCount.should.equal(1);
    const message = String(error.firstCall.args[0]);
    message.should.startWith('[events]');
    message.should.containEql(PERSON_ID);
    message.should.containEql('boom');
  });

  it('TS-11 · el contexto del handler es EXACTAMENTE { transaction }', async () => {
    let captured: EventContext | null = null;
    const dispatcher = new EventDispatcher((_event, ctx) => {
      captured = ctx;
      return Promise.resolve<EventOutcome>('applied');
    });

    await dispatcher.dispatch(validEvent());

    const ctx = captured! as EventContext;
    Object.keys(ctx).should.deepEqual(['transaction']);
    (typeof (ctx.transaction as any).commit).should.equal('function');
    // Las cuatro ausencias son el contrato: sin `caller` (el subject no lo lleva), sin `params`
    // (el subject es literal) y sin `commit` / `rollback` (ADR-003).
    ((ctx as any).commit === undefined).should.be.true();
    ((ctx as any).rollback === undefined).should.be.true();
    ((ctx as any).caller === undefined).should.be.true();
    ((ctx as any).params === undefined).should.be.true();
  });

  it('TS-12 · una guarda que falla NO abre transacción', async () => {
    const transaction = sinon.spy(sequelize, 'transaction');
    const dispatcher = new EventDispatcher(applied);
    const missingName = validEvent();
    delete missingName.name;

    await dispatcher.dispatch({ ...validEvent(), instance: 'prod' });
    await dispatcher.dispatch({ ...validEvent(), type: 'deauthenticated' });
    await dispatcher.dispatch({ ...validEvent(), version: 2 });
    await dispatcher.dispatch(missingName);
    await dispatcher.dispatch(null);

    // Un payload inválido no consume una conexión del pool, igual que la validación de un
    // comando corre antes de la transacción.
    transaction.callCount.should.equal(0);
  });

  it('TS-13 · el log NO imprime el payload', async () => {
    const info = sinon.spy(logger, 'info');
    const warn = sinon.spy(logger, 'warn');
    const error = sinon.spy(logger, 'error');

    await new EventDispatcher(applied).dispatch(validEvent());
    await new EventDispatcher(applied).dispatch({ ...validEvent(), type: 'x' });
    await new EventDispatcher(applied).dispatch({ ...validEvent(), instance: 'prod' });
    await new EventDispatcher(() => Promise.reject(new Error('boom'))).dispatch({
      ...validEvent(),
      client_ip: '10.1.2.3',
      session: SESSION,
    });
    // El quinto: el único camino en que ESTE despachador loguea un resultado con el id. El par
    // `created` / `updated` lo emite el handler y lo cubre TS-21.
    await new EventDispatcher(() => Promise.resolve<EventOutcome>('discarded')).dispatch(
      validEvent()
    );

    const messages = [...info.getCalls(), ...warn.getCalls(), ...error.getCalls()].map((call) =>
      String(call.args[0])
    );
    messages.length.should.be.above(0);
    for (const message of messages) {
      message.should.not.containEql('ana@grava.digital');
      message.should.not.containEql('10.1.2.3');
      message.should.not.containEql(SESSION);
      message.should.not.containEql('Ana Pérez');
    }
    // El `id` sí: es lo que hace diagnosticable por qué una identidad no tiene sus roles.
    messages.some((message) => message.includes(PERSON_ID)).should.be.true();
    // Y el resultado: `discarded` acá, `created` / `updated` en TS-21.
    messages
      .some((message) => message.includes(`${PERSON_ID}: discarded`))
      .should.be.true();
  });

  it('TS-10 (bis) · si ABRIR la transacción falla, dispatch() TAMPOCO rechaza', async () => {
    const error = sinon.spy(logger, 'error');
    sinon.stub(sequelize, 'transaction').rejects(new Error('pool agotado'));
    const dispatcher = new EventDispatcher(applied);

    // "El despachador nunca lanza" no admite un camino donde sí: un rechazo acá lo tendría que
    // atrapar el `try/catch` por mensaje de la suscripción, y el log saldría con el subject en
    // vez del id de la identidad — el dato que sirve para diagnosticar.
    await dispatcher.dispatch(validEvent());

    error.callCount.should.equal(1);
    const message = String(error.firstCall.args[0]);
    message.should.startWith('[events]');
    message.should.containEql(PERSON_ID);
    message.should.containEql('pool agotado');
  });

  it('TS-14 · roles ausente o [] → [], y NO es un descarte', async () => {
    const dispatcher = new EventDispatcher(async (event, ctx: EventContext) => {
      const existing = await User.findByPk(event.id, { transaction: ctx.transaction });
      if (existing) {
        await existing.update({ roles: event.roles }, { transaction: ctx.transaction });
      } else {
        await User.create(
          {
            id: event.id,
            name: event.name,
            username: event.username,
            email: event.email,
            roles: event.roles,
            identityType: event.identity_type,
          } as any,
          { transaction: ctx.transaction }
        );
      }
      return 'applied';
    });

    const noRoles = validEvent();
    delete noRoles.roles;

    for (const event of [noRoles, { ...validEvent(), roles: [] }]) {
      const warn = sinon.spy(logger, 'warn');

      await dispatcher.dispatch(event);

      const user = (await User.findByPk(PERSON_ID))!;
      // Un evento VÁLIDO con una lista vacía: la consecuencia (esa identidad no queda
      // autorizada a nada) la produce la compuerta de S-017, no este consumidor.
      user.roles.should.deepEqual([]);
      warn.callCount.should.equal(0);
      warn.restore();
    }
  });
});
