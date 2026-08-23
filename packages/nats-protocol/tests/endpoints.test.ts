import 'should';

import { reload } from './helpers/reload';

/**
 * Los 20 patrones que registra `core/src/commands/index.ts`, con el par que micro necesita.
 *
 * La tabla es copia de `docs/apis/core.yaml` —el contrato—, NO un recálculo con las mismas
 * funciones que se están probando. Si se recalculara, el test pasaría con cualquier cambio a la
 * derivación, que es exactamente lo contrario de lo que se busca.
 */
const DERIVATION: Array<{ pattern: string; subject: string; name: string }> = [
  { pattern: 'clients.new', subject: 'clients.new', name: 'clients-new' },
  { pattern: 'clients.{id}.edit', subject: 'clients.*.edit', name: 'clients-edit' },
  { pattern: 'projects.new', subject: 'projects.new', name: 'projects-new' },
  { pattern: 'projects.{id}.edit', subject: 'projects.*.edit', name: 'projects-edit' },
  { pattern: 'tasks.new', subject: 'tasks.new', name: 'tasks-new' },
  { pattern: 'tasks.{id}.edit', subject: 'tasks.*.edit', name: 'tasks-edit' },
  { pattern: 'tasks.{id}.comment', subject: 'tasks.*.comment', name: 'tasks-comment' },
  { pattern: 'requirements.new', subject: 'requirements.new', name: 'requirements-new' },
  { pattern: 'requirements.{id}.edit', subject: 'requirements.*.edit', name: 'requirements-edit' },
  {
    pattern: 'requirements.{id}.resolve',
    subject: 'requirements.*.resolve',
    name: 'requirements-resolve',
  },
  {
    pattern: 'requirements.{id}.comment',
    subject: 'requirements.*.comment',
    name: 'requirements-comment',
  },
  {
    pattern: 'requirements.{id}.subscriptors.new',
    subject: 'requirements.*.subscriptors.new',
    name: 'requirements-subscriptors-new',
  },
  {
    pattern: 'requirements.{id}.subscriptors.{userId}.delete',
    subject: 'requirements.*.subscriptors.*.delete',
    name: 'requirements-subscriptors-delete',
  },
  {
    pattern: 'attachments.{id}.delete',
    subject: 'attachments.*.delete',
    name: 'attachments-delete',
  },
  {
    pattern: 'files.request-upload',
    subject: 'files.request-upload',
    name: 'files-request-upload',
  },
  {
    pattern: 'files.{fileId}.request-download',
    subject: 'files.*.request-download',
    name: 'files-request-download',
  },
  { pattern: 'worked-times.new', subject: 'worked-times.new', name: 'worked-times-new' },
  {
    pattern: 'worked-times.{id}.delete',
    subject: 'worked-times.*.delete',
    name: 'worked-times-delete',
  },
  { pattern: 'unworked-times.new', subject: 'unworked-times.new', name: 'unworked-times-new' },
  {
    pattern: 'unworked-times.{id}.delete',
    subject: 'unworked-times.*.delete',
    name: 'unworked-times-delete',
  },
];

const PATTERNS = DERIVATION.map((row) => row.pattern);

describe('nats-protocol · derivación de endpoints micro', () => {
  const p = reload({});

  describe('TS-22: endpointName() sobre los 20 patrones', () => {
    DERIVATION.forEach((row) => {
      it(`${row.pattern} -> ${row.name}`, () => {
        p.endpointName(row.pattern).should.equal(row.name);
      });
    });
  });

  describe('TS-23: endpointSubject() sobre los 20 patrones', () => {
    DERIVATION.forEach((row) => {
      it(`${row.pattern} -> ${row.subject}`, () => {
        p.endpointSubject(row.pattern).should.equal(row.subject);
      });
    });
  });

  it('TS-24: los 20 endpointSubject() son distintos entre sí', () => {
    new Set(PATTERNS.map((x) => p.endpointSubject(x))).size.should.equal(20);
  });

  it('TS-25: los 20 endpointName() son distintos entre sí', () => {
    // Micro indexa los endpoints por nombre: dos iguales se pisan.
    new Set(PATTERNS.map((x) => p.endpointName(x))).size.should.equal(20);
  });

  it('TS-26: todo endpointName() es un nombre válido para micro', () => {
    // Micro valida el nombre contra /^[-\w]+$/ (ADR-32 de NATS).
    PATTERNS.map((x) => p.endpointName(x))
      .every((n) => /^[-\w]+$/.test(n))
      .should.be.true();
  });

  it('TS-27: endpointName() elimina el param, no lo reemplaza', () => {
    // El bug silencioso: `requirements-id-subscriptors-userId-delete` es un nombre VÁLIDO para
    // micro, así que no falla en ningún lado — solo queda mal en `nats micro info`.
    p.endpointName('requirements.{id}.subscriptors.{userId}.delete').should.equal(
      'requirements-subscriptors-delete'
    );
  });

  it('TS-28: endpointSubject() reemplaza cada param por *', () => {
    p.endpointSubject('requirements.{id}.subscriptors.{userId}.delete').should.equal(
      'requirements.*.subscriptors.*.delete'
    );
  });

  it('TS-29: un segmento con guion interno se preserva', () => {
    [
      p.endpointName('files.request-upload'),
      p.endpointName('worked-times.{id}.delete'),
      p.endpointSubject('files.{fileId}.request-download'),
    ].should.eql(['files-request-upload', 'worked-times-delete', 'files.*.request-download']);
  });

  it('TS-30: un patrón sin params no gana ningún *', () => {
    [p.endpointSubject('clients.new'), p.endpointName('clients.new')].should.eql([
      'clients.new',
      'clients-new',
    ]);
  });

  it('TS-31: endpointName() / endpointSubject() son puros y no dependen del entorno', () => {
    reload({ NATS_INSTANCE: 'prod', NATS_COMMAND_SERVICE: 'x' })
      .endpointSubject('tasks.{id}.edit')
      .should.equal('tasks.*.edit');
  });

  it('TS-55: endpointName() sobre un patrón de un solo segmento', () => {
    p.endpointName('health').should.equal('health');
  });

  it('TS-56: endpointSubject() sobre un patrón que es solo un param', () => {
    p.endpointSubject('{id}').should.equal('*');
  });
});

describe('nats-protocol · methodFromSubject', () => {
  const p = reload({});

  it('TS-32: methodFromSubject() sobre un subject de comandos', () => {
    p.methodFromSubject('dev.323332022539911171.jiku-commands.v1.clients.new').should.equal(
      'clients.new'
    );
  });

  it('TS-33: methodFromSubject() conserva los ids del método', () => {
    p.methodFromSubject(
      'dev.u1.jiku-commands.v1.requirements.3.subscriptors.abc-def.delete'
    ).should.equal('requirements.3.subscriptors.abc-def.delete');
  });

  it('TS-34: methodFromSubject() sirve igual a las consultas', () => {
    // El quinto segmento ya no es siempre un comando: es un método. De ahí el rename.
    p.methodFromSubject('dev.u1.jiku-queries.v1.tasks.list').should.equal('tasks.list');
  });

  it('TS-35: commandFromSubject es el mismo símbolo que methodFromSubject', () => {
    // Identidad de referencia, no dos funciones equivalentes: dos implementaciones podrían
    // divergir, y el despachador de core sigue llamando al nombre viejo.
    (p.commandFromSubject === p.methodFromSubject).should.be.true();
  });

  it('TS-36: ida y vuelta commandSubject() -> methodFromSubject() sobre los 20 patrones', () => {
    // Es lo que garantiza que `core/src/bus/dispatcher.ts` siga resolviendo sin tocarse.
    const methods = PATTERNS.map((pattern) =>
      pattern
        .split('.')
        .map((segment) => (segment.startsWith('{') && segment.endsWith('}') ? '7' : segment))
        .join('.')
    );
    methods.forEach((method) => {
      p.methodFromSubject(p.commandSubject(method, 'u1')).should.equal(method);
    });
    methods.length.should.equal(20);
  });

  it('TS-37: ida y vuelta también para consultas', () => {
    p.methodFromSubject(p.querySubject('tasks.list', 'u1')).should.equal('tasks.list');
  });
});
