import 'mocha';
import 'should';
import { RequirementSnapshot } from '@jiku/nats-protocol';
import { requirementCreated } from '../../src/events/domain/requirement';

function snapshot(): RequirementSnapshot {
  return {
    id: 42, title: 'T', description: 'D', type: null, priority: 'media', state: 'analisis',
    estimatedFinishDate: null, tags: [], responsiblePersonIds: [7, 3, 9], projectId: 7,
    createdBy: '3233', visibilityLevel: 'public', createdAt: '2026-09-08T00:00:00.000Z',
    updatedAt: '2026-09-08T00:00:00.000Z', finishedAt: null,
  };
}

describe('events/domain/requirement — requirementCreated() (Task 4 de S-063)', () => {
  it('TS-43 · es una función pura: NO trae eventId, occurredAt, version ni correlationId', () => {
    const event = requirementCreated({
      requirement: { id: 42, projectId: 7 },
      actorId: '3233',
      actorEnvelope: { id: '3233', roles: ['admin'], name: 'Lautaro Alvarez' },
      snapshot: snapshot(),
      recipients: { subscriptors: [], responsiblePersonIds: [7, 3, 9] },
    });

    ('eventId' in event).should.be.false();
    ('occurredAt' in event).should.be.false();
    ('version' in event).should.be.false();
    ('correlationId' in event).should.be.false();

    event.type.should.equal('requirement.created');
    event.actor.should.deepEqual({ id: '3233', name: 'Lautaro Alvarez' });
    event.entity.should.deepEqual({ type: 'requirement', id: 42, projectId: 7 });
    event.snapshot.should.deepEqual(snapshot());
    event.recipients!.should.deepEqual({ subscriptors: [], responsiblePersonIds: [7, 3, 9] });
  });

  it('TS-4 · entity deep-equals {type, id, projectId}', () => {
    const event = requirementCreated({
      requirement: { id: 99, projectId: 12 },
      actorId: '3233',
      actorEnvelope: undefined,
      snapshot: snapshot(),
      recipients: { subscriptors: [], responsiblePersonIds: [] },
    });

    event.entity.should.deepEqual({ type: 'requirement', id: 99, projectId: 12 });
  });

  it('TS-39 · actor.name sale del sobre cuando está presente', () => {
    const event = requirementCreated({
      requirement: { id: 1, projectId: 1 },
      actorId: '3233',
      actorEnvelope: { id: '3233', roles: ['admin'], name: 'Lautaro Alvarez' },
      snapshot: snapshot(),
      recipients: { subscriptors: [], responsiblePersonIds: [] },
    });

    event.actor.should.deepEqual({ id: '3233', name: 'Lautaro Alvarez' });
  });

  it('TS-40 · actor.name cae a email cuando el sobre no trae name', () => {
    const event = requirementCreated({
      requirement: { id: 1, projectId: 1 },
      actorId: '3233',
      actorEnvelope: { id: '3233', roles: ['admin'], email: 'lautaro@grava.digital' },
      snapshot: snapshot(),
      recipients: { subscriptors: [], responsiblePersonIds: [] },
    });

    event.actor.name!.should.equal('lautaro@grava.digital');
  });

  it('TS-41 · actor.name cae al id cuando no hay sobre (canal directo)', () => {
    const event = requirementCreated({
      requirement: { id: 1, projectId: 1 },
      actorId: '5555',
      actorEnvelope: undefined,
      snapshot: snapshot(),
      recipients: { subscriptors: [], responsiblePersonIds: [] },
    });

    event.actor.should.deepEqual({ id: '5555', name: '5555' });
  });

  it('TS-42 · actor.email NUNCA viaja, ni siquiera cuando el sobre lo trae', () => {
    const event = requirementCreated({
      requirement: { id: 1, projectId: 1 },
      actorId: '3233',
      actorEnvelope: {
        id: '3233', roles: ['admin'], name: 'Lautaro Alvarez', email: 'lautaro@grava.digital',
      },
      snapshot: snapshot(),
      recipients: { subscriptors: [], responsiblePersonIds: [] },
    });

    ('email' in event.actor).should.be.false();
    JSON.stringify(event.actor).should.not.containEql('lautaro@grava.digital');
  });

  it('TS-34 · changes está AUSENTE, no en undefined', () => {
    const event = requirementCreated({
      requirement: { id: 1, projectId: 1 },
      actorId: '3233',
      actorEnvelope: undefined,
      snapshot: snapshot(),
      recipients: { subscriptors: [], responsiblePersonIds: [] },
    });

    ('changes' in event).should.be.false();
  });

  it('TS-35 · recipients está presente incluso cuando subscriptors es []', () => {
    const event = requirementCreated({
      requirement: { id: 1, projectId: 1 },
      actorId: '3233',
      actorEnvelope: undefined,
      snapshot: snapshot(),
      recipients: { subscriptors: [], responsiblePersonIds: [7, 3, 9] },
    });

    event.recipients!.should.deepEqual({ subscriptors: [], responsiblePersonIds: [7, 3, 9] });
  });
});
