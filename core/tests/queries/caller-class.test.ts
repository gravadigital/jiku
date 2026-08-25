import 'mocha';
import 'should';
import * as fs from 'fs';
import * as path from 'path';
import { CLASS_BY_ROLE, resolveCallerClass } from '../../src/queries/caller-class';

/**
 * LA CLASE DEL CALLER, EJERCITADA PURA: sin base, sin despachador y sin config cargada.
 *
 * Es el precedente que fijó S-017 con `ROLE_METHODS` / `rolesAuthorize` y por la misma razón: un
 * mapa cerrado con una regla de precedencia se prueba en sus combinaciones, y levantar una base
 * para eso solo agrega ruido. La integración —que la clase se resuelva UNA VEZ y viaje en el
 * contexto— entra por el despachador, en `caller-gate.test.ts`.
 */
describe('queries/caller-class — el mapa rol → clase, puro y sin base', () => {
  it('TS-1 · la clase del CONECTOR', () => {
    resolveCallerClass(['internal-app'])!.should.equal('connector');
  });

  it('TS-2 · la clase INTERNA, por los dos roles que la producen', () => {
    // `admin` y `user` son LA MISMA CLASE: la autorización fina por rol sigue siendo de la api
    // sobre HTTP, no del recorte de filas de core (CA-15).
    resolveCallerClass(['user'])!.should.equal('internal');
    resolveCallerClass(['admin'])!.should.equal('internal');
  });

  it('TS-3 · la clase EXTERNA', () => {
    resolveCallerClass(['external-user'])!.should.equal('external');
  });

  it('TS-4 · `admin` + `user` sigue siendo interno', () => {
    resolveCallerClass(['admin', 'user'])!.should.equal('internal');
  });

  it('TS-5 · gana el MÁS RESTRICTIVO, y el orden del array NO decide', () => {
    resolveCallerClass(['user', 'external-user'])!.should.equal('external');
    resolveCallerClass(['external-user', 'user'])!.should.equal('external');
  });

  it('TS-6 · la precedencia completa: external-user → user → internal-app', () => {
    resolveCallerClass(['internal-app', 'user'])!.should.equal('internal');
    resolveCallerClass(['internal-app', 'external-user'])!.should.equal('external');
    resolveCallerClass(['internal-app', 'user', 'external-user'])!.should.equal('external');
  });

  it('TS-7 · una lista VACÍA no produce clase', () => {
    // `null` y no una clase por defecto: sin clase no hay consulta, y el despachador responde
    // `unknown_caller` en vez de una lista vacía que se leería como "no hay datos" (CA-7).
    (resolveCallerClass([]) === null).should.be.true();
  });

  it('TS-8 · los roles SIN clase no producen clase', () => {
    // Los dos que existen en `ROLE_METHODS` y no consultan, más uno inventado. Eran tres: el
    // rol `external-publisher` estaba en esta lista y se eliminó del producto.
    for (const role of ['wizard', 'core', 'bus-observer']) {
      (resolveCallerClass([role]) === null).should.be.true();
    }
  });

  it('TS-9 · un rol desconocido no altera la clase de los conocidos', () => {
    resolveCallerClass(['wizard', 'user'])!.should.equal('internal');
  });

  it('(gate) el mapa es CERRADO: exactamente los cuatro roles que consultan', () => {
    Object.keys(CLASS_BY_ROLE)
      .sort()
      .should.deepEqual(['admin', 'external-user', 'internal-app', 'user']);
  });

  it('TS-43 · (gate) la resolución de clase NO tiene cache ni estado', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../src/queries/caller-class.ts'),
      'utf8'
    );
    // Mismo gate que TS-20b de S-017, y por el mismo criterio (CA-17): cachear reintroduce roles
    // obsoletos con una ventana no medible para ahorrar un SELECT por PK. La prosa del comentario
    // que explica por qué no hay cache queda fuera: solo se mira el código.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    /new Map|cache|Cache|ttl|TTL|memo/.test(code).should.be.false();
  });

  it('la función es PURA: dos llamadas iguales no comparten nada', () => {
    const roles = ['user', 'external-user'];

    resolveCallerClass(roles)!.should.equal('external');
    resolveCallerClass(roles)!.should.equal('external');
    // Y no muta su entrada.
    roles.should.deepEqual(['user', 'external-user']);
  });
});
