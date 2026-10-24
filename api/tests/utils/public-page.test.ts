import 'mocha';
import 'should';
import { escapeHtml, PUBLIC_NOTICES, renderSharedDocument, sendPublicNotice } from '../../lib/modules/docs/public-page';

describe('S-080 · plantilla de la página pública', () => {
  it('S-080 · TS-25: escapeHtml, plantilla y páginas de excepción', () => {
    escapeHtml('<a href="x">\'&</a>').should.equal('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&lt;/a&gt;');

    const page = renderSharedDocument('T & <b>', '<p>x</p>');
    page.should.containEql('<title>T &amp; &lt;b&gt;</title>');
    page.should.containEql('<meta name="robots" content="noindex">');
    page.should.containEql('<main><p>x</p></main>');
    page.should.not.containEql('<script');

    PUBLIC_NOTICES[404].should.deepEqual({
      title: 'Este link no está disponible',
      text: 'Puede que haya vencido o que lo hayan revocado. Pedile un link nuevo a quien te lo compartió.',
    });
    PUBLIC_NOTICES[429].should.deepEqual({ title: 'Demasiados intentos', text: 'Esperá un minuto y volvé a intentar.' });
    PUBLIC_NOTICES[503].should.deepEqual({
      title: 'El documento no está disponible en este momento',
      text: 'Probá de nuevo en unos minutos.',
    });
  });

  it('sendPublicNotice usa la misma plantilla y las cinco cabeceras', () => {
    const headers: Record<string, string> = {};
    let body = '';
    let code = 0;
    const res: any = {
      set: (h: Record<string, string>) => Object.assign(headers, h),
      status: (c: number) => ((code = c), res),
      type: () => res,
      send: (b: string) => ((body = b), res),
    };
    sendPublicNotice(res, 429);
    code.should.equal(429);
    body.should.containEql('<h1>Demasiados intentos</h1>');
    Object.keys(headers).length.should.equal(5);
  });
});
