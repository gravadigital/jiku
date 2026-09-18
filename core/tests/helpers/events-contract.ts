import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { DomainEvent, EVENT_TYPES, EventType, EVENTS_VERSION, eventSubject } from '@jiku/nats-protocol';
import { PublishedEvent } from './event-publisher';

/**
 * El validador del contrato de eventos (S-067, CA-4): la pieza que compara lo que `core` EMITE
 * contra lo que `docs/apis/core-events.yaml` DECLARA. Hasta esta story, nadie lo hacía — los
 * tests de S-064/065/066 asertan formas escritas a mano, y si el YAML y el código se separan,
 * esos tests siguen verdes.
 *
 * TODO ESTE ARCHIVO ES DE TEST: no lo importa nada de `core/src/` (verificable con un `grep`).
 *
 * Tres responsabilidades y ninguna más (D-2, D-3):
 *   1. Cargar el YAML y ADAPTARLO de AsyncAPI 2.6 Schema Object a JSON Schema draft-07.
 *   2. Compilarlo con Ajv y devolver un validador del sobre `DomainEvent`.
 *   3. Declarar `CHANNEL_SHAPES`: qué campos condicionales lleva cada uno de los 16 canales —
 *      el YAML NO lo codifica, porque los cuatro mensajes agrupan canales por FORMA, no por
 *      obligatoriedad de campo (ver el comentario de `CHANNEL_SHAPES` más abajo).
 */

const CONTRACT_PATH = path.join(__dirname, '../../../docs/apis/core-events.yaml');

/** La forma mínima del documento que este archivo necesita leer. */
interface EventsContractDocument {
  channels: Record<string, unknown>;
  components: {
    schemas: Record<string, unknown>;
    messages: Record<string, unknown>;
  };
}

let cachedContract: EventsContractDocument | undefined;

/**
 * Traduce, RECURSIVAMENTE y sobre TODO el árbol del documento, el `nullable: true` de AsyncAPI
 * 2.6 Schema Object a la unión con `null` que entiende JSON Schema draft-07 (D-2):
 *
 *   { type: 'string', nullable: true }                       -> { type: ['string', 'null'] }
 *   { type: 'string', nullable: true, enum: [a, b] }          -> { type: ['string','null'], enum: [a, b, null] }
 *
 * ES UN RECORRIDO GENÉRICO de todo objeto/array del árbol — no una lista de claves conocidas
 * (`properties`, `items`, `oneOf`...). Cualquier objeto anidado, sea cual sea la clave bajo la
 * que cuelga, pasa por acá, así que cubre `properties`, `items`, `oneOf`, `allOf` y `anyOf` sin
 * tener que nombrarlos uno por uno (AC-3 de la Task 2).
 *
 * LA MITAD QUE SE OLVIDA (D-2): con `enum` presente, traducir solo `type` no alcanza — draft-07
 * evalúa el `enum` aparte, y `null` no está en esa lista si no se agrega también ahí. Por eso el
 * `if (Array.isArray(node.enum))` es una segunda rama, no un detalle del primero.
 *
 * `delete node.nullable` al final: Ajv en modo estricto rechazaría `nullable` como keyword
 * desconocida si sobreviviera a la traducción.
 */
function toDraft07(node: unknown): unknown {
  if (Array.isArray(node)) {
    for (const item of node) {
      toDraft07(item);
    }
    return node;
  }
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      toDraft07(obj[key]);
    }
    if (obj.nullable === true) {
      obj.type = Array.isArray(obj.type) ? [...(obj.type as unknown[]), 'null'] : [obj.type, 'null'];
      if (Array.isArray(obj.enum)) {
        obj.enum = [...obj.enum, null];
      }
      delete obj.nullable;
    }
  }
  return node;
}

/**
 * Lee y adapta `docs/apis/core-events.yaml`. Cacheado: el archivo no cambia dentro de una corrida
 * de la suite.
 *
 * RUTA RELATIVA DESDE `__dirname`, no desde el cwd de quien invoca mocha — es lo que hace que
 * funcione igual en CI que en una máquina local. Si el archivo no está, el mensaje NOMBRA LA RUTA
 * ESPERADA en vez de dejar escapar un `ENOENT` pelado, que es el error que aparecería recién en
 * CI, donde el cwd es otro.
 */
export function loadEventsContract(): EventsContractDocument {
  if (cachedContract) {
    return cachedContract;
  }
  if (!fs.existsSync(CONTRACT_PATH)) {
    throw new Error(
      `No se encontró el contrato de eventos en la ruta esperada: ${CONTRACT_PATH}. ` +
        `¿Se movió docs/apis/core-events.yaml, o se está invocando mocha desde otro directorio?`
    );
  }
  const raw = yaml.load(fs.readFileSync(CONTRACT_PATH, 'utf-8')) as EventsContractDocument;
  toDraft07(raw);
  cachedContract = raw;
  return raw;
}

/**
 * El validador COMPILADO del sobre `DomainEvent`, compartido por los 16 tipos.
 *
 * UNA SOLA INSTANCIA PARA LOS 16: el schema compilado es siempre el mismo (`DomainEvent`, con su
 * `oneOf` de snapshot) — lo que distingue a un canal de otro no es el schema de Ajv, sino la fila
 * de `CHANNEL_SHAPES` que `assertContract()` aplica después. `validatorFor(type)` toma el `type`
 * igual, por si algún día el contrato declara un schema propio por canal.
 *
 * SE LE PASA EL DOCUMENTO ENTERO COMO SCHEMA RAÍZ, con `components` adentro: así los `$ref`
 * literales del YAML (`'#/components/schemas/X'`) resuelven contra la MISMA estructura sin
 * reescribirlos — es la alternativa "más simple y preferible" que señalan las Implementation
 * Notes de la Task 2, y funciona porque un JSON Pointer se resuelve contra la raíz del objeto que
 * se compila, no contra el documento original.
 *
 * `strict: false`: el documento es AsyncAPI 2.6, y trae `description`/`title` en `$ref` hermanos
 * que el modo estricto de Ajv 8 rechazaría en un schema de autor.
 */
let envelopeValidator: ValidateFunction | undefined;

function compiledEnvelopeValidator(): ValidateFunction {
  if (!envelopeValidator) {
    const contract = loadEventsContract();
    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
    envelopeValidator = ajv.compile({
      $ref: '#/components/schemas/DomainEvent',
      components: contract.components,
    });
  }
  return envelopeValidator;
}

/** Ver `compiledEnvelopeValidator`: el `type` es solo para la firma, hoy no cambia el validador. */
export function validatorFor(_type: EventType): ValidateFunction {
  return compiledEnvelopeValidator();
}

/** `'requerido'` si el canal SÍ lleva el campo; `'ausente'` si el canal NO lo lleva. */
export type FieldPresence = 'requerido' | 'ausente';

export interface ChannelShape {
  recipients: FieldPresence;
  comment: FieldPresence;
  visibilityLevel: FieldPresence;
  changes: FieldPresence;
  /**
   * La descripción del canal, CITADA VERBATIM de `docs/apis/core-events.yaml`. Va al lado de cada
   * fila para que la divergencia entre esta tabla escrita a mano y el contrato se vea leyendo
   * (AC-8 de la Task 2) — no hay forma automática de comparar las dos, así que la cercanía visual
   * es la única defensa.
   */
  description: string;
}

/**
 * Qué campos condicionales lleva cada uno de los 16 canales del catálogo (D-3).
 *
 * POR QUÉ ES UNA TABLA PROPIA Y NO ALGO DERIVABLE DEL YAML: los cuatro mensajes del contrato
 * (`RequirementEvent`, `RequirementCommentEvent`, `TaskEvent`, `TaskCommentEvent`) apuntan TODOS
 * al mismo `$ref DomainEvent`, donde `recipients`, `comment`, `changes` y `visibilityLevel` son
 * los cuatro opcionales del schema. Validar solo contra `DomainEvent` NO verifica que, por
 * ejemplo, un `requirement.created` lleve `recipients`: un evento sin ese bloque pasaría el
 * schema igual. Por eso la aserción de presencia/ausencia va acá, aparte.
 *
 * ES LA ÚNICA TRANSCRIPCIÓN A MANO DE ESTE ARCHIVO, y se declara como tal: la alternativa —
 * agregar 16 schemas por canal a `core-events.yaml`— sería modificar el contrato de S-062 para
 * que la verificación sea más cómoda, la misma inversión de autoridad que el encabezado de ese
 * documento prohíbe. Si el contrato cambia la forma de un canal, ESTA TABLA es el lugar a
 * revisar primero.
 *
 * `'changes'` en `'ausente'` significa que la CLAVE no está en el objeto — nunca que está
 * presente con valor `undefined`: la aserción de `assertContract()` es `'changes' in payload`,
 * no `payload.changes === undefined` (mismo patrón que S-063 fijó para `errorDetails` de
 * `failure()`).
 */
export const CHANNEL_SHAPES: Record<EventType, ChannelShape> = {
  [EVENT_TYPES.REQUIREMENT_CREATED]: {
    recipients: 'requerido', comment: 'ausente', visibilityLevel: 'ausente', changes: 'ausente',
    description: 'A requirement was created. Carries `recipients` (its subscriptors, always empty at creation).',
  },
  [EVENT_TYPES.REQUIREMENT_STATE_CHANGED]: {
    recipients: 'requerido', comment: 'ausente', visibilityLevel: 'ausente', changes: 'requerido',
    description: 'The requirement\'s `state` changed. Carries `changes` and `recipients`.',
  },
  [EVENT_TYPES.REQUIREMENT_UPDATED]: {
    recipients: 'requerido', comment: 'ausente', visibilityLevel: 'ausente', changes: 'requerido',
    description: 'One or more fields of the requirement changed (excluding a state transition, ' +
      'which is `requirement.state.changed`). Carries `changes` and `recipients`.',
  },
  [EVENT_TYPES.REQUIREMENT_COMMENT_CREATED]: {
    recipients: 'requerido', comment: 'requerido', visibilityLevel: 'requerido', changes: 'ausente',
    description: 'A comment was created on the requirement. Carries `comment` and `recipients`.',
  },
  [EVENT_TYPES.REQUIREMENT_COMMENT_EDITED]: {
    recipients: 'requerido', comment: 'requerido', visibilityLevel: 'requerido', changes: 'requerido',
    description: 'A comment on the requirement was edited. `changes` carries only ' +
      '`editedAt`/`editedBy` — there is no `from` of the text. Carries `comment` (the current, ' +
      'complete text) and `recipients`.',
  },
  [EVENT_TYPES.REQUIREMENT_SUBSCRIPTOR_ADDED]: {
    recipients: 'requerido', comment: 'ausente', visibilityLevel: 'ausente', changes: 'requerido',
    description: 'A subscriptor was added to the requirement. `recipients.subscriptors` already ' +
      'includes the new one.',
  },
  [EVENT_TYPES.REQUIREMENT_SUBSCRIPTOR_REMOVED]: {
    recipients: 'requerido', comment: 'ausente', visibilityLevel: 'ausente', changes: 'requerido',
    description: 'A subscriptor was removed from the requirement. `recipients.subscriptors` no ' +
      'longer includes the one who left.',
  },
  [EVENT_TYPES.REQUIREMENT_ASSIGNED]: {
    recipients: 'requerido', comment: 'ausente', visibilityLevel: 'ausente', changes: 'requerido',
    description: 'The requirement\'s `responsiblePersonIds` changed. Carries `changes` and `recipients`.',
  },
  [EVENT_TYPES.REQUIREMENT_RESOLVED]: {
    recipients: 'requerido', comment: 'ausente', visibilityLevel: 'ausente', changes: 'requerido',
    description: 'The requirement entered a resolved state. `changes` carries `resolutionType`, ' +
      '`resolutionConclusion` and `resolutionComment` — this is where those three fields become ' +
      'the fact, and they do NOT travel in `RequirementSnapshot`. Carries `recipients`.',
  },
  [EVENT_TYPES.REQUIREMENT_REOPENED]: {
    recipients: 'requerido', comment: 'ausente', visibilityLevel: 'ausente', changes: 'requerido',
    description: 'A previously resolved requirement was reopened. Carries `changes` and `recipients`.',
  },
  [EVENT_TYPES.TASK_CREATED]: {
    recipients: 'ausente', comment: 'ausente', visibilityLevel: 'ausente', changes: 'ausente',
    description: 'A task was created.',
  },
  [EVENT_TYPES.TASK_STATE_CHANGED]: {
    recipients: 'ausente', comment: 'ausente', visibilityLevel: 'ausente', changes: 'requerido',
    description: 'The task\'s `state` changed. Carries `changes`.',
  },
  [EVENT_TYPES.TASK_UPDATED]: {
    recipients: 'ausente', comment: 'ausente', visibilityLevel: 'ausente', changes: 'requerido',
    description: 'One or more fields of the task changed (excluding a state transition, which is ' +
      '`task.state.changed`). Carries `changes`.',
  },
  [EVENT_TYPES.TASK_COMMENT_CREATED]: {
    recipients: 'ausente', comment: 'requerido', visibilityLevel: 'requerido', changes: 'ausente',
    description: 'A comment was created on the task. Carries `comment`.',
  },
  [EVENT_TYPES.TASK_COMMENT_EDITED]: {
    recipients: 'ausente', comment: 'requerido', visibilityLevel: 'requerido', changes: 'requerido',
    description: 'A comment on the task was edited. `changes` carries only `editedAt`/`editedBy` ' +
      '— there is no `from` of the text. Carries `comment` (the current, complete text).',
  },
  [EVENT_TYPES.TASK_ASSIGNED]: {
    recipients: 'ausente', comment: 'ausente', visibilityLevel: 'ausente', changes: 'requerido',
    description: 'The task\'s `responsiblePersonIds` changed. Carries `changes`.',
  },
};

/** Verdadero si `field` es una CLAVE PROPIA de `payload` (independiente de su valor). */
function hasKey(payload: object, field: string): boolean {
  return field in payload;
}

function assertPresence(type: string, payload: object, field: string, expected: FieldPresence): void {
  const present = hasKey(payload, field);
  if (expected === 'requerido' && !present) {
    throw new Error(
      `[${type}] CHANNEL_SHAPES espera "${field}" presente (según el catálogo de core-events.yaml) ` +
        `y el evento publicado NO lo trae.`
    );
  }
  if (expected === 'ausente' && present) {
    throw new Error(
      `[${type}] CHANNEL_SHAPES espera "${field}" AUSENTE (según el catálogo de core-events.yaml) ` +
        `y el evento publicado SÍ lo trae.`
    );
  }
}

/**
 * La aserción de tres partes que TODO evento del catálogo tiene que pasar (CA-4): subject,
 * versión y payload completo contra `docs/apis/core-events.yaml`. Se corre en este orden, y cada
 * mensaje de error nombra el `type` — es lo que hace que un fallo diga QUÉ evento del catálogo no
 * cumplió, en vez de un `false` opaco.
 *
 *   (a) el subject es exactamente `eventSubject(payload.type)`
 *   (b) `payload.version === EVENTS_VERSION` (nunca un literal `'v1'`, D-4)
 *   (c) el payload valida contra el sobre `DomainEvent` (Ajv, con `additionalProperties: false`)
 *   (d) la fila de `CHANNEL_SHAPES` del `type` se cumple, en presencia Y en ausencia
 */
export function assertContract(published: PublishedEvent): void {
  const payload = published.payload as DomainEvent;
  const type = payload.type;

  const expectedSubject = eventSubject(type);
  if (published.subject !== expectedSubject) {
    throw new Error(
      `[${type}] el subject publicado ("${published.subject}") no es eventSubject(type) ` +
        `("${expectedSubject}")`
    );
  }

  if (payload.version !== EVENTS_VERSION) {
    throw new Error(
      `[${type}] version publicada ("${payload.version}") !== EVENTS_VERSION ("${EVENTS_VERSION}")`
    );
  }

  const validate = validatorFor(type);
  if (!validate(payload)) {
    const errors = (validate.errors || [])
      .map((e) => `${e.instancePath || '/'} ${e.message}`)
      .join('; ');
    throw new Error(`[${type}] no cumple el schema DomainEvent de core-events.yaml: ${errors}`);
  }

  const shape = CHANNEL_SHAPES[type];
  if (!shape) {
    throw new Error(`[${type}] no está declarado en CHANNEL_SHAPES (events-contract.ts)`);
  }
  assertPresence(type, payload, 'recipients', shape.recipients);
  assertPresence(type, payload, 'comment', shape.comment);
  assertPresence(type, payload, 'visibilityLevel', shape.visibilityLevel);
  assertPresence(type, payload, 'changes', shape.changes);
}
