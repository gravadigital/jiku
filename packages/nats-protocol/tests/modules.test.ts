import 'should';

import type { ModuleRecord } from '../src/index';
import { reload } from './helpers/reload';

const BAD_NAMES = [
  'jiku.docs',
  'jiku-docs.>',
  '*',
  '>',
  '',
  'Jiku-docs',
  '1docs',
  '-docs',
  'jiku_docs',
  'jiku docs',
  'a',
  'a' + 'b'.repeat(41),
];

describe('nats-protocol · registro de módulos y subjects por serviceName (REQ-016 / S-077)', () => {
  const p = reload({});

  it('TS-185: MODULES_BUCKET es el nombre del bucket, no del stream', () => {
    reload({}).MODULES_BUCKET.should.equal('JIKU_MODULES');
  });

  it('TS-186: ModuleRecord acepta el ejemplo del contrato y es solo tipo', () => {
    const r: ModuleRecord = {
      module: 'docs',
      serviceName: 'jiku-docs',
      protocol: 'v1',
      registeredAt: '2026-10-24T12:00:00.000Z',
    };
    r.serviceName.should.equal('jiku-docs');
    Object.keys(reload({})).should.not.containEql('ModuleRecord');
  });

  it('TS-187: consulta de módulo con el serviceName real', () => {
    reload({})
      .moduleQuerySubject('jiku-docs', 'v1', 'documents.list', '323332022539911171')
      .should.equal('dev.323332022539911171.jiku-docs-queries.v1.documents.list');
  });

  it('TS-188: el nombre del servicio sale del registro', () => {
    reload({})
      .moduleQuerySubject('otro-docs', 'v1', 'documents.list', 'u1')
      .should.equal('dev.u1.otro-docs-queries.v1.documents.list');
  });

  it('TS-189: comando de módulo', () => {
    reload({})
      .moduleCommandSubject('jiku-docs', 'v1', 'documents.new', '323332022539911171')
      .should.equal('dev.323332022539911171.jiku-docs-commands.v1.documents.new');
  });

  it('TS-190: {version} es el protocol del módulo y {svc} no es COMMAND_SERVICE/QUERY_SERVICE', () => {
    const q = reload({
      NATS_PROTOCOL_VERSION: 'v9',
      NATS_COMMAND_SERVICE: 'x-commands',
      NATS_QUERY_SERVICE: 'x-queries',
    });
    q.moduleQuerySubject('jiku-docs', 'v1', 'documents.list', 'u1').should.equal(
      'dev.u1.jiku-docs-queries.v1.documents.list'
    );
    q.moduleCommandSubject('jiku-docs', 'v2', 'documents.new', 'u1').should.equal(
      'dev.u1.jiku-docs-commands.v2.documents.new'
    );
  });

  it('TS-191: INSTANCE entra y cada parámetro va a su token', () => {
    reload({ NATS_INSTANCE: 'prod' })
      .moduleQuerySubject('svc-a', 'v3', 'm.x', 'user-7')
      .should.equal('prod.user-7.svc-a-queries.v3.m.x');
  });

  it('TS-192: ping al servicio de consultas del módulo', () => {
    const q = reload({});
    q.modulePingSubject('jiku-docs').should.equal('$SRV.PING.jiku-docs-queries');
    q.modulePingSubject('otro-docs').should.equal('$SRV.PING.otro-docs-queries');
  });

  it('TS-193: el ping no lleva instancia', () => {
    reload({ NATS_INSTANCE: 'prod' })
      .modulePingSubject('jiku-docs')
      .should.equal('$SRV.PING.jiku-docs-queries');
  });

  it('TS-194: serviceName inválido, los tres helpers lanzan', () => {
    for (const bad of BAD_NAMES) {
      const re = new RegExp('serviceName de módulo inválido: ' + JSON.stringify(bad).replace(/[.*+?^${}()|[\]\\>]/g, '\\$&'));
      (() => p.moduleQuerySubject(bad, 'v1', 'documents.list', 'u1')).should.throw(re);
      (() => p.moduleCommandSubject(bad, 'v1', 'documents.new', 'u1')).should.throw(re);
      (() => p.modulePingSubject(bad)).should.throw(re);
    }
  });

  it('TS-195: bordes válidos del patrón', () => {
    p.modulePingSubject('ab').should.equal('$SRV.PING.ab-queries');
    p.modulePingSubject('a' + 'b'.repeat(40)).should.equal(
      '$SRV.PING.a' + 'b'.repeat(40) + '-queries'
    );
    p.moduleQuerySubject('a1-b', 'v1', 'x', 'u1').should.equal('dev.u1.a1-b-queries.v1.x');
  });

  it('TS-196: la validación ocurre antes de armar el subject', () => {
    (() => p.moduleCommandSubject('jiku-docs.v1.documents', 'v1', 'delete', 'u1')).should.throw();
  });

  it('TS-197: los helpers existentes leen un subject de módulo', () => {
    p.methodFromSubject('dev.u1.jiku-docs-queries.v1.documents.list').should.equal('documents.list');
    p.callerFromSubject('dev.u1.jiku-docs-queries.v1.documents.list').should.equal('u1');
  });
});
