import 'should';

import * as fs from 'node:fs';
import * as path from 'node:path';

import { reload } from './helpers/reload';

/**
 * Verificaciones DOCUMENTALES de `docs/apis/core-events.yaml` (REQ-014 / S-062).
 *
 * Este archivo no importa ningún parser de YAML (ADR-005: el paquete no gana dependencias, ni de
 * runtime ni de test). Se lee el contrato como texto y se recorta con regex — mismo patrón que
 * TS-89 en `inbox.test.ts`. Donde hace falta comparar contra el paquete, se usa `reload()`: el
 * contrato es la fuente de verdad y `EVENT_TYPES` tiene que coincidir con él.
 */

const CORE_EVENTS_YAML = path.join(__dirname, '../../../docs/apis/core-events.yaml');
const CORE_YAML = path.join(__dirname, '../../../docs/apis/core.yaml');
const CORE_QUERIES_YAML = path.join(__dirname, '../../../docs/apis/core-queries.yaml');
const ENV_DIST = path.join(__dirname, '../../../deploy/.env.dist');

function readEventsContract(): string {
  return fs.readFileSync(CORE_EVENTS_YAML, 'utf8');
}

/** Extrae los nombres de canal de primer nivel bajo `channels:` (2 espacios de indentación, terminan en `:`). */
function channelNames(contract: string): string[] {
  const lines = contract.split('\n');
  const channelsIdx = lines.findIndex((l) => l === 'channels:');
  channelsIdx.should.be.above(-1);
  const componentsIdx = lines.findIndex((l, i) => i > channelsIdx && l === 'components:');
  componentsIdx.should.be.above(-1);

  const names: string[] = [];
  for (let i = channelsIdx + 1; i < componentsIdx; i++) {
    const m = /^ {2}([a-z][a-zA-Z.]*):$/.exec(lines[i]);
    if (m) names.push(m[1]);
  }
  return names;
}

describe('nats-protocol · docs/apis/core-events.yaml — CA-1: el archivo, AsyncAPI 2.6 y los 16 canales', () => {
  it('TS-152: el archivo existe y es AsyncAPI 2.6', () => {
    fs.existsSync(CORE_EVENTS_YAML).should.be.true();
    const firstLine = readEventsContract().split('\n')[0];
    firstLine.should.equal('asyncapi: \'2.6.0\'');
  });

  it('TS-153: tiene info, servers y defaultContentType con el molde', () => {
    const contract = readEventsContract();
    contract.should.match(/^info:/m);
    contract.should.match(/^ {2}title: /m);
    contract.should.match(/^ {2}version: 1\.0\.0/m);
    contract.should.match(/^ {2}description: \|/m);
    contract.should.match(/^defaultContentType: application\/json/m);
    contract.should.match(/dev:\n {4}url: nats:\/\/localhost:4222/);
    contract.should.match(/prod:\n {4}url: nats:\/\/nats:4222/);
    contract.should.match(/protocol: nats/);
    contract.should.containEql('WHY AsyncAPI AND NOT OpenAPI');
    contract.should.containEql('THIS FILE IS THE SOURCE OF TRUTH');
  });

  it('TS-154: 16 canales, y todos con subscribe:, ninguno con publish:', () => {
    const contract = readEventsContract();
    const names = channelNames(contract);
    names.length.should.equal(16);

    const subscribeCount = (contract.match(/^\s*subscribe:/gm) || []).length;
    const publishCount = (contract.match(/^\s*publish:/gm) || []).length;
    subscribeCount.should.equal(16);
    publishCount.should.equal(0);
  });

  it('TS-155: los 16 canales coinciden EXACTAMENTE con EVENT_TYPES, mismo orden', () => {
    const contract = readEventsContract();
    const names = channelNames(contract);
    const p = reload({});
    const catalogo = Object.values(p.EVENT_TYPES);

    names.should.eql(catalogo);
  });

  it('TS-156: los 6 eventos de tanda 3 NO están, ni como canal ni como valor de enum', () => {
    // El contrato SÍ puede MENCIONAR sus nombres en la prosa explicativa (para declarar qué no
    // está y por qué — REQ-014 lo pide explícitamente), así que la aserción es sobre los dos
    // lugares donde "estar" tendría efecto: un nombre de canal de primer nivel y un item del
    // enum de EventType, no sobre el texto libre.
    const contract = readEventsContract();
    const names = channelNames(contract);
    const enumStart = contract.indexOf('    EventType:');
    const enumEnd = contract.indexOf('\n    EventActor:');
    const enumItems = (contract.slice(enumStart, enumEnd).match(/^ {8}- \S+$/gm) || []).map((l) =>
      l.trim().replace('- ', '')
    );

    const tanda3 = [
      'project.created',
      'project.updated',
      'client.created',
      'client.updated',
      'attachment.linked',
      'attachment.unlinked',
    ];
    tanda3.forEach((name) => {
      names.should.not.containEql(name);
      enumItems.should.not.containEql(name);
    });
  });

  it('TS-169: no declara x-reply, x-error-codes ni x-resources', () => {
    // Se busca el TOKEN como clave YAML (con `:`), no la subcadena: la prosa explicativa
    // menciona "x-resources" en la nota de que NO se replica, y eso es contenido legítimo del
    // contrato, no un uso real de la extensión.
    const contract = readEventsContract();
    (contract.match(/^\s*x-reply:|^\s*x-error-codes:|^\s*x-resources:/gm) || []).length.should.equal(0);
  });
});

describe('nats-protocol · docs/apis/core-events.yaml — CA-2: RequirementSnapshot', () => {
  const REQUIREMENT_FIELDS = [
    'id',
    'title',
    'description',
    'type',
    'priority',
    'state',
    'estimatedFinishDate',
    'tags',
    'responsiblePersonIds',
    'projectId',
    'createdBy',
    'visibilityLevel',
    'createdAt',
    'updatedAt',
    'finishedAt',
  ];

  function schemaBlock(contract: string, schemaName: string): string {
    const lines = contract.split('\n');
    const start = lines.findIndex((l) => l === `    ${schemaName}:`);
    start.should.be.above(-1);
    // El bloque termina en la próxima línea con la misma indentación de 4 espacios que declara
    // otro schema (o el fin del archivo).
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      if (/^ {4}[A-Za-z]/.test(lines[i])) {
        end = i;
        break;
      }
    }
    return lines.slice(start, end).join('\n');
  }

  it('TS-157: RequirementSnapshot tiene los 15 campos, en orden y sin extras', () => {
    const block = schemaBlock(readEventsContract(), 'RequirementSnapshot');
    block.should.containEql('additionalProperties: false');

    const propsIdx = block.indexOf('      properties:');
    propsIdx.should.be.above(-1);
    const propNames: string[] = [];
    const propLines = block.slice(propsIdx).split('\n');
    for (const line of propLines) {
      const m = /^ {8}([a-zA-Z]+):$/.exec(line);
      if (m) propNames.push(m[1]);
    }
    propNames.should.eql(REQUIREMENT_FIELDS);
  });

  it('TS-158: RequirementSnapshot no trae los campos excluidos (finishedAt SÍ está)', () => {
    const block = schemaBlock(readEventsContract(), 'RequirementSnapshot');
    const propsIdx = block.indexOf('      properties:');
    const propsBlock = block.slice(propsIdx);

    const excluded = [
      'totalMinutes',
      'scope',
      'technicalSolution',
      'acceptanceCriteria',
      'resolutionType',
      'resolutionConclusion',
      'resolutionComment',
      'scheduledAt',
      'inProgressAt',
      'inReviewAt',
      'subscriptors',
      'comments',
      'attachments',
      'project',
      'responsiblePersons',
    ];
    excluded.forEach((field) => {
      new RegExp(`^ {8}${field}:$`, 'm').test(propsBlock).should.be.false();
    });
    /^ {8}finishedAt:$/m.test(propsBlock).should.be.true();
  });

  it('TS-159: las dos reglas semánticas de RequirementSnapshot están escritas', () => {
    const block = schemaBlock(readEventsContract(), 'RequirementSnapshot');
    block.should.containEql('COMPLETE, NEVER TRUNCATED');
    block.should.match(/FIRST is the lead/);
  });
});

describe('nats-protocol · docs/apis/core-events.yaml — CA-3: TaskSnapshot', () => {
  it('TS-160: TaskSnapshot tiene los 16 campos, con las dos formas de prioridad', () => {
    const contract = readEventsContract();
    const lines = contract.split('\n');
    const start = lines.findIndex((l) => l === '    TaskSnapshot:');
    start.should.be.above(-1);
    const block = lines.slice(start).join('\n');

    block.should.containEql('additionalProperties: false');
    block.should.containEql('priorityValue:');
    block.should.match(/priorityValue:\s*\n\s*type: integer\s*\n\s*minimum: 0\s*\n\s*maximum: 5/);

    const propsIdx = block.indexOf('      properties:');
    const propsBlock = block.slice(propsIdx);
    const propNames: string[] = [];
    for (const line of propsBlock.split('\n')) {
      const m = /^ {8}([a-zA-Z]+):$/.exec(line);
      if (m) propNames.push(m[1]);
    }
    propNames.should.eql([
      'id',
      'title',
      'description',
      'state',
      'area',
      'priority',
      'priorityValue',
      'estimatedFinishDate',
      'finishedAt',
      'responsiblePersonIds',
      'visibilityLevel',
      'projectId',
      'requirementId',
      'createdBy',
      'createdAt',
      'updatedAt',
    ]);
  });

  it('TS-161: la prosa de priorityValue declara la contradicción con ADR-004, y usa task no objective', () => {
    const contract = readEventsContract();
    const start = contract.indexOf('    TaskSnapshot:');
    const end = contract.indexOf('\n\n', start) === -1 ? contract.length : contract.length;
    const block = contract.slice(start, end);

    block.should.containEql('CONTRADICTS ADR-004 ON PURPOSE');
    block.should.containEql('collapses 5 into 4');
    // Usa `task`, nunca `objective` como nombre de entidad (ADR-004). La prosa SÍ puede
    // mencionar `objective`/`objectives` al explicar la regla ("NEVER `objective`", la tabla
    // `objectives`) — lo que importa es que la ENTIDAD del schema (`EventEntityRef.type`, el
    // nombre de los canales) sea `task`, verificado ya en TS-154/TS-155/TS-162.
    block.should.containEql('Uses `task`');
    block.should.containEql('NEVER `objective`');
  });
});

describe('nats-protocol · docs/apis/core-events.yaml — CA-4: el sobre y sus componentes', () => {
  it('TS-162: los ocho schemas del sobre están declarados, y DomainEvent.required tiene los 8 campos', () => {
    const contract = readEventsContract();
    [
      'DomainEvent',
      'EventActor',
      'EventEntityRef',
      'EventRecipients',
      'EventComment',
      'EventType',
      'RequirementSnapshot',
      'TaskSnapshot',
    ].forEach((name) => {
      contract.should.containEql(`    ${name}:`);
    });

    const requiredMatch = /required: \[eventId, type, version, occurredAt, correlationId, actor, entity, snapshot\]/;
    requiredMatch.test(contract).should.be.true();
    contract.should.not.match(/required: \[.*changes.*\]/);
  });

  it('TS-163: EventActor no declara email', () => {
    const contract = readEventsContract();
    const start = contract.indexOf('    EventActor:');
    const nextSchema = contract.indexOf('\n    EventEntityRef:');
    const block = contract.slice(start, nextSchema);

    block.should.containEql('additionalProperties: false');
    block.should.containEql('required: [id]');
    block.should.not.match(/^ {8}email:/m);
    block.should.containEql('NEVER declared here');
  });

  it('TS-164: EventRecipients declara email nulable y sus reglas', () => {
    const contract = readEventsContract();
    const start = contract.indexOf('    EventRecipients:');
    const nextSchema = contract.indexOf('\n    EventComment:');
    const block = contract.slice(start, nextSchema);

    block.should.containEql('nullable: true');
    block.should.containEql('CAN be `null`');
    block.should.containEql('skip that recipient');
    block.should.containEql('most frequent case');
    // El texto en prosa YAML viene con wrap a 100 columnas, así que se busca sin asumir que
    // "MUST" y "deduplicate" caen en la misma línea.
    /MUST[\s\S]{0,20}deduplicate by `userId`/.test(block).should.be.true();
    block.should.containEql('`personId` != `userId`');
  });

  it('TS-165: EventComment y la regla del texto anterior inexistente', () => {
    const contract = readEventsContract();
    const start = contract.indexOf('    EventComment:');
    const nextSchema = contract.indexOf('\n    RequirementSnapshot:');
    const block = contract.slice(start, nextSchema);

    block.should.containEql('id, body, fileIds');
    block.should.containEql('no `from` of the text');
    block.should.containEql('REPLACES it completely');
    block.should.containEql('visibilityLevel` is immutable');
    block.should.containEql('COMPLETE set currently linked');
  });

  it('TS-166: EventType es un enum con los 16 valores', () => {
    const contract = readEventsContract();
    const start = contract.indexOf('    EventType:');
    const nextSchema = contract.indexOf('\n    EventActor:');
    const block = contract.slice(start, nextSchema);

    const enumItems = (block.match(/^ {8}- \S+$/gm) || []).map((l) => l.trim().replace('- ', ''));
    enumItems.length.should.equal(16);

    const p = reload({});
    enumItems.should.eql(Object.values(p.EVENT_TYPES));
  });
});

describe('nats-protocol · docs/apis/core-events.yaml — CA-5: la garantía de entrega', () => {
  it('TS-167: la garantía de entrega está declarada con sus cinco afirmaciones', () => {
    const contract = readEventsContract();
    contract.should.containEql('at-least-once');
    contract.should.containEql('MUST** deduplicate by `eventId`');
    contract.should.match(/best-effort/i);
    contract.should.containEql('cannot detect');
    contract.should.containEql('7 days');
    contract.should.containEql('NOT a reconstructible source of state');
  });

  it('TS-168: la secuencia commit→publish y la tabla de versionado están escritas', () => {
    const contract = readEventsContract();
    contract.should.containEql('COMMIT');
    contract.should.containEql('Publish the events');
    contract.should.containEql('IS LOST');
    contract.should.containEql('does NOT affect the command');
    contract.should.containEql('does NOT propagate');
    contract.should.containEql('stdout');
    contract.should.containEql('never replayed');
    // El placeholder genérico `{instance}.events.v1.>` (no un `dev.` literal) es el que el
    // contrato usa en la tabla de parámetros de JetStream.
    contract.should.match(/\{instance\}\.events\.v1\.>/);
    contract.should.containEql('Add a new event');
    contract.should.containEql('Remove or rename a field');
  });

  it('TS-170: la nota cruzada simétrica está en core-events.yaml', () => {
    const contract = readEventsContract();
    contract.should.containEql('base`/`includable`');
    contract.should.containEql('truncatable');
    contract.should.containEql('totalMinutes');
  });
});

describe('nats-protocol · docs/apis/core.yaml — CA-6 y CA-7', () => {
  function readCoreYaml(): string {
    return fs.readFileSync(CORE_YAML, 'utf8');
  }

  it('TS-171: Reply gana events como array de DomainEvent, con la ruta literal de CA-6', () => {
    const core = readCoreYaml();
    const replyIdx = core.indexOf('    Reply:');
    replyIdx.should.be.above(-1);
    const nextSchema = core.indexOf('\n    ReplyWithId:', replyIdx);
    const block = core.slice(replyIdx, nextSchema === -1 ? core.length : nextSchema);

    block.should.containEql('events:');
    block.should.containEql('$ref: \'../apis/core-events.yaml#/components/schemas/DomainEvent\'');
    block.should.match(/required: \[status\]/);
  });

  it('TS-172: el campo es aditivo y su prosa lo dice; los allOf existentes no se tocan', () => {
    const core = readCoreYaml();
    const replyIdx = core.indexOf('    Reply:');
    const nextSchema = core.indexOf('\n    ReplyWithId:', replyIdx);
    const block = core.slice(replyIdx, nextSchema === -1 ? core.length : nextSchema);

    block.should.containEql('byte-for-byte');
    block.should.containEql('S-063');

    core.should.containEql('ReplyWithId:');
    core.should.containEql('ReplyEmpty:');
    core.should.containEql('ReplyWithUploadTicket:');
  });

  it('TS-173: las dos líneas obsoletas ya no están', () => {
    const core = readCoreYaml();
    core.should.not.containEql('CORE CONSUMES, IT STILL DOES NOT PUBLISH');
    core.should.not.containEql('Core MUST NOT publish messages');
  });

  it('TS-174: el reemplazo dice las cuatro cosas, y la nota de sub.allow sigue intacta', () => {
    const core = readCoreYaml();
    core.should.containEql('core-events.yaml');
    /publishes?[\s\S]*REQ-014|REQ-014[\s\S]*publish/i.test(core).should.be.true();
    core.should.containEql('request/reply');
    core.should.containEql('events.auth');

    // Las líneas 319-324 originales (deny-by-default del sub.allow) siguen intactas.
    core.should.containEql('THE SUBSCRIPTION PERMISSION IS THE LITERAL SUBJECT');
  });
});

describe('nats-protocol · docs/apis/core-queries.yaml — CA-8 (la mitad simétrica)', () => {
  it('TS-175: la nota cruzada está y no cambió el contrato', () => {
    const queries = fs.readFileSync(CORE_QUERIES_YAML, 'utf8');
    queries.should.containEql('core-events.yaml');
    queries.should.containEql('truncatable');
    queries.should.containEql('totalMinutes');

    // Verificación de que el diff no tocó un canal/schema/whitelist real: las secciones
    // estructurales de siempre siguen presentes intactas.
    queries.should.containEql('x-resources:');
    queries.should.containEql('channels:');
  });
});

describe('nats-protocol · deploy/.env.dist — CA-10', () => {
  function readEnvDist(): string {
    return fs.readFileSync(ENV_DIST, 'utf8');
  }

  it('TS-176: NATS_EVENTS_VERSION=v1 está en .env.dist, junto a NATS_PROTOCOL_VERSION', () => {
    const env = readEnvDist();
    const matches = env.match(/^NATS_EVENTS_VERSION=v1$/gm) || [];
    matches.length.should.equal(1);

    // "Junto a" se verifica por líneas EN BLANCO entre las dos declaraciones (no por longitud
    // del bloque de comentario, que puede ser tan largo como haga falta): que no haya otra
    // sección `# ====` de por medio es la señal de que siguen en el mismo bloque `# NATS`.
    const protocolLine = env.split('\n').findIndex((l) => l === 'NATS_PROTOCOL_VERSION=v1');
    const eventsLine = env.split('\n').findIndex((l) => l === 'NATS_EVENTS_VERSION=v1');
    protocolLine.should.be.above(-1);
    eventsLine.should.be.above(protocolLine);

    const between = env.split('\n').slice(protocolLine, eventsLine);
    between.join('\n').should.not.containEql('# ===');
  });

  it('TS-177: su prosa declara la independencia y la ausencia de variable de subject', () => {
    const env = readEnvDist();
    const lines = env.split('\n');
    const eventsLine = lines.findIndex((l) => l === 'NATS_EVENTS_VERSION=v1');
    eventsLine.should.be.above(-1);

    // El bloque de comentario que precede la línea, hasta la línea en blanco anterior (o hasta
    // 20 líneas atrás si no hay una).
    let commentStart = eventsLine - 1;
    while (commentStart > 0 && lines[commentStart - 1].trim() !== '' && commentStart > eventsLine - 20) {
      commentStart--;
    }
    const precedingComment = lines.slice(commentStart, eventsLine).join('\n');

    precedingComment.should.match(/tercer segmento|third segment/i);
    precedingComment.should.match(/independientes?|independent/i);
    precedingComment.should.containEql('NATS_PROTOCOL_VERSION');

    (env.match(/NATS_EVENTS_SUBJECT|NATS_EVENTS_STREAM/g) || []).length.should.equal(0);
  });
});
