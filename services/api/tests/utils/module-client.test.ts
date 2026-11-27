import 'mocha';
import 'should';
import express, { Response } from 'express';
import request from 'supertest';
import sinon from 'sinon';
import logger from '../../lib/logger';
import { moduleCommand, moduleQuery, runModuleCommand, sendToModule } from '../../lib/modules/client';
import { docsModule } from '../../lib/modules/registry';
import buildActor from '../../lib/utils/bus/actor';
import { fakeBus } from '../mocks/bus';

const REC = { module: 'docs', serviceName: 'jiku-docs', protocol: 'v1', registeredAt: '2026-10-24T12:00:00.000Z' };
const NOT_INSTALLED = { code: 'module_not_installed', message: 'El módulo docs no está instalado' };
const UNAVAILABLE = { code: 'module_unavailable', message: 'El módulo docs no está disponible en este momento' };

type Handler = (res: Response) => Promise<unknown>;

interface Identity {
  decodedToken: Record<string, unknown>;
  decodedTokenRoles?: string[];
}

/**
 * Mini-app con `GET /probe`. `identity` por defecto es `zitadel-sub-01` con rol `user`; `false` omite
 * la identidad verificada; un objeto instala exactamente ese `decodedToken` y `decodedTokenRoles`.
 */
function app(handler: Handler, identity: Identity | boolean = true) {
  const a = express();
  a.use(express.json());
  if (identity) {
    const id: Identity =
      identity === true ? { decodedToken: { sub: 'zitadel-sub-01' }, decodedTokenRoles: ['user'] } : identity;
    a.use((req, _res, next) => {
      req.decodedToken = id.decodedToken as any;
      req.decodedTokenRoles = id.decodedTokenRoles as string[];
      next();
    });
  }
  a.get('/probe', async (_req, res) => {
    const data = await handler(res);
    if (!data) return;
    res.status(200).json(data);
  });
  return a;
}

async function makeAvailable(record: object = REC, serviceName = 'jiku-docs') {
  await fakeBus.kvPut('docs', record);
  fakeBus.pingResponds(serviceName, true);
  await docsModule.start();
}

const list: Handler = (res) => moduleQuery(res, 'docs', 'documents.list', { filter: { projectId: 12 } });

describe('S-077 · cliente de módulo', () => {
  let errorStub: sinon.SinonStub;
  beforeEach(() => {
    errorStub = sinon.stub(logger, 'error');
    sinon.stub(logger, 'info');
  });
  afterEach(() => {
    docsModule.stop();
    sinon.restore();
  });

  it('S-077 · TS-22: consulta feliz con subject, payload y actor completo', async () => {
    await makeAvailable();
    fakeBus.moduleReply('documents.list', { status: 'success', data: { items: [] } });
    const res = await request(app(list)).get('/probe');
    res.status.should.equal(200);
    res.body.should.deepEqual({ items: [] });
    fakeBus.lastModule!.should.deepEqual({
      kind: 'query',
      method: 'documents.list',
      subject: 'dev.000000000000000001.jiku-docs-queries.v1.documents.list',
      payload: { filter: { projectId: 12 }, actor: { id: 'zitadel-sub-01', roles: ['user'] } },
    });
  });

  it('S-077 · TS-23: el nombre del servicio sale del registro', async () => {
    await makeAvailable({ ...REC, serviceName: 'otro-docs' }, 'otro-docs');
    fakeBus.moduleReply('documents.list', { status: 'success', data: { items: [] } });
    await request(app(list)).get('/probe');
    fakeBus.lastModule!.subject.should.equal('dev.000000000000000001.otro-docs-queries.v1.documents.list');
    fakeBus.pings.should.deepEqual(['otro-docs']);
  });

  it('S-077 · TS-24: comando con subject de comandos', async () => {
    await makeAvailable();
    fakeBus.moduleReply('documents.new', { status: 'success', data: { id: '01JB0000000000000000000000' } });
    const res = await request(
      app((r) => moduleCommand(r, 'docs', 'documents.new', { folderId: '01JB0000000000000000000001' }))
    ).get('/probe');
    res.status.should.equal(200);
    res.body.should.deepEqual({ id: '01JB0000000000000000000000' });
    fakeBus.lastModule!.kind.should.equal('command');
    fakeBus.lastModule!.subject.should.equal('dev.000000000000000001.jiku-docs-commands.v1.documents.new');
    fakeBus.lastModule!.payload.should.deepEqual({
      folderId: '01JB0000000000000000000001',
      actor: { id: 'zitadel-sub-01', roles: ['user'] },
    });
  });

  it('S-077 · TS-25: actor del token entero, gana el del token', async () => {
    await makeAvailable();
    fakeBus.moduleReplyDefault({ status: 'success', data: {} });
    await request(
      app((r) =>
        moduleQuery(r, 'docs', 'documents.list', {
          actor: { id: 'otro', roles: ['admin'], name: 'Intruso', email: 'x@x.com' },
          filter: {},
        })
      )
    ).get('/probe');
    fakeBus.lastModule!.payload.should.deepEqual({ filter: {}, actor: { id: 'zitadel-sub-01', roles: ['user'] } });
  });

  it('S-089 · TS-2: actor con perfil igual a buildActor del mismo request', async () => {
    await makeAvailable();
    fakeBus.moduleReplyDefault({ status: 'success', data: {} });
    let expected: unknown;
    await request(
      app(
        (r) => {
          expected = buildActor(r.req);
          return list(r);
        },
        {
          decodedToken: {
            sub: 'zitadel-sub-05',
            name: 'Ana Pérez',
            preferred_username: 'ana@grava.digital',
            email: 'ana@grava.digital',
          },
          decodedTokenRoles: ['user'],
        }
      )
    ).get('/probe');
    const actor = fakeBus.lastModule!.payload.actor;
    actor.should.deepEqual({
      id: 'zitadel-sub-05',
      roles: ['user'],
      name: 'Ana Pérez',
      username: 'ana@grava.digital',
      email: 'ana@grava.digital',
    });
    actor.should.deepEqual(expected);
    Object.keys(actor).should.not.containEql('preferred_username');
  });

  it('S-089 · TS-3: sin claim de roles el actor lleva roles vacío', async () => {
    await makeAvailable();
    fakeBus.moduleReplyDefault({ status: 'success', data: {} });
    const res = await request(app(list, { decodedToken: { sub: 'zitadel-sub-01' } })).get('/probe');
    res.status.should.equal(200);
    fakeBus.lastModule!.payload.actor.should.deepEqual({ id: 'zitadel-sub-01', roles: [] });
  });

  it('S-089 · TS-7: sub vacío cuenta como sin identidad', async () => {
    await makeAvailable();
    const res = await request(app(list, { decodedToken: { sub: '' }, decodedTokenRoles: ['user'] })).get('/probe');
    res.status.should.equal(401);
    res.body.should.deepEqual({ code: 'unauthorized', message: 'Unauthorized' });
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-089 · TS-10: el log no filtra payload ni perfil', async () => {
    await makeAvailable();
    fakeBus.moduleFailWithTimeout();
    const res = await request(
      app((r) => moduleQuery(r, 'docs', 'documents.list', { content: 'secreto' }), {
        decodedToken: {
          sub: 'zitadel-sub-05',
          name: 'Ana Pérez',
          preferred_username: 'ana@grava.digital',
          email: 'ana@grava.digital',
        },
        decodedTokenRoles: ['user'],
      })
    ).get('/probe');
    res.status.should.equal(504);
    res.body.should.deepEqual({ code: 'gateway_timeout', message: 'La operación tardó demasiado' });
    errorStub.calledWith('[modules] docs documents.list: TIMEOUT').should.be.true();
    const logged = JSON.stringify(errorStub.args);
    ['secreto', 'ana@grava.digital', 'Ana Pérez'].forEach((v) => logged.includes(v).should.be.false());
  });

  it('S-077 · TS-26: llamado anónimo (opt-in) sin actor', async () => {
    await makeAvailable();
    fakeBus.moduleReplyDefault({ status: 'success', data: {} });
    await request(
      app((r) =>
        moduleQuery(r, 'docs', 'shares.resolve', { token: 'jds_x', actor: { id: 'inyectado' } }, { anonymous: true })
      )
    ).get('/probe');
    fakeBus.lastModule!.payload.should.deepEqual({ token: 'jds_x' });
  });

  it('S-077 · TS-27: sin identidad verificada no se publica', async () => {
    await makeAvailable();
    const res = await request(app((r) => moduleQuery(r, 'docs', 'documents.list', {}), false)).get('/probe');
    res.status.should.equal(401);
    res.body.should.deepEqual({ code: 'unauthorized', message: 'Unauthorized' });
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-077 · TS-28: error con details', async () => {
    await makeAvailable();
    fakeBus.moduleReply('documents.list', {
      status: 'failure', errorCode: 'version_conflict', errorMessage: 'La versión cambió',
      errorDetails: { currentVersion: 7 },
    });
    const res = await request(app(list)).get('/probe');
    res.status.should.equal(409);
    res.body.should.deepEqual({ code: 'version_conflict', message: 'La versión cambió', details: { currentVersion: 7 } });
  });

  it('S-077 · TS-29: error sin details', async () => {
    await makeAvailable();
    fakeBus.moduleReply('documents.list', { status: 'failure', errorCode: 'document_not_found', errorMessage: 'No existe' });
    const res = await request(app(list)).get('/probe');
    res.status.should.equal(404);
    res.body.should.deepEqual({ code: 'document_not_found', message: 'No existe' });
    res.body.should.not.have.property('details');
  });

  it('S-077 · TS-30: código desconocido', async () => {
    await makeAvailable();
    fakeBus.moduleReply('documents.list', { status: 'failure', errorCode: 'brand_new_code', errorMessage: 'Algo' });
    const res = await request(app(list)).get('/probe');
    res.status.should.equal(500);
    res.body.should.deepEqual({ code: 'brand_new_code', message: 'Algo' });
  });

  it('S-077 · TS-31: upstream_unavailable no toca el registro', async () => {
    await makeAvailable();
    fakeBus.moduleReply('documents.list', { status: 'failure', errorCode: 'upstream_unavailable', errorMessage: 'core no responde' });
    const n = fakeBus.pings.length;
    const res = await request(app(list)).get('/probe');
    res.status.should.equal(503);
    res.body.should.deepEqual({ code: 'upstream_unavailable', message: 'core no responde' });
    docsModule.status().should.equal('available');
    fakeBus.pings.length.should.equal(n);
  });

  it('S-077 · TS-32: query_timeout', async () => {
    await makeAvailable();
    fakeBus.moduleReply('documents.list', { status: 'failure', errorCode: 'query_timeout', errorMessage: 'La consulta tardó demasiado' });
    const res = await request(app(list)).get('/probe');
    res.status.should.equal(504);
    res.body.should.deepEqual({ code: 'query_timeout', message: 'La consulta tardó demasiado' });
  });

  it('S-077 · TS-33: timeout del bus', async () => {
    await makeAvailable();
    fakeBus.moduleFailWithTimeout();
    const res = await request(app(list)).get('/probe');
    res.status.should.equal(504);
    res.body.should.deepEqual({ code: 'gateway_timeout', message: 'La operación tardó demasiado' });
    docsModule.status().should.equal('available');
  });

  it('S-077 · TS-34: no responders marca unavailable y re-pinguea', async () => {
    await makeAvailable();
    fakeBus.pingResponds('jiku-docs', false);
    fakeBus.moduleFailWithNoResponders();
    const n = fakeBus.pings.length;
    const res = await request(app(list)).get('/probe');
    res.status.should.equal(503);
    res.body.should.deepEqual(UNAVAILABLE);
    docsModule.status().should.equal('unavailable');
    fakeBus.pings.length.should.equal(n + 1);
  });

  it('S-077 · TS-35: otro error del bus no toca el registro', async () => {
    await makeAvailable();
    fakeBus.moduleFailWith(new Error('Bus no conectado'));
    const n = fakeBus.pings.length;
    const res = await request(app(list)).get('/probe');
    res.status.should.equal(503);
    res.body.should.deepEqual(UNAVAILABLE);
    docsModule.status().should.equal('available');
    fakeBus.pings.length.should.equal(n);
  });

  it('S-077 · TS-36: módulo not_installed', async () => {
    const res = await request(app(list)).get('/probe');
    res.status.should.equal(404);
    res.body.should.deepEqual(NOT_INSTALLED);
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-077 · TS-37: módulo unavailable', async () => {
    await fakeBus.kvPut('docs', REC);
    await docsModule.start();
    const res = await request(app(list)).get('/probe');
    res.status.should.equal(503);
    res.body.should.deepEqual(UNAVAILABLE);
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-077 · TS-38: runModuleCommand con éxito sin data', async () => {
    await makeAvailable();
    const method = 'documents.01JB0000000000000000000000.unlock';
    fakeBus.moduleReply(method, { status: 'success' });
    const a = express();
    a.use((req, _res, next) => {
      req.decodedToken = { sub: 'zitadel-sub-01' } as any;
      next();
    });
    a.get('/probe', async (_req, res) => {
      const ok = await runModuleCommand(res, 'docs', method, { sessionId: 's1' });
      if (!ok) return;
      res.status(204).end();
    });
    const res = await request(a).get('/probe');
    res.status.should.equal(204);
    fakeBus.lastModule!.kind.should.equal('command');
  });

  it('S-077 · TS-39: el log no filtra el payload', async () => {
    await makeAvailable();
    fakeBus.moduleFailWithTimeout();
    await request(app((r) => moduleQuery(r, 'docs', 'documents.list', { content: 'secreto' }))).get('/probe');
    errorStub.calledWith('[modules] docs documents.list: TIMEOUT').should.be.true();
    errorStub.args.some((a) => JSON.stringify(a).includes('secreto')).should.be.false();
  });
});

describe('S-080 · sendToModule', () => {
  beforeEach(() => {
    sinon.stub(logger, 'error');
    sinon.stub(logger, 'info');
  });
  afterEach(() => {
    docsModule.stop();
    sinon.restore();
  });

  it('S-080 · TS-28: clasifica el resultado sin responder HTTP ni tocar el payload', async () => {
    await makeAvailable();

    fakeBus.moduleReply('x.y', { status: 'success', data: { a: 1 } });
    (await sendToModule('query', 'docs', 'x.y', { token: 'jds_x' })).should.deepEqual({ kind: 'data', data: { a: 1 } });
    // No agrega `actor`.
    fakeBus.lastModule!.payload.should.deepEqual({ token: 'jds_x' });

    fakeBus.moduleReply('x.y', { status: 'failure', errorCode: 'x', errorMessage: 'm' } as any);
    const failed: any = await sendToModule('query', 'docs', 'x.y', {});
    failed.kind.should.equal('failure');
    failed.reply.errorCode.should.equal('x');

    fakeBus.moduleFailWithTimeout();
    (await sendToModule('query', 'docs', 'x.y', {})).should.deepEqual({ kind: 'timeout' });

    fakeBus.pingResponds('jiku-docs', false);
    fakeBus.moduleFailWithNoResponders();
    (await sendToModule('query', 'docs', 'x.y', {})).should.deepEqual({ kind: 'unreachable' });
    docsModule.status().should.equal('unavailable');

    docsModule.stop();
    const sent = fakeBus.moduleSent.length;
    (await sendToModule('query', 'docs', 'x.y', {})).should.deepEqual({ kind: 'unreachable' });
    fakeBus.moduleSent.length.should.equal(sent);
  });
});
