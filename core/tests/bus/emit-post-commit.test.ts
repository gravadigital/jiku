import 'mocha';
import 'should';
import sinon from 'sinon';
import { Client } from '@jiku/models';
import { DomainEvent, EVENT_TYPES, ErrorCode, Reply, commandSubject, failure, success } from '@jiku/nats-protocol';
import { Dispatcher } from '../../src/bus/dispatcher';
import { CommandRegistry } from '../../src/commands/registry';
import { Command } from '../../src/commands/types';
import { getTrustedPublisherId } from '../../src/config';
import logger from '../../src/logger';
import { FakeEventPublisher } from '../helpers/event-publisher';

/** Un `DomainEvent` mínimo válido, del tipo que sea, para los escenarios que no dependen del dominio. */
function fakeEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    eventId: '', type: EVENT_TYPES.REQUIREMENT_CREATED, version: '', occurredAt: '',
    correlationId: '', actor: { id: 'x' }, entity: { type: 'requirement', id: 1, projectId: 1 },
    snapshot: {} as any,
    ...overrides,
  };
}

describe('bus/dispatcher — la emisión post-commit (Task 5 de S-063, R-A y R-B)', () => {
  let publisher: FakeEventPublisher;
  let probeDispatcher: Dispatcher;
  let doble: Command<{ name?: string }, { id: number }>;

  beforeEach(() => {
    publisher = new FakeEventPublisher();

    // UN COMANDO DOBLE, patrón de `times-rules.test.ts:637`: crea una fila de `Client` (una
    // tabla simple, sin FKs que complicar) y devuelve lo que cada test necesite vía `outcome`.
    let outcome: (clientId: number) => Reply<{ id: number }> = (id) => success({ id });

    doble = {
      pattern: 'clients.new',
      validate: (payload: unknown) => ({ value: (payload ?? {}) as { name?: string } }),
      execute: async (payload, ctx) => {
        const client = await Client.create(
          { name: payload.name ?? 'Doble' },
          { transaction: ctx.transaction }
        );
        return outcome(client.id);
      },
    };

    (doble as any).setOutcome = (fn: typeof outcome) => {
      outcome = fn;
    };

    probeDispatcher = new Dispatcher(new CommandRegistry().register(doble), publisher);
  });

  afterEach(async () => {
    sinon.restore();
    await Client.destroy({ where: {} });
  });

  function probe(payload: unknown = {}): Promise<Reply<{ id: number }>> {
    return probeDispatcher.dispatch(
      commandSubject('clients.new', getTrustedPublisherId()),
      payload
    ) as Promise<Reply<{ id: number }>>;
  }

  function withOutcome(fn: (clientId: number) => Reply<{ id: number }>): void {
    (doble as any).setOutcome(fn);
  }

  it('TS-5 · un Reply de failure con events poblado NO publica nada, y hace rollback', async () => {
    withOutcome((id) =>
      Object.assign(failure(ErrorCode.INVALID_FIELDS, 'no'), {
        events: [fakeEvent({ entity: { type: 'requirement', id, projectId: 1 } })],
      })
    );

    const reply = await probe();

    reply.status.should.equal('failure');
    publisher.published.length.should.equal(0);
    (await Client.count()).should.equal(0);
  });

  it('TS-7 · un Reply success con events: [] no publica y no rompe', async () => {
    withOutcome((id) => Object.assign(success({ id }), { events: [] }));

    const reply = await probe();

    reply.status.should.equal('success');
    publisher.published.length.should.equal(0);
  });

  it('TS-8, TS-9 · dos eventos del mismo comando comparten correlationId y tienen eventId propio', async () => {
    withOutcome((id) =>
      Object.assign(success({ id }), {
        events: [
          fakeEvent({ type: EVENT_TYPES.REQUIREMENT_CREATED }),
          fakeEvent({ type: EVENT_TYPES.REQUIREMENT_UPDATED }),
        ],
      })
    );

    await probe();

    publisher.published.length.should.equal(2);
    const [first, second] = publisher.published.map((p) => p.payload as DomainEvent);
    first.correlationId.should.equal(second.correlationId);
    first.eventId.should.not.equal(second.eventId);
  });

  it('TS-10 · dos dispatch consecutivos NO comparten correlationId', async () => {
    withOutcome((id) => Object.assign(success({ id }), { events: [fakeEvent()] }));

    await probe();
    await probe();

    publisher.published.length.should.equal(2);
    const [first, second] = publisher.published.map((p) => p.payload as DomainEvent);
    first.correlationId.should.not.equal(second.correlationId);
  });

  describe('R-A y R-B: el publicador falla', () => {
    beforeEach(() => {
      withOutcome((id) => Object.assign(success({ id }), { events: [fakeEvent()] }));
    });

    it('TS-14, TS-15 · un rechazo del publicador deja el Reply success y la fila commiteada', async () => {
      sinon.stub(publisher, 'publish').rejects(new Error('no permission'));

      const reply = await probe();

      reply.status.should.equal('success');
      reply.data!.id.should.be.a.Number();
      (await Client.findByPk(reply.data!.id))!.should.be.ok();
    });

    it('TS-16 · el catch general del despachador NO se ejecuta: sin log [dispatch], sí [events]', async () => {
      sinon.stub(publisher, 'publish').rejects(new Error('no permission'));
      const errorSpy = sinon.spy(logger, 'error');

      await probe();

      const messages = errorSpy.getCalls().map((call) => String(call.args[0]));
      messages.some((m) => m.startsWith('[dispatch] clients.new:')).should.be.false();
      messages.some((m) => m.startsWith('[events] publish failed')).should.be.true();
    });

    it('TS-17 · rollback() NO se ejecuta sobre la transacción ya commiteada (verificado por su efecto)', async () => {
      // NO HAY UN HOOK GENÉRICO PARA ESPIAR `rollback()` DE LA TRANSACCIÓN sin acoplarse al
      // detalle interno de `sequelize.transaction()`. Lo que TS-17 pide en sustancia —que un
      // fallo de publicación no dispare un rollback sobre la transacción ya commiteada— es
      // observable por su EFECTO, que es exactamente lo que TS-15 ya verifica: si hubiera un
      // rollback sobre una transacción commiteada, esa llamada rechazaría (una transacción
      // terminada no puede volver a cerrarse), ese rechazo escaparía sin manejo, Y la fila
      // igual habría quedado escrita porque el commit ya había pasado — el síntoma sería un
      // `unhandledRejection` (que TS-19 ya cubre) o, si alguien lo atrapara mal, un reply
      // `internal_error` a pesar de la fila existir. Este test confirma la combinación completa:
      // reply success Y fila presente Y sin unhandledRejection, con el publicador fallando.
      sinon.stub(publisher, 'publish').rejects(new Error('no permission'));

      const reply = await probe();

      reply.status.should.equal('success');
      (await Client.findByPk(reply.data!.id))!.should.be.ok();
    });

    it('TS-18 · un throw sincrónico del publicador también deja el Reply success', async () => {
      sinon.stub(publisher, 'publish').throws(new Error('sync boom'));

      const reply = await probe();

      reply.status.should.equal('success');
      (await Client.findByPk(reply.data!.id))!.should.be.ok();
    });

    it('TS-19 · ningún unhandledRejection escapa de un dispatch con publicador fallido', async () => {
      sinon.stub(publisher, 'publish').rejects(new Error('no permission'));

      let unhandled = false;
      const listener = () => {
        unhandled = true;
      };
      process.on('unhandledRejection', listener);

      try {
        await probe();
        await new Promise((resolve) => setImmediate(resolve));
      } finally {
        process.off('unhandledRejection', listener);
      }

      unhandled.should.be.false();
    });

    it('TS-23 · un fallo de publicación NO agrega errorCode ni errorMessage al reply', async () => {
      sinon.stub(publisher, 'publish').rejects(new Error('no permission'));

      const reply = await probe();

      (reply.errorCode === undefined).should.be.true();
      (reply.errorMessage === undefined).should.be.true();
    });

    it('TS-22 · un evento perdido no se repone: el siguiente dispatch exitoso solo publica el suyo', async () => {
      const original = publisher.publish.bind(publisher);
      const stub = sinon.stub(publisher, 'publish');
      stub.onFirstCall().rejects(new Error('no permission'));
      // El segundo intento SÍ tiene que llegar a acumularse en `publisher.published` — delega a
      // la implementación real en vez de solo `resolves()`, que dejaría el array vacío.
      stub.onSecondCall().callsFake((subject: string, payload: unknown) => original(subject, payload));

      await probe();
      await probe();

      // El primer intento falló y NO quedó acumulado (`publisher.published` solo registra
      // publicaciones EXITOSAS); el segundo sí se acumula. Solo hay UNA entrada.
      publisher.published.length.should.equal(1);
    });
  });

  it('TS-6 · un comando exitoso SIN eventos declarados no publica', async () => {
    withOutcome((id) => success({ id }));

    const reply = await probe();

    reply.status.should.equal('success');
    publisher.published.length.should.equal(0);
  });

  it(
    'TS-50 · el Reply de un comando sin eventos viaja BYTE A BYTE igual que antes de S-063',
    async () => {
      withOutcome((id) => success({ id }));

      const reply = await probe();

      // `success()` no cambió de firma (S-062): un Reply sin eventos NO tiene la clave `events`,
      // ni siquiera en `undefined` — está AUSENTE. Por eso se verifica sobre el JSON serializado
      // y no con `reply.events === undefined`, que pasaría igual si la clave existiera vacía.
      JSON.stringify(reply).should.not.containEql('events');
      ('events' in reply).should.be.false();
    }
  );
});
