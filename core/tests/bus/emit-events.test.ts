import 'mocha';
import 'should';
import sinon from 'sinon';
import { DomainEvent, EVENTS_VERSION, EVENT_TYPES, eventSubject } from '@jiku/nats-protocol';
import { emitEvents } from '../../src/bus/emit-events';
import { FakeEventPublisher } from '../helpers/event-publisher';
import logger from '../../src/logger';

/** Un `DomainEvent` mínimo y válido, sin `eventId`/`occurredAt`/`version` (los completa el emisor). */
function baseEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    eventId: '',
    type: EVENT_TYPES.REQUIREMENT_CREATED,
    version: '',
    occurredAt: '',
    correlationId: '',
    actor: { id: '3233', name: 'Lautaro Alvarez' },
    entity: { type: 'requirement', id: 42, projectId: 7 },
    snapshot: {} as any,
    ...overrides,
  };
}

describe('bus/emit-events — la función de emisión aislada (Task 2 de S-063)', () => {
  let publisher: FakeEventPublisher;

  beforeEach(() => {
    publisher = new FakeEventPublisher();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('TS-3, TS-13 · completa eventId, occurredAt (ISO con milisegundos) y version del paquete', async () => {
    await emitEvents([baseEvent()], 'corr-1', publisher);

    publisher.published.length.should.equal(1);
    const payload = publisher.published[0].payload as DomainEvent;

    payload.eventId.should.be.a.String().and.not.empty();
    payload.eventId.should.match(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    payload.occurredAt.should.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    Date.parse(payload.occurredAt).should.not.be.NaN();
    payload.version.should.equal(EVENTS_VERSION);
    payload.correlationId.should.equal('corr-1');
  });

  it('TS-2 · el subject se arma con eventSubject(), nunca por concatenación', async () => {
    await emitEvents([baseEvent()], 'corr-1', publisher);

    publisher.published[0].subject.should.equal(eventSubject(EVENT_TYPES.REQUIREMENT_CREATED));
  });

  it('TS-7 · una lista vacía no publica y no loguea', async () => {
    const errorSpy = sinon.spy(logger, 'error');

    await emitEvents([], 'corr-1', publisher);

    publisher.published.length.should.equal(0);
    errorSpy.called.should.be.false();
  });

  it('TS-8, TS-9 · varios eventos del mismo lote comparten correlationId y tienen eventId propio', async () => {
    await emitEvents(
      [
        baseEvent({ type: EVENT_TYPES.REQUIREMENT_CREATED }),
        baseEvent({ type: EVENT_TYPES.REQUIREMENT_UPDATED }),
      ],
      'corr-shared',
      publisher
    );

    publisher.published.length.should.equal(2);
    const [first, second] = publisher.published.map((p) => p.payload as DomainEvent);

    first.correlationId.should.equal('corr-shared');
    second.correlationId.should.equal('corr-shared');
    first.eventId.should.not.equal(second.eventId);
  });

  it('TS-21 · un rechazo del publicador se absorbe y se loguea UNA vez con los cinco datos', async () => {
    const errorSpy = sinon.spy(logger, 'error');
    sinon.stub(publisher, 'publish').rejects(new Error('no permission'));

    await emitEvents([baseEvent()], 'corr-1', publisher);

    errorSpy.calledOnce.should.be.true();
    const message = String(errorSpy.firstCall.args[0]);
    message.should.match(/^\[events\] publish failed eventId=[0-9A-HJKMNP-TV-Z]{26} /);
    message.should.containEql('type=requirement.created');
    message.should.containEql('entity=requirement:42');
    message.should.containEql('project=7');
    message.should.containEql('reason=no permission');
  });

  it('TS-18 · un throw sincrónico del publicador se absorbe igual que un rechazo', async () => {
    const errorSpy = sinon.spy(logger, 'error');
    sinon.stub(publisher, 'publish').throws(new Error('sync boom'));

    await emitEvents([baseEvent()], 'corr-1', publisher).should.not.be.rejected();

    errorSpy.calledOnce.should.be.true();
    String(errorSpy.firstCall.args[0]).should.containEql('reason=sync boom');
  });

  it('TS-19 · un rechazo del publicador NUNCA produce un unhandledRejection', async () => {
    sinon.stub(publisher, 'publish').rejects(new Error('no permission'));

    let unhandled = false;
    const listener = () => {
      unhandled = true;
    };
    process.on('unhandledRejection', listener);

    try {
      await emitEvents([baseEvent()], 'corr-1', publisher);
      // Un tick extra para darle lugar a un rejection no manejado si lo hubiera.
      await new Promise((resolve) => setImmediate(resolve));
    } finally {
      process.off('unhandledRejection', listener);
    }

    unhandled.should.be.false();
  });

  it('TS-20 · con tres eventos y el segundo fallando, los otros dos se publican y hay UN solo log', async () => {
    const errorSpy = sinon.spy(logger, 'error');
    const stub = sinon.stub(publisher, 'publish');
    stub.onCall(0).resolves();
    stub.onCall(1).rejects(new Error('boom'));
    stub.onCall(2).resolves();

    await emitEvents(
      [
        baseEvent({ entity: { type: 'requirement', id: 1, projectId: 7 } }),
        baseEvent({ entity: { type: 'requirement', id: 2, projectId: 7 } }),
        baseEvent({ entity: { type: 'requirement', id: 3, projectId: 7 } }),
      ],
      'corr-1',
      publisher
    );

    stub.callCount.should.equal(3);
    errorSpy.calledOnce.should.be.true();
  });
});
