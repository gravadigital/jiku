import { describe, it, expect } from 'vitest';
import { buildSessionUser, subFromAccount } from './session-identity';

/**
 * El `id` de la sesión tiene que ser el `sub` de Zitadel, porque es la clave con la que la
 * api busca en `users` (`User.findByPk`). NextAuth v5 **pisa** el `id` que devuelve
 * `profile()` con un `crypto.randomUUID()` — está hecho a propósito y comentado en
 * `@auth/core/lib/actions/callback/oauth/callback.js:219-225`, que guarda el `sub` real en
 * `account.providerAccountId`.
 *
 * Sin esto, `session.user.id` es un UUID que no existe en `users` y la api responde
 * 404 `user_not_found` a toda suscripción.
 */
describe('identidad de la sesión', () => {
  describe('subFromAccount', () => {
    it('toma el sub de providerAccountId, que es donde NextAuth guarda el del proveedor', () => {
      const sub = subFromAccount({ providerAccountId: '338996839124566018' });

      expect(sub).toBe('338996839124566018');
    });

    it('devuelve undefined si no hay account (refrescos posteriores del token)', () => {
      expect(subFromAccount(null)).toBeUndefined();
      expect(subFromAccount(undefined)).toBeUndefined();
    });

    it('devuelve undefined si el account no trae providerAccountId', () => {
      expect(subFromAccount({})).toBeUndefined();
    });
  });

  describe('buildSessionUser', () => {
    const tokenUser = {
      id: '54f8e5ee-d4f8-4d77-afc6-0b716f96b631', // el UUID que inventa NextAuth
      name: 'Testing User Cliente',
      email: 'testing_cliente@mail.com',
      roles: ['external-user'],
    };

    it('usa el sub del token como id, no el UUID que inventa NextAuth', () => {
      const user = buildSessionUser(tokenUser, '338996839124566018', undefined);

      expect(user.id).toBe('338996839124566018');
      expect(user.id).not.toBe(tokenUser.id);
    });

    it('conserva nombre, email y roles', () => {
      const user = buildSessionUser(tokenUser, '338996839124566018', undefined);

      expect(user).toMatchObject({
        name: 'Testing User Cliente',
        email: 'testing_cliente@mail.com',
        roles: ['external-user'],
      });
    });

    it('cae al id del token cuando todavía no hay sub, para no romper el guard del middleware', () => {
      // `middleware.ts` corta con `!session?.user?.id`. Un id vacío desloguearía al usuario,
      // que es peor que un id que la api va a rechazar con 404.
      const user = buildSessionUser(tokenUser, undefined, undefined);

      expect(user.id).toBe(tokenUser.id);
    });

    it('completa nombre y email desde la sesión previa cuando el token no los trae', () => {
      const parcial = { id: 'x', roles: ['external-user'] };

      const user = buildSessionUser(parcial, '338996839124566018', {
        name: 'Desde la sesión',
        email: 'sesion@mail.com',
      });

      expect(user).toMatchObject({ name: 'Desde la sesión', email: 'sesion@mail.com' });
    });

    it('deja nombre y email como string vacío si no hay de dónde sacarlos', () => {
      const parcial = { id: 'x', roles: [] };

      const user = buildSessionUser(parcial, '338996839124566018', undefined);

      expect(user).toMatchObject({ name: '', email: '' });
    });

    it('nunca devuelve roles undefined', () => {
      const sinRoles = { id: 'x' } as { id: string; roles?: string[] };

      const user = buildSessionUser(sinRoles, '338996839124566018', undefined);

      expect(user.roles).toEqual([]);
    });
  });
});
