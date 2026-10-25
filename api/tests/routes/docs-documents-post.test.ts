import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import {
  COMMAND_SUBJECT_PREFIX as C, DOC_ID, FOLDER_ID, docsAvailable, docsNotInstalled, failure, itRespectsModuleState, success,
  expectedActor,
} from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';
import { ULID_PATTERN } from '../../lib/modules/docs/ids';

const CONTENT = '# Acta\n\nKickoff con Acme.\n';
const CONTENT_SUM = 'sha256:56ef0169a0ce1c72ce999efd5044f748c00da07d58ec73958f2b9057ab7c87c5';
const ACTOR = { actor: expectedActor('token_01_user') };
const URL = '/api/docs/documents';
const BODY = { folderId: FOLDER_ID, fileName: 'acta.md', content: CONTENT };
const OK = { id: DOC_ID, version: 1, path: '/clientes/acme/acta.md' };

describe('POST /api/docs/documents (S-079)', () => {
  let application: Application;
  before(() => { application = start(); });
  afterEach(() => docsModule.stop());

  const post = (body: any, token = 'token_01_user') =>
    request(application).post(URL).set('Authorization', `Bearer ${token}`).send(body);

  it('S-079 · TS-1: alta sin id', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.new', success(OK));
    const res = await post(BODY);
    res.status.should.equal(201);
    res.body.should.deepEqual(OK);
    fakeBus.moduleSent.length.should.equal(1);
    const last = fakeBus.lastModule!;
    last.kind.should.equal('command');
    last.method.should.equal('documents.new');
    last.subject.should.equal(C + 'documents.new');
    const { id, ...rest } = last.payload as any;
    id.should.match(ULID_PATTERN);
    rest.should.deepEqual({ folderId: FOLDER_ID, fileName: 'acta.md', content: CONTENT, checksum: CONTENT_SUM, via: 'human', ...ACTOR });
  });

  it('S-079 · TS-2: alta con id y message', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.new', success(OK));
    const res = await post({ ...BODY, id: DOC_ID, message: 'Alta inicial' });
    res.status.should.equal(201);
    fakeBus.lastModule!.payload.should.deepEqual({
      id: DOC_ID, folderId: FOLDER_ID, fileName: 'acta.md', content: CONTENT, checksum: CONTENT_SUM,
      via: 'human', message: 'Alta inicial', ...ACTOR,
    });
  });

  it('S-079 · TS-3: dos altas sin id generan ULID distintos', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.new', success(OK));
    await post(BODY);
    await post(BODY);
    const [a, b] = fakeBus.moduleSent.map((c: any) => c.payload.id);
    a.should.match(ULID_PATTERN);
    b.should.match(ULID_PATTERN);
    a.should.not.equal(b);
  });

  it('S-079 · TS-4: warnings se devuelve tal cual', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.new', success({ ...OK, warnings: ['possible_secret_detected'] }));
    const res = await post(BODY);
    res.status.should.equal(201);
    res.body.warnings.should.deepEqual(['possible_secret_detected']);
  });

  it('S-079 · TS-5: checksum UTF-8 y contenido vacío', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.new', success(OK));
    await post({ ...BODY, content: 'Año\n' });
    (fakeBus.lastModule!.payload as any).checksum.should.equal('sha256:af8a9a5924d037f8b26da7db93567aef77b6d7a77299d476e3812ff5f8436fd2');
    const res = await post({ ...BODY, content: '' });
    res.status.should.equal(201);
    (fakeBus.lastModule!.payload as any).checksum.should.equal('sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('S-079 · TS-6: body inválido', async () => {
    await docsAvailable();
    const { folderId, fileName, content } = BODY;
    const bad: any[] = [
      { fileName, content }, { ...BODY, folderId: 'abc' }, { folderId, content }, { ...BODY, fileName: '' },
      { folderId, fileName }, { ...BODY, content: 123 }, { ...BODY, id: 'abc' }, { ...BODY, checksum: CONTENT_SUM },
      { ...BODY, via: 'agent' }, { ...BODY, contentUploadId: DOC_ID }, { ...BODY, foo: 1 },
    ];
    for (const body of bad) {
      const res = await post(body);
      res.status.should.equal(400);
      res.body.code.should.equal('invalid_fields');
      res.body.message.should.startWith('Invalid field - ');
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-079 · TS-7: errores de jiku-docs sin traducir', async () => {
    await docsAvailable();
    const cases: Array<[string, number]> = [
      ['already_exists', 409], ['file_name_invalid', 400], ['folder_not_found', 404],
      ['permission_denied', 403], ['content_too_large', 400], ['upstream_unavailable', 503],
    ];
    for (const [code, status] of cases) {
      fakeBus.moduleReply('documents.new', failure(code, code === 'upstream_unavailable' ? 'core no responde' : 'm'));
      const res = await post(BODY);
      res.status.should.equal(status);
      res.body.should.deepEqual({ code, message: code === 'upstream_unavailable' ? 'core no responde' : 'm' });
    }
  });

  it('S-079 · TS-8: rol rechazado', async () => {
    await docsAvailable();
    for (const token of ['token_04_external_user', 'token_08_no_roles']) {
      const res = await post(BODY, token);
      res.status.should.equal(403);
      res.body.should.deepEqual({ code: 'access_denied', message: 'Access denied' });
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-079 · TS-44: requireModule va antes del rol y de Joi', async () => {
    await docsNotInstalled();
    const res = await post({ foo: 1 }, 'token_04_external_user');
    res.status.should.equal(404);
    res.body.code.should.equal('module_not_installed');
  });

  it('S-079 · límite de body: admite contenido de 256 KiB, no el 413 de 100 kb', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.new', success(OK));
    const big = 'a'.repeat(262144);
    const res = await post({ ...BODY, content: big });
    res.status.should.equal(201);
    (fakeBus.lastModule!.payload as any).content.length.should.equal(262144);
    // Con saltos de línea el JSON se expande (\n ocupa dos bytes) y sigue entrando.
    const lines = await post({ ...BODY, content: '\n'.repeat(262144) });
    lines.status.should.equal(201);
  });

  it('S-079 · límite de body: por encima del tope de docs sigue siendo 413', async () => {
    await docsAvailable();
    const res = await post({ ...BODY, content: 'a'.repeat(900 * 1024) });
    res.status.should.equal(413);
    fakeBus.moduleSent.length.should.equal(0);
  });

  itRespectsModuleState(() => application, URL, 'token_01_user', 'S-079 · TS-46: respeta el estado del módulo', { method: 'post', body: BODY });
});
