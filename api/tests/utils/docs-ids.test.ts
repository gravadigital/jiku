import 'mocha';
import 'should';
import { isUlid, joiUlid, respondDocsNotFound } from '../../lib/modules/docs/ids';
import { ATT_ID, DOC_ID, FOLDER_ID } from '../helpers/docs-module';

describe('lib/modules/docs/ids (S-078)', () => {
  it('S-078 · isUlid acepta ULID válidos', () => {
    isUlid(DOC_ID).should.equal(true);
  });

  it('S-078 · isUlid rechaza todo lo demás', () => {
    for (const v of ['', DOC_ID.toLowerCase(), DOC_ID.slice(1), DOC_ID + 'A', 'I'.repeat(26), 'L'.repeat(26),
      'O'.repeat(26), 'U'.repeat(26), ATT_ID + '.>', '*', undefined, 12, null]) {
      isUlid(v).should.equal(false);
    }
  });

  it('S-078 · joiUlid valida la forma', () => {
    (joiUlid().validate('abc').error === undefined).should.equal(false);
    (joiUlid().validate(FOLDER_ID).error === undefined).should.equal(true);
  });

  it('S-079 · TS-50 / S-078 · respondDocsNotFound arma el 404 de cada recurso', () => {
    const cases: Array<[any, string]> = [
      ['document_not_found', 'Documento no encontrado'],
      ['folder_not_found', 'Carpeta no encontrada'],
      ['attachment_not_found', 'Adjunto no encontrado'],
      ['share_not_found', 'Link compartido no encontrado'],
    ];
    for (const [code, message] of cases) {
      const out: any = {};
      const res: any = {
        status(n: number) { out.status = n; return this; },
        json(b: unknown) { out.body = b; return this; },
      };
      respondDocsNotFound(res, code);
      out.status.should.equal(404);
      out.body.should.deepEqual({ code, message });
    }
  });
});
