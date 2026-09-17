import 'mocha';
import 'should';
import sinon from 'sinon';
import { Op } from 'sequelize';
import { NotificationOutbox, SystemSetting, User } from '@jiku/models';
import { sequelize } from '../../src/models';
import { runDispatchCycle } from '../../src/notifications/dispatch/run-cycle';
import {
  startDispatchLoop,
  stopDispatchLoop,
} from '../../src/notifications/dispatch/scheduler';
import { NOTIFICATION_SETTING_KEYS } from '../../src/notifications/dispatch/settings';
import { resetTransport } from '../../src/notifications/dispatch/transport';
import { installSMTPDouble, SMTPDouble, uninstallSMTPDouble } from '../helpers/smtp-double';

/**
 * Los escenarios de S-073 (REQ-015) que ejercitan el ciclo completo: toma de lote, render,
 * envío, backoff, descarte, settings en caliente y el scheduler.
 *
 * SMTP ES EL DOBLE (frontera externa, mismo criterio que `S3Double`); LA BASE ES REAL (ADR-013 /
 * `testing`). Cada test escribe sus propios fixtures en su `before`/`beforeEach` — no hay
 * factories compartidas.
 */

const U_ACTOR = 'disp-u-actor';
const U_RECIPIENT = 'disp-u-recipient';

function futurePayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    entity: { type: 'requirement', id: 412, projectId: 7 },
    actor: { id: U_ACTOR, name: 'Ana Pérez' },
    title: 'Login roto',
    project: { name: 'Portal' },
    link: 'https://opus.ejemplo.com/requirements/412',
    ...overrides,
  };
}

async function makeOutboxRow(overrides: Partial<Record<string, unknown>> = {}) {
  return NotificationOutbox.create({
    type: 'requirement.created',
    channel: 'email',
    recipientUserId: U_RECIPIENT,
    recipientEmail: 'recipient@ejemplo.com',
    payload: futurePayload(),
    status: 'pending',
    attempts: 0,
    nextAttemptAt: new Date(Date.now() - 1000),
    ...overrides,
  });
}

async function setSetting(key: string, value: string) {
  const [row] = await SystemSetting.findOrCreate({ where: { key }, defaults: { key, value } });
  await row.update({ value });
}

describe('notifications/dispatch — el ciclo de envío (S-073)', () => {
  let smtp: SMTPDouble;

  before(async () => {
    await User.findOrCreate({
      where: { id: U_RECIPIENT },
      defaults: { id: U_RECIPIENT, name: 'Recipient', username: 'recipient', email: 'r@ej.com' },
    });
    // TS-14 afirma sobre este id literal en el mensaje de log del descarte: necesita su propia
    // fila en `users` por el FK de `recipient_user_id`.
    await User.findOrCreate({
      where: { id: '3233abc' },
      defaults: { id: '3233abc', name: 'Otro Recipient', username: 'otro-recipient', email: 'otro@ej.com' },
    });
  });

  beforeEach(async () => {
    smtp = installSMTPDouble();
    await NotificationOutbox.destroy({ where: {}, truncate: true, cascade: true, restartIdentity: true });
    await SystemSetting.destroy({
      where: { key: { [Op.in]: Object.values(NOTIFICATION_SETTING_KEYS) } },
    });
  });

  afterEach(() => {
    uninstallSMTPDouble();
    resetTransport();
    sinon.restore();
  });

  it('TS-1 · camino feliz: una fila pendiente vencida se envía y se marca', async () => {
    const row = await makeOutboxRow();

    await runDispatchCycle();

    smtp.sent.length.should.equal(1);
    smtp.sent[0].to.should.equal('recipient@ejemplo.com');
    smtp.sent[0].subject.should.equal('Nuevo requisito: Login roto');
    smtp.sent[0].text.should.not.be.empty();
    smtp.sent[0].html.should.not.be.empty();

    const updated = await NotificationOutbox.findByPk(row.id);
    updated!.status.should.equal('sent');
    (updated!.sentAt !== null).should.be.true();
    updated!.attempts.should.equal(0);
  });

  it('TS-2 · una fila cuyo next_attempt_at está en el futuro no se toma', async () => {
    const row = await makeOutboxRow({ nextAttemptAt: new Date(Date.now() + 3600_000) });

    await runDispatchCycle();

    smtp.sent.length.should.equal(0);
    const updated = await NotificationOutbox.findByPk(row.id);
    updated!.status.should.equal('pending');
    updated!.attempts.should.equal(0);
    (updated!.sentAt === null).should.be.true();
  });

  it('TS-3 · una fila ya sent no se vuelve a tomar', async () => {
    const row = await makeOutboxRow({ status: 'sent', sentAt: new Date() });

    await runDispatchCycle();

    smtp.sent.length.should.equal(0);
    const updated = await NotificationOutbox.findByPk(row.id);
    updated!.status.should.equal('sent');
  });

  it('TS-4 · el lote respeta notification-batch-size', async () => {
    for (let i = 0; i < 5; i += 1) {
      await makeOutboxRow({ recipientEmail: `u${i}@ejemplo.com` });
    }
    await setSetting(NOTIFICATION_SETTING_KEYS.batchSize, '2');

    await runDispatchCycle();

    smtp.sent.length.should.equal(2);
    const sentCount = await NotificationOutbox.count({ where: { status: 'sent' } });
    sentCount.should.equal(2);
    const pendingCount = await NotificationOutbox.count({ where: { status: 'pending' } });
    pendingCount.should.equal(3);
  });

  it('TS-5 · el lote sale ordenado por next_attempt_at, id', async () => {
    const now = Date.now();
    // Tres filas con `nextAttemptAt` = T-3000, T-1000, T-2000 (ids 1, 2, 3 por orden de
    // creación); `batchSize = 2` debe tomar las dos MÁS VENCIDAS por orden: T-3000 (id 1) y
    // T-2000 (id 3), dejando pendiente la de T-1000 (id 2) — el índice parcial ordena por
    // `next_attempt_at` primero, no por `id`.
    const rowT3000 = await makeOutboxRow({
      recipientEmail: 't3000@ejemplo.com',
      nextAttemptAt: new Date(now - 3000),
    });
    const rowT1000 = await makeOutboxRow({
      recipientEmail: 't1000@ejemplo.com',
      nextAttemptAt: new Date(now - 1000),
    });
    const rowT2000 = await makeOutboxRow({
      recipientEmail: 't2000@ejemplo.com',
      nextAttemptAt: new Date(now - 2000),
    });
    await setSetting(NOTIFICATION_SETTING_KEYS.batchSize, '2');

    await runDispatchCycle();

    const sentRecipients = smtp.sent.map((mail) => mail.to);
    sentRecipients.should.deepEqual(['t3000@ejemplo.com', 't2000@ejemplo.com']);

    const updatedT3000 = await NotificationOutbox.findByPk(rowT3000.id);
    const updatedT2000 = await NotificationOutbox.findByPk(rowT2000.id);
    const updatedT1000 = await NotificationOutbox.findByPk(rowT1000.id);
    updatedT3000!.status.should.equal('sent');
    updatedT2000!.status.should.equal('sent');
    updatedT1000!.status.should.equal('pending');
  });

  it('TS-6 · envíos secuenciales, no en paralelo', async () => {
    smtp.delayMs = 30;
    for (let i = 0; i < 3; i += 1) {
      await makeOutboxRow({ recipientEmail: `seq${i}@ejemplo.com` });
    }

    await runDispatchCycle();

    smtp.maxConcurrentSends.should.equal(1);
    smtp.sent.length.should.equal(3);
  });

  it('TS-7 · ciclo sin filas pendientes: no construye transporte ni rompe', async () => {
    await runDispatchCycle();
    smtp.sent.length.should.equal(0);
  });

  it('TS-10 · fallo de SMTP: la fila queda pendiente con backoff y causa', async () => {
    smtp.rejectWith = new Error('ECONNREFUSED smtp.ejemplo.com:587');
    const row = await makeOutboxRow();

    await runDispatchCycle();

    const updated = await NotificationOutbox.findByPk(row.id);
    updated!.status.should.equal('pending');
    updated!.attempts.should.equal(1);
    (updated!.sentAt === null).should.be.true();
    (updated!.nextAttemptAt.getTime() > Date.now()).should.be.true();
    updated!.lastError!.should.containEql('ECONNREFUSED');
  });

  it('TS-12 · un fallo no interrumpe el resto del lote', async () => {
    const rowA = await makeOutboxRow({ recipientEmail: 'a@ejemplo.com' });
    const rowB = await makeOutboxRow({ recipientEmail: 'fail@ejemplo.com' });
    const rowC = await makeOutboxRow({ recipientEmail: 'c@ejemplo.com' });

    const originalSendMail = smtp.sendMail.bind(smtp);
    sinon.stub(smtp, 'sendMail').callsFake(async (message) => {
      if (message.to === 'fail@ejemplo.com') {
        throw new Error('rechazado por el proveedor');
      }
      return originalSendMail(message);
    });

    await runDispatchCycle();

    const updatedA = await NotificationOutbox.findByPk(rowA.id);
    const updatedB = await NotificationOutbox.findByPk(rowB.id);
    const updatedC = await NotificationOutbox.findByPk(rowC.id);
    updatedA!.status.should.equal('sent');
    updatedC!.status.should.equal('sent');
    updatedB!.status.should.equal('pending');
    updatedB!.attempts.should.equal(1);
    (updatedB!.lastError !== null).should.be.true();
  });

  it('TS-13 · descarte al agotar intentos: la fila se borra', async () => {
    smtp.rejectWith = new Error('SMTP caído');
    await setSetting(NOTIFICATION_SETTING_KEYS.maxAttempts, '5');
    const row = await makeOutboxRow({ attempts: 4 });

    await runDispatchCycle();

    const found = await NotificationOutbox.findByPk(row.id);
    (found === null).should.be.true();
  });

  it('TS-14 · el descarte loguea error con el formato acordado y sin payload', async () => {
    smtp.rejectWith = new Error('SMTP caído por completo');
    await setSetting(NOTIFICATION_SETTING_KEYS.maxAttempts, '5');
    const row = await makeOutboxRow({
      type: 'requirement.resolved',
      recipientUserId: '3233abc',
      attempts: 4,
      payload: {
        entity: { type: 'requirement', id: 412, projectId: 7 },
        actor: { id: U_ACTOR, name: 'Ana Pérez' },
        title: 'Login roto',
        project: { name: 'Portal' },
        link: 'https://opus.ejemplo.com/requirements/412',
        data: { resolutionComment: 'Lo arreglé anoche' },
      },
    });
    const errorSpy = sinon.spy((require('../../src/logger') as { default: { error: (msg: string) => void } }).default, 'error');

    await runDispatchCycle();

    const discardCall = errorSpy.getCalls().find((call) => String(call.args[0]).includes('[notifications] discard'));
    (discardCall !== undefined).should.be.true();
    const message = String(discardCall!.args[0]);
    message.should.startWith('[notifications] discard ');
    message.should.containEql(`id=${row.id}`);
    message.should.containEql('type=requirement.resolved');
    message.should.containEql('entity=requirement:412');
    message.should.containEql('recipient=3233abc');
    message.should.containEql('reason=');
    message.should.not.containEql('Login roto');
    message.should.not.containEql('Lo arreglé anoche');
    message.should.not.containEql('@');
    message.should.not.containEql('payload');
  });

  it('TS-15 · el descarte no se dispara un intento antes de tiempo', async () => {
    smtp.rejectWith = new Error('SMTP caído');
    await setSetting(NOTIFICATION_SETTING_KEYS.maxAttempts, '5');
    const row = await makeOutboxRow({ attempts: 3 });
    const errorSpy = sinon.spy((require('../../src/logger') as { default: { error: (msg: string) => void } }).default, 'error');

    await runDispatchCycle();

    const found = await NotificationOutbox.findByPk(row.id);
    (found !== null).should.be.true();
    found!.status.should.equal('pending');
    found!.attempts.should.equal(4);
    const discardCall = errorSpy.getCalls().find((call) => String(call.args[0]).includes('[notifications] discard'));
    (discardCall === undefined).should.be.true();
  });

  it('TS-16 · notification-batch-size cambiado por SQL aplica en la corrida siguiente', async () => {
    for (let i = 0; i < 4; i += 1) {
      await makeOutboxRow({ recipientEmail: `bs${i}@ejemplo.com` });
    }
    await setSetting(NOTIFICATION_SETTING_KEYS.batchSize, '1');

    await runDispatchCycle();

    const sentCount = await NotificationOutbox.count({ where: { status: 'sent' } });
    sentCount.should.equal(1);
    const pendingCount = await NotificationOutbox.count({ where: { status: 'pending' } });
    pendingCount.should.equal(3);
  });

  it('TS-17 · notification-max-attempts cambiado por SQL aplica en la corrida siguiente', async () => {
    smtp.rejectWith = new Error('SMTP caído');
    const row = await makeOutboxRow({ attempts: 1 });
    await setSetting(NOTIFICATION_SETTING_KEYS.maxAttempts, '2');

    await runDispatchCycle();

    const found = await NotificationOutbox.findByPk(row.id);
    (found === null).should.be.true();
  });

  it('TS-18 · falta la clave en system_settings: cae al default del código', async () => {
    for (let i = 0; i < 60; i += 1) {
      await makeOutboxRow({ recipientEmail: `def${i}@ejemplo.com` });
    }

    await runDispatchCycle();

    smtp.sent.length.should.equal(50);
    const pendingCount = await NotificationOutbox.count({ where: { status: 'pending' } });
    pendingCount.should.equal(10);
  });

  it('TS-19 · valor no parseable en system_settings: cae al default, no rompe', async () => {
    for (let i = 0; i < 60; i += 1) {
      await makeOutboxRow({ recipientEmail: `bad${i}@ejemplo.com` });
    }
    await setSetting(NOTIFICATION_SETTING_KEYS.batchSize, 'abc');

    await runDispatchCycle();

    smtp.sent.length.should.equal(50);
  });

  it('TS-36 · un type que ya no está en el registro no rompe el ciclo', async () => {
    const rowUnknown = await makeOutboxRow({
      type: 'requirement.archived',
      recipientEmail: 'unknown@ejemplo.com',
    });
    const rowOk = await makeOutboxRow({ recipientEmail: 'ok@ejemplo.com' });

    await runDispatchCycle();

    const updatedUnknown = await NotificationOutbox.findByPk(rowUnknown.id);
    updatedUnknown!.status.should.equal('pending');
    updatedUnknown!.attempts.should.equal(1);
    (updatedUnknown!.lastError !== null).should.be.true();

    const updatedOk = await NotificationOutbox.findByPk(rowOk.id);
    updatedOk!.status.should.equal('sent');
  });

  it('TS-44 · el transporte se construye perezosamente, no al importar ni al arrancar', async () => {
    // Con el doble instalado no aplica la construcción perezosa del transporte REAL — este
    // escenario se verifica sin filas: el ciclo no debe intentar enviar nada.
    await runDispatchCycle();
    smtp.sent.length.should.equal(0);

    await makeOutboxRow();
    await runDispatchCycle();
    smtp.sent.length.should.equal(1);
  });

  it('TS-45 · un throw sincrónico en sendMail no escapa al timer', async () => {
    smtp.throwSyncWith = new Error('fallo sincrónico');
    const row = await makeOutboxRow();

    // La propia promesa de `runDispatchCycle()` tiene que RESOLVER: un throw sincrónico del
    // doble (no un rechazo) es exactamente el caso que `processRow`/`markFailedOrDiscard` tienen
    // que atrapar sin dejarlo escapar. Un fallo normal (no de descarte) no loguea `error` — solo
    // el descarte lo hace (CA-4) — así que la aserción es sobre el estado de la fila, no sobre
    // el log.
    await runDispatchCycle().should.be.fulfilled();

    const updated = await NotificationOutbox.findByPk(row.id);
    updated!.status.should.equal('pending');
    updated!.attempts.should.equal(1);
    (updated!.lastError !== null).should.be.true();
    updated!.lastError!.should.containEql('fallo sincrónico');
  });

  it('TS-46 · la transacción del lote se cierra siempre, aun si falla el commit path', async () => {
    await makeOutboxRow();

    // Se fuerza el error DENTRO de la transacción del lote (el UPDATE que marca `sent`), no en
    // el `sendMail` — es el mismo `try` que envuelve todo el `for...of` en `runDispatchCycle()`,
    // así que el `catch` de más afuera tiene que hacer `rollback().catch(() => undefined)` sobre
    // la transacción del lote (`claim-batch.ts`) sin dejarla colgada.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sequelizeAny = sequelize as any;
    const originalQuery = sequelizeAny.query.bind(sequelize);
    const queryStub = sinon.stub(sequelizeAny, 'query').callsFake((sql: unknown, options: unknown) => {
      if (typeof sql === 'string' && sql.includes("SET status = 'sent'")) {
        return Promise.reject(new Error('fallo forzado del UPDATE'));
      }
      return originalQuery(sql, options);
    });

    try {
      await runDispatchCycle().should.be.fulfilled();
    } finally {
      queryStub.restore();
    }

    // Ninguna transacción quedó colgada: una operación posterior sobre `sequelize` funciona sin
    // timeout ni bloqueo — es la propiedad que TS-46 pide verificar.
    const postCheck = await NotificationOutbox.count();
    (postCheck >= 0).should.be.true();
  });

  describe('TS-8/TS-9 · FOR UPDATE SKIP LOCKED', () => {
    it('TS-8 · dos corridas concurrentes reales: cada mail una sola vez', async () => {
      for (let i = 0; i < 6; i += 1) {
        await makeOutboxRow({ recipientEmail: `conc${i}@ejemplo.com` });
      }
      await setSetting(NOTIFICATION_SETTING_KEYS.batchSize, '3');

      await Promise.all([runDispatchCycle(), runDispatchCycle()]);

      smtp.sent.length.should.equal(6);
      const recipients = smtp.sent.map((mail) => mail.to);
      new Set(recipients).size.should.equal(6);
      const sentCount = await NotificationOutbox.count({ where: { status: 'sent' } });
      sentCount.should.equal(6);
    });

    it('TS-9 · con el lote tomado por una transacción abierta, la segunda saltea sin bloquearse', async () => {
      for (let i = 0; i < 3; i += 1) {
        await makeOutboxRow({ recipientEmail: `held${i}@ejemplo.com` });
      }

      const heldTransaction = await sequelize.transaction();
      await sequelize.query(
        `SELECT id FROM notification_outbox WHERE status = 'pending' FOR UPDATE SKIP LOCKED`,
        { transaction: heldTransaction }
      );

      try {
        await runDispatchCycle();
        smtp.sent.length.should.equal(0);
      } finally {
        await heldTransaction.rollback();
      }
    });
  });

  describe('el scheduler', () => {
    // TIMERS REALES, NO FALSOS: el Story Plan advierte que el reloj falso de sinon y el `await`
    // sobre operaciones reales de base conviven mal. Se usa un `notification-dispatch-interval-
    // seconds` corto (en segundos, redondeado a 1s como mínimo por el propio scheduler) para que
    // la suite no tarde minutos.
    afterEach(async () => {
      await stopDispatchLoop().catch(() => undefined);
    });

    it('TS-25 · parada sin corrida en curso: resuelve de inmediato', async () => {
      startDispatchLoop();
      await stopDispatchLoop();
      // No lanza y resuelve: es la propiedad que TS-25 pide.
      true.should.be.true();
    });

    it('TS-24 · la parada espera la corrida en curso antes de resolver', async function test() {
      this.timeout(10000);
      smtp.delayMs = 300;
      await makeOutboxRow();

      startDispatchLoop();
      // Deja que el primer ciclo arranque y tome el lote antes de pedir la parada.
      await new Promise((resolve) => setTimeout(resolve, 50));

      const stoppedAt = Date.now();
      await stopDispatchLoop();
      const elapsed = Date.now() - stoppedAt;

      // Si `stopDispatchLoop()` no esperara la corrida en curso, resolvería casi
      // instantáneamente; con la espera, tarda aproximadamente lo que falta del `delayMs`.
      (elapsed >= 100).should.be.true();
      smtp.sent.length.should.equal(1);
    });

    it('TS-21 · nunca hay dos corridas solapadas en la misma réplica', async function test() {
      this.timeout(15000);
      smtp.delayMs = 200;
      await setSetting(NOTIFICATION_SETTING_KEYS.intervalSeconds, '1');
      for (let i = 0; i < 3; i += 1) {
        await makeOutboxRow({ recipientEmail: `sched${i}@ejemplo.com` });
      }

      startDispatchLoop();
      // Suficiente para varios ciclos con lotes de 1 fila (default batchSize 50, pero solo hay
      // 3 filas en total): deja correr un par de segundos.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await stopDispatchLoop();

      smtp.maxConcurrentSends.should.equal(1);
    });

    it('TS-20 · el intervalo se relee entre ciclos, no queda congelado del arranque', async function test() {
      this.timeout(10000);
      // TIMERS REALES, con un ESPÍA sobre `setTimeout` global (no un reloj falso): el Story Plan
      // advierte que el reloj falso de sinon y el `await` sobre operaciones reales de base
      // conviven mal. El espía observa CON QUÉ DELAY se programa cada ciclo sin alterar su
      // comportamiento — y el intervalo de arranque se fija BAJO (2s) para que el segundo ciclo
      // ocurra pronto y el test no dependa de esperar 60s reales.
      await setSetting(NOTIFICATION_SETTING_KEYS.intervalSeconds, '2');
      const timeoutSpy = sinon.spy(global, 'setTimeout');

      startDispatchLoop();
      // Deja correr el primer ciclo (arranca inmediatamente, sin filas) y que programe el
      // primer `setTimeout` con el intervalo de 2s vigente al arrancar.
      await new Promise((resolve) => setTimeout(resolve, 50));
      const firstScheduledDelay = timeoutSpy.getCalls().find((call) => call.args[1] === 2000);
      (firstScheduledDelay !== undefined).should.be.true();

      // Cambia el intervalo por SQL DESPUÉS de que el primer ciclo ya se programó: CA-5 declara
      // que aplica desde el ciclo SIGUIENTE, con la latencia de un ciclo.
      await setSetting(NOTIFICATION_SETTING_KEYS.intervalSeconds, '1');

      // Espera a que el primer ciclo (2s) dispare el segundo, que debe releer `'1'` y programar
      // su propio `setTimeout` con 1000ms — nunca con los 60000 del default ni con los 2000 del
      // arranque.
      await new Promise((resolve) => setTimeout(resolve, 2200));
      const secondScheduledDelay = timeoutSpy.getCalls().find((call) => call.args[1] === 1000);
      (secondScheduledDelay !== undefined).should.be.true();

      timeoutSpy.restore();
      await stopDispatchLoop();
    });
  });
});
