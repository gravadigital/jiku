import 'mocha';
import 'should';
import sinon from 'sinon';
import logger from '../../lib/logger';
import { docsModule, listModules } from '../../lib/modules/registry';
import { fakeBus } from '../mocks/bus';

const REC = { module: 'docs', serviceName: 'jiku-docs', protocol: 'v1', registeredAt: '2026-10-24T12:00:00.000Z' };

describe('S-077 · registro de módulos', () => {
  let clock: sinon.SinonFakeTimers | null = null;
  let errorStub: sinon.SinonStub;
  let infoStub: sinon.SinonStub;

  function fakeTimers() {
    clock = sinon.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  }

  async function available() {
    await fakeBus.kvPut('docs', REC);
    fakeBus.pingResponds('jiku-docs', true);
    await docsModule.start();
  }

  beforeEach(() => {
    errorStub = sinon.stub(logger, 'error');
    infoStub = sinon.stub(logger, 'info');
  });

  afterEach(() => {
    docsModule.stop();
    clock?.restore();
    clock = null;
    errorStub.restore();
    infoStub.restore();
    delete process.env.JIKU_PUBLIC_URL;
  });

  it('S-077 · TS-1: sin clave docs queda not_installed', async () => {
    await docsModule.start();
    docsModule.status().should.equal('not_installed');
    (docsModule.record() === null).should.be.true();
    fakeBus.pings.should.deepEqual([]);
  });

  it('S-077 · TS-2: clave v1 y el servicio responde el ping', async () => {
    await available();
    docsModule.status().should.equal('available');
    docsModule.record()!.should.deepEqual({ serviceName: 'jiku-docs', protocol: 'v1' });
    fakeBus.pings.should.deepEqual(['jiku-docs']);
  });

  it('S-077 · TS-3: clave v1 y nadie responde el ping', async () => {
    await fakeBus.kvPut('docs', REC);
    await docsModule.start();
    docsModule.status().should.equal('unavailable');
    docsModule.record()!.should.deepEqual({ serviceName: 'jiku-docs', protocol: 'v1' });
    fakeBus.pings.should.deepEqual(['jiku-docs']);
  });

  it('S-077 · TS-4: protocolo no soportado', async () => {
    await fakeBus.kvPut('docs', { ...REC, protocol: 'v2' });
    fakeBus.pingResponds('jiku-docs', true);
    await docsModule.start();
    docsModule.status().should.equal('incompatible');
    (docsModule.record() === null).should.be.true();
    errorStub.calledWith('[modules] docs: protocolo v2 no soportado (soportado: v1)').should.be.true();
    fakeBus.pings.should.deepEqual([]);
  });

  it('S-077 · TS-5: JSON inválido', async () => {
    await fakeBus.kvPut('docs', '{no-json');
    await docsModule.start();
    docsModule.status().should.equal('incompatible');
    errorStub.args.some((a) => /^\[modules\] docs: registro inválido/.test(a[0])).should.be.true();
    fakeBus.pings.should.deepEqual([]);
    fakeBus.kvWatcherCount.should.equal(1);
  });

  describe('S-077 · TS-6: registro que viola el contrato', () => {
    const cases: Array<[string, any]> = [
      ['serviceName undefined', { ...REC, serviceName: undefined }],
      ['serviceName con punto', { ...REC, serviceName: 'jiku.docs' }],
      ['serviceName con wildcard', { ...REC, serviceName: 'jiku-docs.>' }],
      ['protocol mal formado', { ...REC, protocol: 'version1' }],
      ['module distinto', { ...REC, module: 'otro' }],
      ['registeredAt numérico', { ...REC, registeredAt: 12 }],
    ];
    cases.forEach(([name, value]) => {
      it(`S-077 · TS-6: ${name}`, async () => {
        await fakeBus.kvPut('docs', value);
        fakeBus.pingResponds('jiku-docs', true);
        await docsModule.start();
        docsModule.status().should.equal('incompatible');
        fakeBus.pings.should.deepEqual([]);
        errorStub.args.some((a) => /registro inválido/.test(a[0])).should.be.true();
      });
    });
  });

  it('S-077 · TS-7: campos extra se toleran', async () => {
    await fakeBus.kvPut('docs', { ...REC, extra: 'x' });
    fakeBus.pingResponds('jiku-docs', true);
    await docsModule.start();
    docsModule.status().should.equal('available');
  });

  it('S-077 · TS-8: borrado en caliente', async () => {
    await available();
    await fakeBus.kvDelete('docs');
    docsModule.status().should.equal('not_installed');
    (docsModule.record() === null).should.be.true();
  });

  it('S-077 · TS-8: purga en caliente', async () => {
    await available();
    await fakeBus.kvPurge('docs');
    docsModule.status().should.equal('not_installed');
    (docsModule.record() === null).should.be.true();
  });

  it('S-077 · TS-9: alta en caliente', async () => {
    await docsModule.start();
    docsModule.status().should.equal('not_installed');
    fakeBus.pingResponds('jiku-docs', true);
    await fakeBus.kvPut('docs', REC);
    docsModule.status().should.equal('available');
  });

  it('S-077 · TS-10: cambio a protocolo incompatible en caliente', async () => {
    await available();
    await fakeBus.kvPut('docs', { ...REC, protocol: 'v2' });
    docsModule.status().should.equal('incompatible');
    errorStub.calledWith('[modules] docs: protocolo v2 no soportado (soportado: v1)').should.be.true();
  });

  it('S-077 · TS-11: recuperación en ≤ 30 s', async () => {
    fakeTimers();
    await fakeBus.kvPut('docs', REC);
    await docsModule.start();
    docsModule.status().should.equal('unavailable');
    fakeBus.pingResponds('jiku-docs', true);
    await clock!.tickAsync(29999);
    docsModule.status().should.equal('unavailable');
    await clock!.tickAsync(1);
    docsModule.status().should.equal('available');
  });

  it('S-077 · TS-12: caída detectada por el ping periódico', async () => {
    fakeTimers();
    await available();
    fakeBus.pingResponds('jiku-docs', false);
    await clock!.tickAsync(30000);
    docsModule.status().should.equal('unavailable');
  });

  it('S-077 · TS-13: registro ilegible al arrancar (DD-6)', async () => {
    fakeTimers();
    fakeBus.kvFailWith(new Error('stream not found'));
    await docsModule.start();
    docsModule.status().should.equal('not_installed');
    errorStub
      .calledWith('[modules] docs: no se pudo leer el registro (stream not found); reintento en 30 s')
      .should.be.true();
    fakeBus.kvHeal();
    await fakeBus.kvPut('docs', REC);
    fakeBus.pingResponds('jiku-docs', true);
    await clock!.tickAsync(30000);
    docsModule.status().should.equal('available');
    fakeBus.kvWatcherCount.should.equal(1);
  });

  it('S-077 · TS-14: sin registro, el temporizador no hace ping', async () => {
    fakeTimers();
    await docsModule.start();
    await clock!.tickAsync(60000);
    fakeBus.pings.should.deepEqual([]);
    docsModule.status().should.equal('not_installed');
  });

  it('S-077 · TS-15: un ping obsoleto no revive un módulo borrado', async () => {
    fakeTimers();
    await fakeBus.kvPut('docs', REC);
    fakeBus.pingResponds('jiku-docs', true, 1000);
    const started = docsModule.start();
    await fakeBus.kvDelete('docs');
    await clock!.tickAsync(1000);
    await started;
    docsModule.status().should.equal('not_installed');
  });

  it('S-077 · TS-16: markUnavailable pasa a unavailable ya y re-pinguea', async () => {
    await available();
    fakeBus.pingResponds('jiku-docs', false);
    const before = fakeBus.pings.length;
    const p = docsModule.markUnavailable();
    docsModule.status().should.equal('unavailable');
    fakeBus.pings.length.should.equal(before + 1);
    await p;
    docsModule.status().should.equal('unavailable');

    fakeBus.pingResponds('jiku-docs', true);
    await docsModule.markUnavailable();
    docsModule.status().should.equal('available');
  });

  it('S-077 · TS-17: start() es idempotente', async () => {
    fakeTimers();
    await fakeBus.kvPut('docs', REC);
    fakeBus.pingResponds('jiku-docs', true);
    await docsModule.start();
    await docsModule.start();
    const n = fakeBus.pings.length;
    await clock!.tickAsync(30000);
    fakeBus.kvWatcherCount.should.equal(1);
    fakeBus.pings.length.should.equal(n + 1);
  });

  it('S-077 · TS-18: stop() deja todo limpio', async () => {
    fakeTimers();
    await available();
    docsModule.stop();
    const n = fakeBus.pings.length;
    await clock!.tickAsync(60000);
    docsModule.status().should.equal('not_installed');
    fakeBus.kvWatcherCount.should.equal(0);
    fakeBus.pings.length.should.equal(n);
  });

  it('S-077 · TS-19: estado público por cada estado interno', async () => {
    listModules().should.deepEqual([{ module: 'docs', status: 'not_installed' }]);

    await fakeBus.kvPut('docs', { ...REC, protocol: 'v2' });
    await docsModule.start();
    const incompatible = listModules();
    incompatible.should.deepEqual([{ module: 'docs', status: 'not_installed' }]);
    incompatible[0].should.not.have.property('features');
    docsModule.stop();

    await fakeBus.kvPut('docs', REC);
    await docsModule.start();
    listModules().should.deepEqual([{ module: 'docs', status: 'unavailable', features: { sharing: false } }]);
    docsModule.stop();

    fakeBus.pingResponds('jiku-docs', true);
    await docsModule.start();
    listModules().should.deepEqual([{ module: 'docs', status: 'available', features: { sharing: false } }]);
  });

  it('S-077 · TS-20: un watch que termina se reabre', async () => {
    fakeTimers();
    await available();
    fakeBus.kvCloseWatchers();
    fakeBus.kvWatcherCount.should.equal(0);
    await clock!.tickAsync(30000);
    fakeBus.kvWatcherCount.should.equal(1);
    docsModule.status().should.equal('available');
    await fakeBus.kvDelete('docs');
    docsModule.status().should.equal('not_installed');
  });

  it('S-077 · TS-21: el log de transición sale solo en cada cambio', async () => {
    fakeTimers();
    await available();
    await clock!.tickAsync(90000);
    const transitions = infoStub.args.filter((a) => /^\[modules\]/.test(a[0]));
    transitions.length.should.equal(1);
    transitions[0][0].should.equal('[modules] docs: not_installed -> available');
  });
});
