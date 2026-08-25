import 'mocha';
import 'should';
import { Request } from 'express';
import { buildActor } from '../../lib/utils/bus/actor';

/**
 * Unitario puro: no toca la base ni el bus, así que corre con `npm run test:unit`.
 *
 * Lo que este archivo protege NO es una función complicada —son veinte líneas— sino una
 * DECISIÓN: el sobre se arma con el claim y NUNCA con `req.user`. La fila está ahí, cargada por
 * `validateToken`, con los cinco campos y hasta con `roles`; usarla es un cambio de una línea que
 * PARECE una mejora. Por eso el último test pasa un `req.user` que contradice el claim.
 */
describe('buildActor', () => {
  /** Un `req` mínimo con lo que `validateToken` deja para una ruta autenticada. */
  function reqWith(decodedToken: Record<string, unknown>, roles?: string[], user?: unknown): Request {
    return { decodedToken, decodedTokenRoles: roles, user } as unknown as Request;
  }

  // El caso de todos los días: el token mock no trae claims de perfil, así que el sobre sale
  // con dos claves y NADA más. El `deepEqual` sobre las claves es lo que prueba que no viaja
  // basura: un `have.property('id')` dejaría pasar un `name: undefined`.
  it('con `sub` y roles pero sin perfil devuelve exactamente `{ id, roles }`', () => {
    const actor = buildActor(reqWith({ sub: 'zitadel-sub-01' }, ['user']));

    (actor as any).should.deepEqual({ id: 'zitadel-sub-01', roles: ['user'] });
    Object.keys(actor!).sort().should.deepEqual(['id', 'roles']);
  });

  // TS-8 del plan, en su forma unitaria: los tres claims de perfil viajan, y `preferred_username`
  // —que es como se llama en OIDC— sale como `username`, que es como se llama en el sobre y en la
  // columna. Esa traducción vive acá, en `lib/utils/bus/`, y no dispersa en los handlers.
  it('con los tres claims de perfil devuelve los cinco campos y mapea preferred_username', () => {
    const actor = buildActor(
      reqWith(
        {
          sub: 'zitadel-sub-05',
          name: 'Ana Pérez',
          preferred_username: 'ana@grava.digital',
          email: 'ana@grava.digital',
        },
        ['user']
      )
    );

    (actor as any).should.deepEqual({
      id: 'zitadel-sub-05',
      roles: ['user'],
      name: 'Ana Pérez',
      username: 'ana@grava.digital',
      email: 'ana@grava.digital',
    });
  });

  // TS-9: un claim vacío o de otro tipo se trata como AUSENTE, y ausente quiere decir que LA
  // CLAVE NO ESTÁ — no que esté con `undefined`. De eso depende que un sobre sin `name` no borre
  // el nombre que la fila de `users` ya tenía: el espejo de core distingue las dos cosas.
  it('un claim de perfil vacío o de otro tipo no produce la clave', () => {
    const actor = buildActor(reqWith({ sub: 's1', name: '', email: 42 }, ['user']));

    (actor as any).should.deepEqual({ id: 's1', roles: ['user'] });
    actor!.should.not.have.property('name');
    actor!.should.not.have.property('email');
  });

  // `Actor.roles` es OBLIGATORIO en el contrato: sin claim va `[]`, nunca `undefined`. Un rol
  // vacío no autoriza nada (ADR-008), que es el resultado correcto y no un error.
  it('sin claim de roles devuelve `roles: []`, nunca undefined', () => {
    const actor = buildActor(reqWith({ sub: 's1' }));

    actor!.roles.should.deepEqual([]);
  });

  // TS-21: sin token verificado no hay sobre. Hoy es inalcanzable —las cuatro listas de
  // `config/public.ts` están vacías—, pero omitir el sobre deja EXACTAMENTE el comportamiento de
  // hoy en core (rama 2 de `resolveActor`) en vez de un 500. Es la dirección segura.
  it('devuelve undefined sin `req`, sin `decodedToken` o con `sub` vacío', () => {
    (buildActor(undefined) === undefined).should.be.true();
    (buildActor({} as Request) === undefined).should.be.true();
    (buildActor(reqWith({ sub: '' }, ['user'])) === undefined).should.be.true();
  });

  // LA ASERCIÓN QUE PROTEGE ADR-007. Si alguien "mejora" `buildActor` leyendo `req.user` —que
  // está ahí, cargado y a mano— este test se pone rojo. La regla es literal: "NO SE DEBEN
  // almacenar roles en la base ni derivarlos de otra fuente". Dos fuentes de identidad para lo
  // mismo terminan con la peor de las dos decidiendo.
  it('no lee `req.user` en ninguna rama', () => {
    const actor = buildActor(
      reqWith({ sub: 's1' }, ['user'], {
        id: 'OTRO-SUB',
        name: 'De la base',
        username: 'de-la-base',
        email: 'base@mail.com',
        roles: ['admin'],
      })
    );

    (actor as any).should.deepEqual({ id: 's1', roles: ['user'] });
  });
});
