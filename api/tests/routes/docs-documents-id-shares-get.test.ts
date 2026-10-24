import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import {
  QUERY_SUBJECT_PREFIX as Q, DOC_ID, SHARE_ID, docsAvailable, failure, itRespectsModuleState, success,
} from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';

const ACTOR = { actor: { id: 'zitadel-sub-01' } };

const URL = `/api/docs/documents/${DOC_ID}/shares`;
const SHARE = {
  id: SHARE_ID, documentId: DOC_ID, mode: 'latest', version: null, includeAttachments: true, note: 'Para Acme',
  status: 'active', createdBy: 'zitadel-sub-01', createdAt: '2026-10-24T13:00:00.000Z', expiresAt: '2026-11-23T00:00:00.000Z',
  revokedAt: null, revokedBy: null, revokeReason: null, accessCount: 2, lastAccessAt: '2026-10-24T14:00:00.000Z',
};

describe('GET /api/docs/documents/:id/shares (S-079)', () => {
  let application: Application;
  let saved: string | undefined;
  before(() => { application = start(); });
  beforeEach(() => { saved = process.env.JIKU_PUBLIC_URL; });
  afterEach(() => {
    docsModule.stop();
    if (saved === undefined) delete process.env.JIKU_PUBLIC_URL; else process.env.JIKU_PUBLIC_URL = saved;
  });
  const call = (url: string = URL, token = 'token_01_user') =>
    request(application).get(url).set('Authorization', `Bearer ${token}`);

  it('S-079 · TS-36: listar links, sin token', async () => {
    await docsAvailable();
    const data = { items: [SHARE], page: { limit: 50, returned: 1 } };
    fakeBus.moduleReply('shares.list', success(data));
    const res = await call();
    res.status.should.equal(200);
    res.body.should.deepEqual(data);
    fakeBus.lastModule!.should.deepEqual({
      kind: 'query', method: 'shares.list', subject: Q + 'shares.list',
      payload: { filter: { documentId: DOC_ID }, sort: ['-createdAt'], page: { limit: 50 }, ...ACTOR },
    });
    res.text.should.not.containEql('jds_');
  });

  it('S-079 · TS-37: filtros, inválidos y funciona sin JIKU_PUBLIC_URL', async () => {
    delete process.env.JIKU_PUBLIC_URL;
    await docsAvailable();
    fakeBus.moduleReply('shares.list', success({ items: [], page: { limit: 10, returned: 0 } }));
    (await call(`${URL}?status=active&limit=10&cursor=c1`)).status.should.equal(200);
    (fakeBus.lastModule!.payload as any).filter.should.deepEqual({ documentId: DOC_ID, status: 'active' });
    (fakeBus.lastModule!.payload as any).page.should.deepEqual({ limit: 10, cursor: 'c1' });
    const sent = fakeBus.moduleSent.length;
    for (const q of ['?status=foo', '?limit=201', '?sort=createdAt']) {
      (await call(`${URL}${q}`)).status.should.equal(400);
    }
    const nf = await call('/api/docs/documents/abc/shares');
    nf.status.should.equal(404);
    nf.body.code.should.equal('document_not_found');
    fakeBus.moduleSent.length.should.equal(sent);
    fakeBus.moduleReply('shares.list', failure('permission_denied', 'Sin permiso'));
    (await call()).status.should.equal(403);
  });

  it('S-079 · TS-8: rol rechazado', async () => {
    await docsAvailable();
    for (const token of ['token_04_external_user', 'token_08_no_roles']) {
      const res = await call(URL, token);
      res.status.should.equal(403);
      res.body.should.deepEqual({ code: 'access_denied', message: 'Access denied' });
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  itRespectsModuleState(() => application, URL, 'token_01_user', 'S-079 · TS-46: respeta el estado del módulo');
});
