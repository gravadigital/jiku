import 'mocha';
import 'should';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { EVENT_TYPES, EVENTS_VERSION, eventSubject } from '@jiku/nats-protocol';
import {
  assertContract, CHANNEL_SHAPES, loadEventsContract, validatorFor,
} from '../helpers/events-contract';

/**
 * Tests PUROS del validador del contrato (Task 2 de S-067, TS-9 a TS-21): no tocan la base ni el
 * despachador. Los payloads de entrada se escriben a mano acá porque lo que se prueba es el
 * VALIDADOR, no el emisor — es el único lugar del plan donde eso es correcto (Testing
 * Requirements de la Task 2).
 */

function requirementSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: 1, title: 'Exportar el reporte a XLSX', description: 'Hoy solo se baja en CSV',
    type: null, priority: 'media', state: 'analisis', estimatedFinishDate: null, tags: [],
    responsiblePersonIds: [], projectId: 2, createdBy: 'u1', visibilityLevel: 'public',
    createdAt: '2026-09-08T14:22:31.004Z', updatedAt: '2026-09-08T14:22:31.004Z',
    finishedAt: null,
    ...overrides,
  };
}

function taskSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: 1, title: 'Ajustar el layout móvil', description: null, state: 'backlog',
    area: 'desarrollo', priority: 'media', priorityValue: 3, estimatedFinishDate: null,
    finishedAt: null, responsiblePersonIds: [], visibilityLevel: 'public', projectId: 2,
    requirementId: null, createdBy: 'u1', createdAt: '2026-09-08T14:22:31.004Z',
    updatedAt: '2026-09-08T14:22:31.004Z',
    ...overrides,
  };
}

function requirementEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    type: EVENT_TYPES.REQUIREMENT_CREATED,
    version: EVENTS_VERSION,
    occurredAt: '2026-09-08T14:22:31.004Z',
    correlationId: 'corr-1',
    actor: { id: 'u1' },
    entity: { type: 'requirement', id: 1, projectId: 2 },
    snapshot: requirementSnapshot(),
    recipients: { subscriptors: [], responsiblePersonIds: [] },
    ...overrides,
  };
}

function taskEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
    type: EVENT_TYPES.TASK_ASSIGNED,
    version: EVENTS_VERSION,
    occurredAt: '2026-09-08T14:22:31.004Z',
    correlationId: 'corr-2',
    actor: { id: 'u1' },
    entity: { type: 'task', id: 1, projectId: 2 },
    snapshot: taskSnapshot(),
    changes: { responsiblePersonIds: { from: [], to: [] } },
    ...overrides,
  };
}

describe('helpers/events-contract — el contrato compilado a validadores (S-067, Task 2)', () => {
  it('TS-9 · carga los 16 canales del contrato, en el orden del catálogo', () => {
    const contract = loadEventsContract();
    Object.keys(contract.channels).length.should.equal(16);
    Object.keys(contract.channels).should.deepEqual(Object.values(EVENT_TYPES));
  });

  it('TS-10 · el enum EventType del contrato y EVENT_TYPES son la misma lista, en el mismo orden', () => {
    const contract = loadEventsContract();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schemas = contract.components.schemas as any;
    schemas.EventType.enum.should.deepEqual(Object.values(EVENT_TYPES));
  });

  it('TS-11 · los nombres de canal y el enum del contrato son la misma lista, en el mismo orden', () => {
    const contract = loadEventsContract();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schemas = contract.components.schemas as any;
    Object.keys(contract.channels).should.deepEqual(schemas.EventType.enum);
  });

  it('TS-12 · nullable sin enum se traduce a unión con null, sin dejar la clave nullable', () => {
    const contract = loadEventsContract();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prop = (contract.components.schemas as any).RequirementSnapshot
      .properties.estimatedFinishDate;
    prop.type.should.deepEqual(['string', 'null']);
    prop.format.should.equal('date');
    ('nullable' in prop).should.be.false();
  });

  it('TS-13 · nullable CON enum agrega null también al enum (la mitad que se olvida)', () => {
    const contract = loadEventsContract();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prop = (contract.components.schemas as any).RequirementSnapshot.properties.type;
    prop.type.should.deepEqual(['string', 'null']);
    prop.enum.should.containEql(null);
    prop.enum.should.containEql('funcionalidad');
  });

  it('TS-14 · el adaptador es recursivo: llega a subscriptors.items.properties.email', () => {
    const contract = loadEventsContract();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prop = (contract.components.schemas as any).EventRecipients
      .properties.subscriptors.items.properties.email;
    prop.type.should.deepEqual(['string', 'null']);
  });

  it('TS-15 · un payload con los tres nulos legítimos valida', () => {
    const event = requirementEvent({
      snapshot: requirementSnapshot({ type: null, estimatedFinishDate: null, finishedAt: null }),
    });
    const validate = validatorFor(EVENT_TYPES.REQUIREMENT_CREATED);
    validate(event).should.be.true();
    (validate.errors == null).should.be.true();
  });

  it('TS-16 · un campo de más en la RAÍZ del sobre NO valida', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event: any = requirementEvent();
    event.finishedAt = '2026-09-08T14:22:31.004Z';
    const validate = validatorFor(EVENT_TYPES.REQUIREMENT_CREATED);
    validate(event).should.be.false();
    validate.errors!.some(
      (e) => e.keyword === 'additionalProperties'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        && (e.params as any).additionalProperty === 'finishedAt'
    ).should.be.true();
  });

  it('TS-17 · un campo de más en el snapshot NO valida', () => {
    const event = requirementEvent({ snapshot: requirementSnapshot({ totalMinutes: 120 }) });
    const validate = validatorFor(EVENT_TYPES.REQUIREMENT_CREATED);
    validate(event).should.be.false();
    validate.errors!.some(
      (e) => e.keyword === 'additionalProperties'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        && (e.params as any).additionalProperty === 'totalMinutes'
    ).should.be.true();
  });

  it('TS-18 · un required faltante NO valida, y el error nombra el campo', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event: any = requirementEvent();
    delete event.correlationId;
    const validate = validatorFor(EVENT_TYPES.REQUIREMENT_CREATED);
    validate(event).should.be.false();
    validate.errors!.some(
      (e) => e.keyword === 'required'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        && (e.params as any).missingProperty === 'correlationId'
    ).should.be.true();
  });

  describe('TS-19 · el oneOf del snapshot discrimina bien', () => {
    it('un task.assigned con snapshot de forma TaskSnapshot valida contra el sobre completo', () => {
      const validate = validatorFor(EVENT_TYPES.TASK_ASSIGNED);
      validate(taskEvent()).should.be.true();
    });

    // La propiedad que hace del `oneOf` una discriminación real y no un accidente: los dos
    // snapshots tienen `additionalProperties: false` y campos exclusivos (`tags` solo en
    // requisito; `area`/`priorityValue` solo en tarea, D-2/Implementation Notes de la Task 2).
    // Un TaskSnapshot bien formado NUNCA pasa como RequirementSnapshot, y viceversa — si en algún
    // momento alguien afloja `additionalProperties` en cualquiera de los dos, este test lo
    // detecta antes que un `anyOf` silenciosamente permisivo lo dejara pasar.
    it('un TaskSnapshot nunca es válido como RequirementSnapshot, y viceversa', () => {
      const contract = loadEventsContract();
      const ajv = new Ajv({ strict: false });
      addFormats(ajv);
      const validateAsRequirement = ajv.compile({
        $ref: '#/components/schemas/RequirementSnapshot',
        components: contract.components,
      });
      const validateAsTask = ajv.compile({
        $ref: '#/components/schemas/TaskSnapshot',
        components: contract.components,
      });

      validateAsTask(taskSnapshot()).should.be.true();
      validateAsRequirement(taskSnapshot()).should.be.false();

      validateAsRequirement(requirementSnapshot()).should.be.true();
      validateAsTask(requirementSnapshot()).should.be.false();
    });
  });

  it('TS-20 · format: date-time se verifica de verdad', () => {
    const event = requirementEvent({ snapshot: requirementSnapshot({ createdAt: 'ayer' }) });
    const validate = validatorFor(EVENT_TYPES.REQUIREMENT_CREATED);
    validate(event).should.be.false();
    validate.errors!.some((e) => e.keyword === 'format').should.be.true();
  });

  it('TS-21 · CHANNEL_SHAPES cubre los 16 y solo los 16, en el orden del catálogo', () => {
    Object.keys(CHANNEL_SHAPES).should.deepEqual(Object.values(EVENT_TYPES));
  });

  describe('assertContract — la aserción de tres (cuatro) partes', () => {
    it('lanza nombrando el type cuando el subject no coincide con eventSubject(type)', () => {
      const event = requirementEvent();
      (() => assertContract({
        subject: 'dev.events.v1.requirement.updated', payload: event,
      })).should.throw(/requirement\.created/);
    });

    it('lanza cuando version !== EVENTS_VERSION', () => {
      const event = requirementEvent({ version: 'v0' });
      (() => assertContract({
        subject: eventSubject(event.type), payload: event,
      })).should.throw(/version/);
    });

    it('lanza con el error de Ajv cuando el payload no cumple el schema', () => {
      const event = requirementEvent({ snapshot: requirementSnapshot({ createdAt: 'ayer' }) });
      (() => assertContract({
        subject: eventSubject(event.type), payload: event,
      })).should.throw(/no cumple el schema/);
    });

    it('lanza cuando CHANNEL_SHAPES espera "recipients" y el evento no lo trae', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const event: any = requirementEvent();
      delete event.recipients;
      (() => assertContract({
        subject: eventSubject(event.type), payload: event,
      })).should.throw(/recipients/);
    });

    it('lanza cuando CHANNEL_SHAPES espera "recipients" AUSENTE y el evento lo trae (tarea)', () => {
      const event = taskEvent({ recipients: { subscriptors: [], responsiblePersonIds: [] } });
      (() => assertContract({
        subject: eventSubject(event.type), payload: event,
      })).should.throw(/recipients/);
    });

    it('no lanza con un evento de requisito bien formado', () => {
      const event = requirementEvent();
      (() => assertContract({
        subject: eventSubject(event.type), payload: event,
      })).should.not.throw();
    });

    it('no lanza con un evento de tarea bien formado', () => {
      const event = taskEvent();
      (() => assertContract({
        subject: eventSubject(event.type), payload: event,
      })).should.not.throw();
    });
  });
});
