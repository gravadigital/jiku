import 'should';

import * as fs from 'node:fs';
import * as path from 'node:path';

import { reload } from './helpers/reload';

/**
 * Verificaciones DOCUMENTALES de `docs/apis/jiku-modules.yaml` (REQ-016 / S-077). Sin parser de
 * YAML (ADR-005): texto + regex. El contrato es la fuente de verdad; si discrepa del paquete, el
 * bug es del paquete.
 */
const JIKU_MODULES_YAML = path.join(__dirname, '../../../docs/apis/jiku-modules.yaml');

describe('nats-protocol · docs/apis/jiku-modules.yaml — paridad con el paquete', () => {
  const text = fs.readFileSync(JIKU_MODULES_YAML, 'utf8');
  const p = reload({});

  it('TS-205: el nombre del bucket coincide con MODULES_BUCKET', () => {
    text.should.containEql('Bucket KV de JetStream `' + p.MODULES_BUCKET + '`');
    text.should.containEql('`KV_' + p.MODULES_BUCKET + '`');
  });

  it('TS-206: los cuatro campos requeridos de ModuleRecord', () => {
    text.should.containEql('required: [module, serviceName, protocol, registeredAt]');
  });

  it('TS-207: el patrón de serviceName está atado al comportamiento del paquete', () => {
    const m = /serviceName: \{ type: string, pattern: '([^']+)'/.exec(text);
    (m !== null).should.equal(true);
    (m as RegExpExecArray)[1].should.equal('^[a-z][a-z0-9-]{1,40}$');
    p.modulePingSubject('jiku-docs').should.equal('$SRV.PING.jiku-docs-queries');
    (() => p.modulePingSubject('jiku.docs')).should.throw();
  });
});
