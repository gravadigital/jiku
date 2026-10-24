import 'mocha';
import 'should';
import publicPaths from '../../config/public';

/**
 * Test del MECANISMO de exenciones de autenticación, no de un endpoint.
 *
 * ADR-008 dejó registrado el riesgo "una exención mal escrita en la regex cubre más paths de
 * los previstos" con la mitigación "ninguna automática hoy: un test que verifique que
 * exactamente los paths esperados quedan exentos sería la verificación correcta". Este es ese
 * test, y llega justo cuando pasa a hacer falta: hasta REQ-002 el comportamiento de
 * `config/public.ts` se probaba de rebote por el único endpoint público, que S-009 eliminó.
 * Sin este archivo la cobertura del deny-by-default sería cero.
 *
 * `publicPath` no está exportado, así que las aserciones van sobre `publicPaths(method)`, que
 * es la superficie que `app.ts` realmente consume. No es un workaround: es la aserción
 * correcta, porque lo que importa no es el contenido de la lista sino el regex que produce.
 *
 * Vive en `tests/utils/` porque no necesita base de datos: corre con `npm run test:unit`.
 */
describe('config/public.ts — el mecanismo de exenciones de validateToken', () => {
  describe('los métodos sin exención no eximen ningún path', () => {
    ['patch', 'post', 'put', 'delete'].forEach((method) => {
      it(`matchea un path arbitrario para '${method}', así que validateToken se instala para todo`, () => {
        publicPaths(method).test('/api/cualquier/cosa').should.be.true();
        publicPaths(method).test('/p/docs/jds_x').should.be.true();
      });
    });

    // El path que ESTABA exento hasta S-009. Que ahora matchee es lo que produce el 401 antes
    // del router: `validateToken` corre arriba del montaje de rutas.
    it("matchea el path que estaba exento: '/api/opus/attachments/123/public'", () => {
      publicPaths('get').test('/api/opus/attachments/123/public').should.be.true();
    });
  });

  describe('exactamente una exención: GET /p/docs/ (REQ-016 / S-080, DD-10)', () => {
    ['patch', 'post', 'put', 'delete'].forEach((method) => {
      it(`el source del regex de '${method}' es exactamente '^\\/.*', sin lookahead negativo`, () => {
        publicPaths(method).source.should.equal('^\\/.*');
        publicPaths(method).source.should.not.containEql('(?!');
      });
    });

    it("S-080 · TS-20: 'get' exime /p/docs/ y nada más", () => {
      const re = publicPaths('get');
      re.source.should.equal('^\\/(?!p\\/docs\\/).*');
      re.test('/p/docs/jds_' + 'A'.repeat(43)).should.be.false();
      re.test('/P/DOCS/x').should.be.false();
      re.test('/api/p/docs/x').should.be.true();
      re.test('/p/docsx').should.be.true();
      re.test('/api/docs/documents').should.be.true();
      re.test('/api/opus/attachments/123/public').should.be.true();
    });
  });
});
