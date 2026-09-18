import 'mocha';
import 'should';
import { TaskSnapshot } from '@jiku/nats-protocol';
import {
  taskAssigned, taskCommentCreated, taskCommentEdited, taskCreated, taskStateChanged, taskUpdated,
} from '../../src/events/domain/task';

function snapshot(): TaskSnapshot {
  return {
    id: 311, title: 'Diseñar el export', description: 'D', state: 'backlog', area: 'diseño',
    priority: 'media', priorityValue: 2, estimatedFinishDate: null, finishedAt: null,
    responsiblePersonIds: [9], visibilityLevel: 'public', projectId: 7, requirementId: 42,
    createdBy: '3233', createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z',
  };
}

const ENTITY = { id: 311, projectId: 7 };
const ACTOR_ID = '3233';
const ACTOR_ENVELOPE = { id: '3233', roles: ['admin'], name: 'Lautaro Alvarez' };

/**
 * Los 6 constructores de S-065/S-066 (Task 2 de S-065, Task 3 de S-066). El molde es
 * `requirement-events.test.ts`: cada uno tiene su interfaz de input propia, así que cada test le
 * pasa exactamente los campos que su evento declara.
 */
describe('events/domain/task — los 6 constructores de S-065/S-066', () => {
  describe('TS-80, TS-81 · los 6 son puros y usan su EVENT_TYPES', () => {
    it('taskCreated', () => {
      const event = taskCreated({
        task: ENTITY, actorId: ACTOR_ID, actorEnvelope: ACTOR_ENVELOPE, snapshot: snapshot(),
      });
      ('eventId' in event).should.be.false();
      ('occurredAt' in event).should.be.false();
      ('version' in event).should.be.false();
      ('correlationId' in event).should.be.false();
      event.type.should.equal('task.created');
    });

    it('taskStateChanged', () => {
      const event = taskStateChanged({
        task: ENTITY, actorId: ACTOR_ID, actorEnvelope: ACTOR_ENVELOPE, snapshot: snapshot(),
        from: 'backlog', to: 'activo',
      });
      ('eventId' in event).should.be.false();
      ('occurredAt' in event).should.be.false();
      ('version' in event).should.be.false();
      ('correlationId' in event).should.be.false();
      event.type.should.equal('task.state.changed');
    });

    it('taskUpdated', () => {
      const event = taskUpdated({
        task: ENTITY, actorId: ACTOR_ID, actorEnvelope: ACTOR_ENVELOPE, snapshot: snapshot(),
        title: { from: 'a', to: 'b' },
      });
      ('eventId' in event).should.be.false();
      ('occurredAt' in event).should.be.false();
      ('version' in event).should.be.false();
      ('correlationId' in event).should.be.false();
      event.type.should.equal('task.updated');
    });

    it('taskCommentCreated', () => {
      const event = taskCommentCreated({
        task: ENTITY, actorId: ACTOR_ID, actorEnvelope: ACTOR_ENVELOPE, snapshot: snapshot(),
        comment: { id: 908, body: 'texto', fileIds: [31, 32] }, visibilityLevel: 'internal',
      });
      ('eventId' in event).should.be.false();
      ('occurredAt' in event).should.be.false();
      ('version' in event).should.be.false();
      ('correlationId' in event).should.be.false();
      event.type.should.equal('task.comment.created');
    });

    it('taskCommentEdited', () => {
      const event = taskCommentEdited({
        task: ENTITY, actorId: ACTOR_ID, actorEnvelope: ACTOR_ENVELOPE, snapshot: snapshot(),
        comment: { id: 908, body: 'texto nuevo', fileIds: [31] }, visibilityLevel: 'internal',
        editedAt: '2026-09-08T14:22:31.004Z', editedBy: '3233',
      });
      ('eventId' in event).should.be.false();
      ('occurredAt' in event).should.be.false();
      ('version' in event).should.be.false();
      ('correlationId' in event).should.be.false();
      event.type.should.equal('task.comment.edited');
    });

    it('taskAssigned', () => {
      const event = taskAssigned({
        task: ENTITY, actorId: ACTOR_ID, actorEnvelope: ACTOR_ENVELOPE, snapshot: snapshot(),
        from: [9], to: [9, 4], added: [4], removed: [], leaderId: 9,
      });
      ('eventId' in event).should.be.false();
      ('occurredAt' in event).should.be.false();
      ('version' in event).should.be.false();
      ('correlationId' in event).should.be.false();
      event.type.should.equal('task.assigned');
    });
  });

  it('TS-82 · los 6 llevan entity.type: task', () => {
    const events = [
      taskCreated({ task: ENTITY, actorId: ACTOR_ID, actorEnvelope: undefined, snapshot: snapshot() }),
      taskStateChanged({
        task: ENTITY, actorId: ACTOR_ID, actorEnvelope: undefined, snapshot: snapshot(),
        from: 'backlog', to: 'activo',
      }),
      taskUpdated({
        task: ENTITY, actorId: ACTOR_ID, actorEnvelope: undefined, snapshot: snapshot(),
        title: { from: 'a', to: 'b' },
      }),
      taskCommentCreated({
        task: ENTITY, actorId: ACTOR_ID, actorEnvelope: undefined, snapshot: snapshot(),
        comment: { id: 1, body: 'x', fileIds: [] }, visibilityLevel: 'internal',
      }),
      taskCommentEdited({
        task: ENTITY, actorId: ACTOR_ID, actorEnvelope: undefined, snapshot: snapshot(),
        comment: { id: 1, body: 'x', fileIds: [] }, visibilityLevel: 'internal',
        editedAt: '2026-09-08T00:00:00.000Z', editedBy: ACTOR_ID,
      }),
      taskAssigned({
        task: ENTITY, actorId: ACTOR_ID, actorEnvelope: undefined, snapshot: snapshot(),
        from: [9], to: [9, 4], added: [4], removed: [], leaderId: 9,
      }),
    ];
    events.forEach((event) => event.entity.should.deepEqual({ type: 'task', id: 311, projectId: 7 }));
  });

  it('TS-83 · ningún constructor escribe recipients', () => {
    const events = [
      taskCreated({ task: ENTITY, actorId: ACTOR_ID, actorEnvelope: undefined, snapshot: snapshot() }),
      taskStateChanged({
        task: ENTITY, actorId: ACTOR_ID, actorEnvelope: undefined, snapshot: snapshot(),
        from: 'backlog', to: 'activo',
      }),
      taskUpdated({
        task: ENTITY, actorId: ACTOR_ID, actorEnvelope: undefined, snapshot: snapshot(),
        title: { from: 'a', to: 'b' },
      }),
      taskCommentCreated({
        task: ENTITY, actorId: ACTOR_ID, actorEnvelope: undefined, snapshot: snapshot(),
        comment: { id: 1, body: 'x', fileIds: [] }, visibilityLevel: 'internal',
      }),
      taskCommentEdited({
        task: ENTITY, actorId: ACTOR_ID, actorEnvelope: undefined, snapshot: snapshot(),
        comment: { id: 1, body: 'x', fileIds: [] }, visibilityLevel: 'internal',
        editedAt: '2026-09-08T00:00:00.000Z', editedBy: ACTOR_ID,
      }),
      taskAssigned({
        task: ENTITY, actorId: ACTOR_ID, actorEnvelope: undefined, snapshot: snapshot(),
        from: [9], to: [9, 4], added: [4], removed: [], leaderId: 9,
      }),
    ];
    events.forEach((event) => ('recipients' in event).should.be.false());
  });

  it('TS-84 · taskUpdated con un solo campo no inventa el otro', () => {
    const event = taskUpdated({
      task: ENTITY, actorId: ACTOR_ID, actorEnvelope: ACTOR_ENVELOPE, snapshot: snapshot(),
      title: { from: 'a', to: 'b' },
    });
    Object.keys(event.changes!).should.deepEqual(['title']);
  });

  it('taskUpdated con description solamente tampoco inventa title', () => {
    const event = taskUpdated({
      task: ENTITY, actorId: ACTOR_ID, actorEnvelope: ACTOR_ENVELOPE, snapshot: snapshot(),
      description: { from: 'x', to: 'y' },
    });
    Object.keys(event.changes!).should.deepEqual(['description']);
  });

  it('taskUpdated con los dos campos: changes lleva los dos', () => {
    const event = taskUpdated({
      task: ENTITY, actorId: ACTOR_ID, actorEnvelope: ACTOR_ENVELOPE, snapshot: snapshot(),
      title: { from: 'a', to: 'b' }, description: { from: 'x', to: 'y' },
    });
    Object.keys(event.changes!).sort().should.deepEqual(['description', 'title']);
  });

  it('TS-85 · taskUpdated acepta to: null en description', () => {
    const event = taskUpdated({
      task: ENTITY, actorId: ACTOR_ID, actorEnvelope: ACTOR_ENVELOPE, snapshot: snapshot(),
      description: { from: 'algo', to: null },
    });
    event.changes!.should.deepEqual({ description: { from: 'algo', to: null } });
  });

  it('TS-86 · taskCreated y taskCommentCreated no llevan changes', () => {
    const created = taskCreated({
      task: ENTITY, actorId: ACTOR_ID, actorEnvelope: ACTOR_ENVELOPE, snapshot: snapshot(),
    });
    const commentCreated = taskCommentCreated({
      task: ENTITY, actorId: ACTOR_ID, actorEnvelope: ACTOR_ENVELOPE, snapshot: snapshot(),
      comment: { id: 908, body: 'texto', fileIds: [] }, visibilityLevel: 'internal',
    });
    ('changes' in created).should.be.false();
    ('changes' in commentCreated).should.be.false();
    commentCreated.comment!.should.deepEqual({ id: 908, body: 'texto', fileIds: [] });
    commentCreated.visibilityLevel!.should.equal('internal');
  });

  it('TS-87 · taskCommentEdited lleva exactamente editedAt/editedBy en changes', () => {
    const event = taskCommentEdited({
      task: ENTITY, actorId: ACTOR_ID, actorEnvelope: ACTOR_ENVELOPE, snapshot: snapshot(),
      comment: { id: 908, body: 'nuevo', fileIds: [] }, visibilityLevel: 'internal',
      editedAt: '2026-09-08T14:22:31.004Z', editedBy: '3233',
    });
    Object.keys(event.changes!).sort().should.deepEqual(['editedAt', 'editedBy']);
    event.changes!.should.deepEqual({
      editedAt: '2026-09-08T14:22:31.004Z', editedBy: '3233',
    });
    ('from' in event.changes!).should.be.false();
    ('to' in event.changes!).should.be.false();
    ('visibilityLevel' in event.changes!).should.be.false();
    event.visibilityLevel!.should.equal('internal');
  });

  it('TS-12 · taskAssigned sin recipients', () => {
    const event = taskAssigned({
      task: ENTITY, actorId: ACTOR_ID, actorEnvelope: ACTOR_ENVELOPE, snapshot: snapshot(),
      from: [9], to: [9, 4], added: [4], removed: [], leaderId: 9,
    });
    event.type.should.equal('task.assigned');
    event.entity.type.should.equal('task');
    ('recipients' in event).should.be.false();
    event.changes!.should.deepEqual({
      responsiblePersonIds: { from: [9], to: [9, 4] },
      added: [4],
      removed: [],
      leaderId: 9,
    });
  });

  it('TS-13 · taskAssigned con actor.name por fallback a id', () => {
    const event = taskAssigned({
      task: ENTITY, actorId: '3233', actorEnvelope: undefined, snapshot: snapshot(),
      from: [9], to: [9, 4], added: [4], removed: [], leaderId: 9,
    });
    event.actor.should.deepEqual({ id: '3233', name: '3233' });
  });

  it('los 6 resuelven actor.name con el fallback name -> email -> id', () => {
    const withName = taskCreated({
      task: ENTITY, actorId: '3233',
      actorEnvelope: { id: '3233', roles: ['admin'], name: 'Lautaro Alvarez' },
      snapshot: snapshot(),
    });
    withName.actor.should.deepEqual({ id: '3233', name: 'Lautaro Alvarez' });

    const withEmail = taskCreated({
      task: ENTITY, actorId: '3233',
      actorEnvelope: { id: '3233', roles: ['admin'], email: 'lautaro@grava.digital' },
      snapshot: snapshot(),
    });
    withEmail.actor.name!.should.equal('lautaro@grava.digital');
    ('email' in withEmail.actor).should.be.false();

    const withoutEnvelope = taskCreated({
      task: ENTITY, actorId: '5555', actorEnvelope: undefined, snapshot: snapshot(),
    });
    withoutEnvelope.actor.should.deepEqual({ id: '5555', name: '5555' });
  });
});
