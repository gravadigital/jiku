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
 *
 * NO SE INVOCA `publicPaths('put')`: la interfaz `PublicPath` no declara `put`, así que
 * `(publicPath as any)['put']` es `undefined` y el `.map` lanza `TypeError`. Ese método nunca
 * se llama desde `app.ts` (instala solo get/patch/post/delete) y el `PUT` de la api se cubre
 * por la cadena propia de su ruta — ver `tests/routes/auth-global.test.ts`.
 */
describe('config/public.ts — el mecanismo de exenciones de validateToken', () => {
  // Los cuatro métodos que `app.ts:29-32` instala globalmente. No hay un quinto.
  const METHODS = ['get', 'patch', 'post', 'delete'];

  describe('con la lista de exenciones vacía, el regex no exime ningún path', () => {
    METHODS.forEach((method) => {
      it(`matchea un path arbitrario para '${method}', así que validateToken se instala para todo`, () => {
        publicPaths(method).test('/api/cualquier/cosa').should.be.true();
      });
    });

    // El path que ESTABA exento hasta S-009. Que ahora matchee es lo que produce el 401 antes
    // del router: `validateToken` corre arriba del montaje de rutas (`app.ts:29-32` vs 35-37).
    it("matchea el path que estaba exento: '/api/opus/attachments/123/public'", () => {
      publicPaths('get').test('/api/opus/attachments/123/public').should.be.true();
    });
  });

  describe('ninguna exención declarada', () => {
    METHODS.forEach((method) => {
      // `test()` prueba que ESTE path no está exento; `source` prueba que NINGUNO lo está.
      // Esta es la aserción que falla si alguien repone una exención para otro path.
      it(`el source del regex de '${method}' no contiene ningún lookahead negativo`, () => {
        publicPaths(method).source.should.not.containEql('(?!');
      });

      it(`el source del regex de '${method}' es exactamente '^\\/.*'`, () => {
        publicPaths(method).source.should.equal('^\\/.*');
      });
    });
  });
});
