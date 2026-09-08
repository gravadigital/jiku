import 'mocha';
import 'should';
import { RequirementSnapshot } from '@jiku/nats-protocol';
import {
  requirementCommentCreated, requirementCommentEdited, requirementReopened,
  requirementResolved, requirementStateChanged, requirementSubscriptorAdded,
  requirementSubscriptorRemoved, requirementUpdated,
} from '../../src/events/domain/requirement';

function snapshot(): RequirementSnapshot {
  return {
    id: 42, title: 'T', description: 'D', type: null, priority: 'media', state: 'analisis',
    estimatedFinishDate: null, tags: [], responsiblePersonIds: [7, 3, 9], projectId: 7,
    createdBy: '3233', visibilityLevel: 'public', createdAt: '2026-09-08T00:00:00.000Z',
    updatedAt: '2026-09-08T00:00:00.000Z', finishedAt: null,
  };
}

const RECIPIENTS = { subscriptors: [], responsiblePersonIds: [7, 3, 9] };
const ENTITY = { id: 42, projectId: 7 };
const ACTOR_ID = '3233';
const ACTOR_ENVELOPE = { id: '3233', roles: ['admin'], name: 'Lautaro Alvarez' };

/**
 * Los 8 constructores de S-064 (Task 3). Cada uno tiene su interfaz de input propia (una por
 * evento, no una base con opcionales — decisión deliberada de la Task 3), así que cada test le
 * pasa exactamente los campos que su evento declara.
 */
describe('events/domain/requirement — los 8 constructores de S-064', () => {
  describe('TS-77, TS-78 · los 8 son puros y usan su EVENT_TYPES', () => {
    it('requirementStateChanged', () => {
      const event = requirementStateChanged({
        requirement: ENTITY, actorId: ACTOR_ID, actorEnvelope: ACTOR_ENVELOPE,
        snapshot: snapshot(), recipients: RECIPIENTS, from: 'planificacion', to: 'desarrollo',
      });
      ('eventId' in event).should.be.false();
      ('occurredAt' in event).should.be.false();
      ('version' in event).should.be.false();
      ('correlationId' in event).should.be.false();
      event.type.should.equal('requirement.state.changed');
    });

    it('requirementUpdated', () => {
      const event = requirementUpdated({
        requirement: ENTITY, actorId: ACTOR_ID, actorEnvelope: ACTOR_ENVELOPE,
        snapshot: snapshot(), recipients: RECIPIENTS, title: { from: 'a', to: 'b' },
      });
      ('eventId' in event).should.be.false();
      ('occurredAt' in event).should.be.false();
      ('version' in event).should.be.false();
      ('correlationId' in event).should.be.false();
      event.type.should.equal('requirement.updated');
    });

    it('requirementResolved', () => {
      const event = requirementResolved({
        requirement: ENTITY, actorId: ACTOR_ID, actorEnvelope: ACTOR_ENVELOPE,
        snapshot: snapshot(), recipients: RECIPIENTS, from: 'revision',
        resolutionType: 'error_interno', resolutionConclusion: 'se corrigió',
        resolutionComment: null, finishedAt: '2026-09-08T00:00:00.000Z',
      });
      ('eventId' in event).should.be.false();
      ('occurredAt' in event).should.be.false();
      ('version' in event).should.be.false();
      ('correlationId' in event).should.be.false();
      event.type.should.equal('requirement.resolved');
    });

    it('requirementReopened', () => {
      const event = requirementReopened({
        requirement: ENTITY, actorId: ACTOR_ID, actorEnvelope: ACTOR_ENVELOPE,
        snapshot: snapshot(), recipients: RECIPIENTS, from: 'resuelto', to: 'desarrollo',
      });
      ('eventId' in event).should.be.false();
      ('occurredAt' in event).should.be.false();
      ('version' in event).should.be.false();
      ('correlationId' in event).should.be.false();
      event.type.should.equal('requirement.reopened');
    });

    it('requirementCommentCreated', () => {
      const event = requirementCommentCreated({
        requirement: ENTITY, actorId: ACTOR_ID, actorEnvelope: ACTOR_ENVELOPE,
        snapshot: snapshot(), recipients: RECIPIENTS,
        comment: { id: 908, body: 'texto', fileIds: [31, 32] }, visibilityLevel: 'internal',
      });
      ('eventId' in event).should.be.false();
      ('occurredAt' in event).should.be.false();
      ('version' in event).should.be.false();
      ('correlationId' in event).should.be.false();
      event.type.should.equal('requirement.comment.created');
    });

    it('requirementCommentEdited', () => {
      const event = requirementCommentEdited({
        requirement: ENTITY, actorId: ACTOR_ID, actorEnvelope: ACTOR_ENVELOPE,
        snapshot: snapshot(), recipients: RECIPIENTS,
        comment: { id: 908, body: 'texto nuevo', fileIds: [31] }, visibilityLevel: 'internal',
        editedAt: '2026-09-08T14:22:31.004Z', editedBy: '3233',
      });
      ('eventId' in event).should.be.false();
      ('occurredAt' in event).should.be.false();
      ('version' in event).should.be.false();
      ('correlationId' in event).should.be.false();
      event.type.should.equal('requirement.comment.edited');
    });

    it('requirementSubscriptorAdded', () => {
      const event = requirementSubscriptorAdded({
        requirement: ENTITY, actorId: ACTOR_ID, userId: '9988',
        snapshot: snapshot(), recipients: RECIPIENTS,
      });
      ('eventId' in event).should.be.false();
      ('occurredAt' in event).should.be.false();
      ('version' in event).should.be.false();
      ('correlationId' in event).should.be.false();
      event.type.should.equal('requirement.subscriptor.added');
    });

    it('requirementSubscriptorRemoved', () => {
      const event = requirementSubscriptorRemoved({
        requirement: ENTITY, actorId: ACTOR_ID, userId: '9988',
        snapshot: snapshot(), recipients: RECIPIENTS,
      });
      ('eventId' in event).should.be.false();
      ('occurredAt' in event).should.be.false();
      ('version' in event).should.be.false();
      ('correlationId' in event).should.be.false();
      event.type.should.equal('requirement.subscriptor.removed');
    });
  });

  it('TS-79 · requirementUpdated con un solo campo no inventa el otro', () => {
    const event = requirementUpdated({
      requirement: ENTITY, actorId: ACTOR_ID, actorEnvelope: ACTOR_ENVELOPE,
      snapshot: snapshot(), recipients: RECIPIENTS, title: { from: 'a', to: 'b' },
    });
    Object.keys(event.changes!).should.deepEqual(['title']);
  });

  it('requirementUpdated con description solamente tampoco inventa title', () => {
    const event = requirementUpdated({
      requirement: ENTITY, actorId: ACTOR_ID, actorEnvelope: ACTOR_ENVELOPE,
      snapshot: snapshot(), recipients: RECIPIENTS, description: { from: 'x', to: 'y' },
    });
    Object.keys(event.changes!).should.deepEqual(['description']);
  });

  it('requirementUpdated con los dos campos: changes lleva los dos', () => {
    const event = requirementUpdated({
      requirement: ENTITY, actorId: ACTOR_ID, actorEnvelope: ACTOR_ENVELOPE,
      snapshot: snapshot(), recipients: RECIPIENTS,
      title: { from: 'a', to: 'b' }, description: { from: 'x', to: 'y' },
    });
    Object.keys(event.changes!).sort().should.deepEqual(['description', 'title']);
  });

  it('TS-80 · requirementCommentCreated no lleva changes', () => {
    const event = requirementCommentCreated({
      requirement: ENTITY, actorId: ACTOR_ID, actorEnvelope: ACTOR_ENVELOPE,
      snapshot: snapshot(), recipients: RECIPIENTS,
      comment: { id: 908, body: 'texto', fileIds: [] }, visibilityLevel: 'internal',
    });
    ('changes' in event).should.be.false();
    event.comment!.should.deepEqual({ id: 908, body: 'texto', fileIds: [] });
    event.visibilityLevel!.should.equal('internal');
  });

  it('TS-81 · los dos constructores de suscriptor no llevan name ni con un sobre poblado', () => {
    const added = requirementSubscriptorAdded({
      requirement: ENTITY, actorId: '1', userId: '9988',
      snapshot: snapshot(), recipients: RECIPIENTS,
    });
    added.actor.should.deepEqual({ id: '1' });
    ('name' in added.actor).should.be.false();

    const removed = requirementSubscriptorRemoved({
      requirement: ENTITY, actorId: '1', userId: '9988',
      snapshot: snapshot(), recipients: RECIPIENTS,
    });
    removed.actor.should.deepEqual({ id: '1' });
    ('name' in removed.actor).should.be.false();
  });

  it('requirementStateChanged: changes.state deep-equals {from, to}', () => {
    const event = requirementStateChanged({
      requirement: ENTITY, actorId: ACTOR_ID, actorEnvelope: undefined,
      snapshot: snapshot(), recipients: RECIPIENTS, from: 'planificacion', to: 'desarrollo',
    });
    event.changes!.should.deepEqual({ state: { from: 'planificacion', to: 'desarrollo' } });
  });

  it('requirementReopened: changes deep-equals {state, resolutionCleared: true}', () => {
    const event = requirementReopened({
      requirement: ENTITY, actorId: ACTOR_ID, actorEnvelope: undefined,
      snapshot: snapshot(), recipients: RECIPIENTS, from: 'resuelto', to: 'desarrollo',
    });
    event.changes!.should.deepEqual({
      state: { from: 'resuelto', to: 'desarrollo' }, resolutionCleared: true,
    });
  });

  it('requirementResolved con los tres campos de resolución en null (CA-14)', () => {
    const event = requirementResolved({
      requirement: ENTITY, actorId: ACTOR_ID, actorEnvelope: undefined,
      snapshot: snapshot(), recipients: RECIPIENTS, from: 'revision',
      resolutionType: null, resolutionConclusion: null, resolutionComment: null,
      finishedAt: '2026-09-08T00:00:00.000Z',
    });
    event.changes!.should.deepEqual({
      state: { from: 'revision', to: 'resuelto' },
      resolutionType: null, resolutionConclusion: null, resolutionComment: null,
      finishedAt: '2026-09-08T00:00:00.000Z',
    });
  });

  it('requirementCommentEdited: Object.keys(changes) deep-equals [editedAt, editedBy]', () => {
    const event = requirementCommentEdited({
      requirement: ENTITY, actorId: ACTOR_ID, actorEnvelope: undefined,
      snapshot: snapshot(), recipients: RECIPIENTS,
      comment: { id: 908, body: 'nuevo', fileIds: [] }, visibilityLevel: 'internal',
      editedAt: '2026-09-08T14:22:31.004Z', editedBy: '3233',
    });
    Object.keys(event.changes!).sort().should.deepEqual(['editedAt', 'editedBy']);
    event.changes!.should.deepEqual({
      editedAt: '2026-09-08T14:22:31.004Z', editedBy: '3233',
    });
    ('from' in event.changes!).should.be.false();
    ('to' in event.changes!).should.be.false();
  });

  it('requirementSubscriptorAdded/.Removed: changes deep-equals {userId}', () => {
    const added = requirementSubscriptorAdded({
      requirement: ENTITY, actorId: ACTOR_ID, userId: '9988',
      snapshot: snapshot(), recipients: RECIPIENTS,
    });
    added.changes!.should.deepEqual({ userId: '9988' });

    const removed = requirementSubscriptorRemoved({
      requirement: ENTITY, actorId: ACTOR_ID, userId: '9988',
      snapshot: snapshot(), recipients: RECIPIENTS,
    });
    removed.changes!.should.deepEqual({ userId: '9988' });
  });

  it('entity deep-equals {type, id, projectId} en los 8', () => {
    const event = requirementStateChanged({
      requirement: { id: 99, projectId: 12 }, actorId: ACTOR_ID, actorEnvelope: undefined,
      snapshot: snapshot(), recipients: RECIPIENTS, from: 'a', to: 'b',
    });
    event.entity.should.deepEqual({ type: 'requirement', id: 99, projectId: 12 });
  });
});
