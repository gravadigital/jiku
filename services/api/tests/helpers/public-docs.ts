import 'should';
import { Application } from 'express';
import request from 'supertest';
import { PUBLIC_DOCS_HEADERS } from '../../lib/modules/docs/public-page';
import { PUBLIC_DOCS_RATE_STORE } from '../../lib/utils/middlewares/public-docs';
import { ATT_ID, DOC_ID, SHARE_ID } from './docs-module';

export const PUBLIC_URL = 'http://127.0.0.1:3100';
export const PUBLIC_HOST = '127.0.0.1:3100';
export const TOKEN = 'jds_' + 'A'.repeat(43);
export const UA = 'Mozilla/5.0 (S-080)';
export const CSP =
  "default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

export const RESOLVED = {
  shareId: SHARE_ID,
  documentId: DOC_ID,
  title: 'Acta de kickoff',
  version: 3,
  html:
    '<h1>Acta</h1><p>Kickoff con Acme.</p><img src="/p/docs/' + TOKEN + '/attachments/' + ATT_ID + '" alt="diagrama">',
  attachments: [{ id: ATT_ID, fileName: 'diagrama.png', mimeType: 'image/png' }],
};

/** GET al host público, sin sesión y sin seguir redirecciones. */
export function publicGet(app: Application, url: string) {
  return request(app).get(url).set('Host', PUBLIC_HOST).set('User-Agent', UA).redirects(0);
}

/** Las cinco cabeceras de solo lectura con sus valores exactos, y ninguna cookie. */
export function shouldHavePublicHeaders(res: request.Response) {
  res.headers['content-security-policy'].should.equal(CSP);
  res.headers['x-robots-tag'].should.equal('noindex');
  res.headers['referrer-policy'].should.equal('no-referrer');
  res.headers['cache-control'].should.equal('private, no-store');
  res.headers['x-content-type-options'].should.equal('nosniff');
  (res.headers['set-cookie'] === undefined).should.be.true();
  PUBLIC_DOCS_HEADERS['Content-Security-Policy'].should.equal(CSP);
}

export function resetPublicRateLimit() {
  PUBLIC_DOCS_RATE_STORE.resetAll();
}
