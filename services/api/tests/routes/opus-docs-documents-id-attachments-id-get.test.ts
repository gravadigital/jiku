import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import {
  ATT_ID, DOC_ID, FOLDER_ID, docsAvailable, failure, itRespectsModuleState, success,
  expectedActor,
} from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';

const METHOD = `attachments.${ATT_ID}.request-download`;
const OTHER_ATT = FOLDER_ID;
const TICKET = { id: ATT_ID, downloadUrl: 'https://s3.example/att?sig=1', expiresIn: 300 };
const PUBLIC_DOC = {
  id: DOC_ID,
  title: 'Manual de uso',
  visibility: 'public',
  attachments: [{ id: ATT_ID, documentId: DOC_ID, fileName: 'plano.pdf', mimeType: 'application/pdf', sizeBytes: 1024 }],
};
const DOC_NOT_FOUND = { code: 'document_not_found', message: 'Documento no encontrado' };
const ATT_NOT_FOUND = { code: 'attachment_not_found', message: 'Adjunto no encontrado' };

describe('GET /api/opus/docs/documents/:documentId/attachments/:id (S-087)', () => {
  let application: Application;
  before(() => { application = start(); });
  afterEach(() => docsModule.stop());

  const get = (url: string, token = 'token_04_external_user') =>
    request(application).get(url).set('Authorization', `Bearer ${token}`).redirects(0);
  const URL = `/api/opus/docs/documents/${DOC_ID}/attachments/${ATT_ID}`;

  it('S-087 · TS-1: externo, documento public que contiene el adjunto', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.get', success(PUBLIC_DOC));
    fakeBus.moduleReply(METHOD, success(TICKET));
    const res = await get(URL);
    res.status.should.equal(302);
    res.headers.location.should.equal(TICKET.downloadUrl);
    res.headers['x-content-type-options'].should.equal('nosniff');
    res.text.should.equal('');
    fakeBus.moduleSent.map((c) => c.method).should.deepEqual(['documents.get', METHOD]);
    (fakeBus.moduleSent[0].payload as any).should.deepEqual({
      id: DOC_ID, include: ['attachments'], actor: expectedActor('token_04_external_user'),
    });
    (fakeBus.moduleSent[1].payload as any).should.deepEqual({ actor: expectedActor('token_04_external_user') });
  });

  for (const [ts, token] of [
    ['TS-2', 'token_01_user'],
    ['TS-3', 'token_03_admin'],
  ] as const) {
    it(`S-087 · ${ts}: usuario interno, documento internal`, async () => {
      await docsAvailable();
      fakeBus.moduleReply('documents.get', success({ ...PUBLIC_DOC, visibility: 'internal' }));
      fakeBus.moduleReply(METHOD, success(TICKET));
      const res = await get(URL, token);
      res.status.should.equal(404);
      res.body.should.deepEqual(DOC_NOT_FOUND);
      fakeBus.moduleSent.length.should.equal(1);
      (fakeBus.moduleSent[0].payload as any).actor.should.deepEqual(expectedActor(token));
      (res.headers.location === undefined).should.be.true();
      res.text.should.not.containEql('s3.example');
    });
  }

  it('S-087 · TS-4: externo, documento internal responde 404 y nunca 403', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.get', success({ ...PUBLIC_DOC, visibility: 'internal' }));
    fakeBus.moduleReply(METHOD, success(TICKET));
    const res = await get(URL);
    res.status.should.equal(404);
    res.body.should.deepEqual(DOC_NOT_FOUND);
    fakeBus.moduleSent.length.should.equal(1);
  });

  it('S-087 · TS-5: documento sin visibility falla cerrado', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.get', success({ id: DOC_ID, attachments: PUBLIC_DOC.attachments }));
    fakeBus.moduleReply(METHOD, success(TICKET));
    const res = await get(URL);
    res.status.should.equal(404);
    res.body.should.deepEqual(DOC_NOT_FOUND);
    fakeBus.moduleSent.length.should.equal(1);
  });

  it('S-087 · TS-6: usuario interno con documento public', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.get', success(PUBLIC_DOC));
    fakeBus.moduleReply(METHOD, success(TICKET));
    const res = await get(URL, 'token_01_user');
    res.status.should.equal(302);
    res.headers.location.should.equal(TICKET.downloadUrl);
    (fakeBus.moduleSent[1].payload as any).should.deepEqual({ actor: expectedActor('token_01_user') });
  });

  it('S-087 · TS-7: adjunto de otro documento', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.get', success(PUBLIC_DOC));
    fakeBus.moduleReply(`attachments.${OTHER_ATT}.request-download`, success(TICKET));
    const res = await get(`/api/opus/docs/documents/${DOC_ID}/attachments/${OTHER_ATT}`);
    res.status.should.equal(404);
    res.body.should.deepEqual(ATT_NOT_FOUND);
    fakeBus.moduleSent.length.should.equal(1);
  });

  it('S-087 · TS-8: documento public sin adjuntos', async () => {
    await docsAvailable();
    fakeBus.moduleReply(METHOD, success(TICKET));
    fakeBus.moduleReply('documents.get', success({ ...PUBLIC_DOC, attachments: [] }));
    const a = await get(URL);
    a.status.should.equal(404);
    a.body.should.deepEqual(ATT_NOT_FOUND);

    fakeBus.moduleReply('documents.get', success({ id: DOC_ID, visibility: 'public' }));
    const b = await get(URL);
    b.status.should.equal(404);
    b.body.should.deepEqual(ATT_NOT_FOUND);
    fakeBus.moduleSent.map((c) => c.method).should.deepEqual(['documents.get', 'documents.get']);
  });

  it('S-087 · TS-9: ids con forma inválida, sin bus', async () => {
    await docsAvailable();
    const a = await get(`/api/opus/docs/documents/abc/attachments/${ATT_ID}`);
    a.status.should.equal(404);
    a.body.should.deepEqual(DOC_NOT_FOUND);
    const b = await get(`/api/opus/docs/documents/${DOC_ID}/attachments/abc`);
    b.status.should.equal(404);
    b.body.should.deepEqual(ATT_NOT_FOUND);
    const c = await get('/api/opus/docs/documents/abc/attachments/abc');
    c.status.should.equal(404);
    c.body.should.deepEqual(DOC_NOT_FOUND);
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-087 · TS-10: documento inexistente en jiku-docs', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.get', failure('document_not_found', 'Documento no encontrado'));
    const res = await get(URL);
    res.status.should.equal(404);
    res.body.should.deepEqual(DOC_NOT_FOUND);
    fakeBus.moduleSent.length.should.equal(1);
  });

  it('S-087 · TS-11: externo sin acceso en jiku-docs', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.get', failure('permission_denied', 'Sin permiso'));
    const res = await get(URL);
    res.status.should.equal(403);
    res.body.should.deepEqual({ code: 'permission_denied', message: 'Sin permiso' });
    fakeBus.moduleSent.length.should.equal(1);
  });

  it('S-087 · TS-12: request-download falla después de verificar', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.get', success(PUBLIC_DOC));
    fakeBus.moduleReply(METHOD, failure('attachment_not_found', 'Adjunto no encontrado'));
    const res = await get(URL);
    res.status.should.equal(404);
    res.body.should.deepEqual(ATT_NOT_FOUND);
    fakeBus.moduleSent.length.should.equal(2);
  });

  it('S-087 · TS-13: timeout del módulo', async () => {
    await docsAvailable();
    fakeBus.moduleFailWithTimeout();
    const res = await get(URL);
    res.status.should.equal(504);
    res.body.should.deepEqual({ code: 'gateway_timeout', message: 'La operación tardó demasiado' });
    fakeBus.moduleSent.length.should.equal(1);
  });

  it('S-087 · TS-14: rol rechazado', async () => {
    await docsAvailable();
    const res = await get(URL, 'token_08_no_roles');
    res.status.should.equal(403);
    res.body.should.deepEqual({ code: 'access_denied', message: 'Access denied' });
    fakeBus.moduleSent.length.should.equal(0);
  });

  itRespectsModuleState(() => application, URL, 'token_04_external_user');

  it('S-087 · TS-16: HEAD responde igual', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.get', success(PUBLIC_DOC));
    fakeBus.moduleReply(METHOD, success(TICKET));
    const res = await request(application).head(URL)
      .set('Authorization', 'Bearer token_04_external_user').redirects(0);
    res.status.should.equal(302);
    res.headers.location.should.equal(TICKET.downloadUrl);
    res.headers['x-content-type-options'].should.equal('nosniff');
  });

  it('S-087 · TS-17: la ruta vieja ya no existe', async () => {
    await docsAvailable();
    fakeBus.moduleReply(METHOD, success(TICKET));
    const res = await get(`/api/opus/docs/attachments/${ATT_ID}`);
    res.status.should.equal(404);
    (res.headers.location === undefined).should.be.true();
    fakeBus.moduleSent.length.should.equal(0);
  });
});
