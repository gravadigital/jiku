import 'mocha';
import 'should';
import express from 'express';
import request from 'supertest';
import { redirectToModuleDownload } from '../../lib/modules/docs/download';

describe('lib/modules/docs/download (S-078)', () => {
  it('S-078 · redirectToModuleDownload responde 302 sin cuerpo ni Content-Disposition', async () => {
    const app = express();
    app.get('/x', (_req, res) =>
      redirectToModuleDownload(res, { id: 'a', downloadUrl: 'https://s3.example/att?sig=1', expiresIn: 300 }));
    const res = await request(app).get('/x');
    res.status.should.equal(302);
    res.headers.location.should.equal('https://s3.example/att?sig=1');
    res.headers['x-content-type-options'].should.equal('nosniff');
    res.headers.should.not.have.property('content-disposition');
    res.text.should.equal('');
  });
});
