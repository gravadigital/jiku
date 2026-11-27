import 'mocha';
import 'should';
import sinon from 'sinon';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import {
  COMMAND_SUBJECT_PREFIX as C, DOC_ID, SHARE_ID, docsAvailable, failure, itRespectsModuleState, success,
  expectedActor,
} from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';
import logger from '../../lib/logger';
import { ULID_PATTERN } from '../../lib/modules/docs/ids';

const ACTOR = { actor: expectedActor('token_01_user') };

const URL = `/api/docs/documents/${DOC_ID}/shares`;
const EXPIRES = '2026-11-23T00:00:00.000Z';
const TOKEN = 'jds_' + 'A'.repeat(43);
const BODY = { mode: 'latest', expiresAt: EXPIRES, includeAttachments: true, note: 'Para Acme' };
const CREATED = { id: SHARE_ID, token: TOKEN, url: `http://127.0.0.1:3100/p/docs/${TOKEN}`, expiresAt: EXPIRES };

describe('POST /api/docs/documents/:id/shares (S-079)', () => {
  let application: Application;
  let saved: string | undefined;
  let spies: sinon.SinonSpy[] = [];
  before(() => { application = start(); });
  beforeEach(() => {
    saved = process.env.JIKU_PUBLIC_URL;
    process.env.JIKU_PUBLIC_URL = 'http://127.0.0.1:3100';
  });
  afterEach(() => {
    docsModule.stop();
    spies.forEach(s => s.restore());
    spies = [];
    if (saved === undefined) delete process.env.JIKU_PUBLIC_URL; else process.env.JIKU_PUBLIC_URL = saved;
  });
  const call = (body: any, token = 'token_01_user', url = URL) =>
    request(application).post(url).set('Authorization', `Bearer ${token}`).send(body);

  it('S-079 · TS-39 (CA-S9): crear link, token y url sin loguear', async () => {
    await docsAvailable();
    spies = (['info', 'warn', 'error', 'debug'] as const).map(l => sinon.spy(logger as any, l));
    fakeBus.moduleReply('shares.new', success(CREATED));
    const res = await call(BODY);
    res.status.should.equal(201);
    res.body.should.deepEqual(CREATED);
    fakeBus.lastModule!.subject.should.equal(C + 'shares.new');
    const { id, ...rest } = fakeBus.lastModule!.payload as any;
    id.should.match(ULID_PATTERN);
    rest.should.deepEqual({ documentId: DOC_ID, ...BODY, ...ACTOR });
    for (const spy of spies) {
      for (const args of spy.args) {
        JSON.stringify(args).should.not.containEql(TOKEN);
        JSON.stringify(args).should.not.containEql('/p/docs/');
      }
    }
  });

  it('S-079 · TS-40 (CA-S9): sin JIKU_PUBLIC_URL', async () => {
    await docsAvailable();
    for (const value of [undefined, '   ']) {
      if (value === undefined) delete process.env.JIKU_PUBLIC_URL; else process.env.JIKU_PUBLIC_URL = value;
      const res = await call(BODY);
      res.status.should.equal(404);
      res.body.should.deepEqual({ code: 'sharing_not_configured', message: 'Los links compartidos no están configurados' });
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-079 · TS-41: fijado, confirmación de secreto y errores', async () => {
    await docsAvailable();
    fakeBus.moduleReply('shares.new', success(CREATED));
    const body = { id: SHARE_ID, mode: 'pinned', version: 3, expiresAt: EXPIRES, includeAttachments: false, acknowledgeSecretWarning: true };
    (await call(body)).status.should.equal(201);
    fakeBus.lastModule!.payload.should.deepEqual({ ...body, documentId: DOC_ID, ...ACTOR });
    const cases: Array<[string, number]> = [['secret_warning_not_acknowledged', 400], ['sharing_blocked', 403], ['share_expiry_invalid', 400]];
    for (const [code, status] of cases) {
      fakeBus.moduleReply('shares.new', failure(code, 'm'));
      const res = await call(BODY);
      res.status.should.equal(status);
      res.body.code.should.equal(code);
    }
  });

  it('S-079 · TS-42: inválidos', async () => {
    await docsAvailable();
    const bad: any[] = [
      { mode: 'forever', expiresAt: EXPIRES }, { mode: 'latest' }, { mode: 'latest', expiresAt: 'mañana' },
      { mode: 'latest', expiresAt: EXPIRES, documentId: DOC_ID }, { mode: 'latest', expiresAt: EXPIRES, token: 'jds_x' },
      { mode: 'latest', expiresAt: EXPIRES, version: '3' },
    ];
    for (const body of bad) {
      const res = await call(body);
      res.status.should.equal(400);
      res.body.code.should.equal('invalid_fields');
    }
    const nf = await call(BODY, 'token_01_user', '/api/docs/documents/abc/shares');
    nf.status.should.equal(404);
    nf.body.code.should.equal('document_not_found');
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-079 · TS-43: id malformado antes que sharing', async () => {
    await docsAvailable();
    delete process.env.JIKU_PUBLIC_URL;
    const res = await call(BODY, 'token_01_user', '/api/docs/documents/abc/shares');
    res.status.should.equal(404);
    res.body.code.should.equal('document_not_found');
  });

  it('S-079 · TS-8: rol rechazado', async () => {
    await docsAvailable();
    for (const token of ['token_04_external_user', 'token_08_no_roles']) {
      const res = await call(BODY, token);
      res.status.should.equal(403);
      res.body.should.deepEqual({ code: 'access_denied', message: 'Access denied' });
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  itRespectsModuleState(() => application, URL, 'token_01_user', 'S-079 · TS-46: respeta el estado del módulo', { method: 'post', body: BODY });
});
