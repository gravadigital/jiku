import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import {
  ATT_ID, COMMAND_SUBJECT_PREFIX as C, DOC_ID, docsAvailable, failure, itRespectsModuleState, success,
  expectedActor,
} from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';

const ACTOR = { actor: expectedActor('token_01_user') };
import { ULID_PATTERN } from '../../lib/modules/docs/ids';

const URL = '/api/docs/attachments';
const BIN_SUM = 'sha256:' + 'b'.repeat(64);
const BODY = { documentId: DOC_ID, fileName: 'diagrama.png', mimeType: 'image/png', fileSize: 20480, checksum: BIN_SUM };
const OK = { id: ATT_ID, uploadUrl: 'https://s3.example/put?sig=1', expiresIn: 300, link: `http://localhost:3000/docs/attachments/${ATT_ID}` };

describe('POST /api/docs/attachments (S-079)', () => {
  let application: Application;
  before(() => { application = start(); });
  afterEach(() => docsModule.stop());
  const call = (body: any, token = 'token_01_user') =>
    request(application).post(URL).set('Authorization', `Bearer ${token}`).send(body);

  it('S-079 · TS-31: pedido de subida sin id', async () => {
    await docsAvailable();
    fakeBus.moduleReply('attachments.request-upload', success(OK));
    const res = await call(BODY);
    res.status.should.equal(201);
    res.body.should.deepEqual(OK);
    fakeBus.lastModule!.subject.should.equal(C + 'attachments.request-upload');
    const { id, ...rest } = fakeBus.lastModule!.payload as any;
    id.should.match(ULID_PATTERN);
    rest.should.deepEqual({ ...BODY, ...ACTOR });
  });

  it('S-079 · TS-32: con id e inválidos', async () => {
    await docsAvailable();
    fakeBus.moduleReply('attachments.request-upload', success(OK));
    (await call({ ...BODY, id: ATT_ID })).status.should.equal(201);
    (fakeBus.lastModule!.payload as any).id.should.equal(ATT_ID);
    const sent = fakeBus.moduleSent.length;
    const { mimeType, ...noMime } = BODY;
    const bad: any[] = [
      { ...BODY, checksum: 'abc' }, { ...BODY, checksum: 'sha256:' + 'B'.repeat(64) }, { ...BODY, fileSize: 0 },
      { ...BODY, fileSize: '20480' }, noMime, { ...BODY, documentId: 'x' }, { ...BODY, id: 'x' }, { ...BODY, foo: 1 },
    ];
    for (const body of bad) {
      const res = await call(body);
      res.status.should.equal(400);
      res.body.code.should.equal('invalid_fields');
    }
    fakeBus.moduleSent.length.should.equal(sent);
  });

  it('S-079 · TS-33: errores de subida', async () => {
    await docsAvailable();
    const cases: Array<[string, number]> = [
      ['attachment_type_not_allowed', 400], ['attachment_too_large', 400], ['document_not_found', 404], ['upstream_unavailable', 503],
    ];
    for (const [code, status] of cases) {
      fakeBus.moduleReply('attachments.request-upload', failure(code, 'm'));
      const res = await call(BODY);
      res.status.should.equal(status);
      res.body.code.should.equal(code);
    }
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
