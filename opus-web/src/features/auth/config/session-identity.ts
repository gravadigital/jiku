/**
 * Identidad de la sesión: de dónde sale el `id` que ve la aplicación.
 *
 * NextAuth v5 **descarta** el `id` que devuelve `profile()` y lo reemplaza por un
 * `crypto.randomUUID()`. No es un bug: está comentado en la librería
 * (`@auth/core/lib/actions/callback/oauth/callback.js:219-225`), que deja el identificador
 * real del proveedor en `account.providerAccountId` — "the user should remain independent
 * of the provider".
 *
 * Para este portal esa independencia no sirve: el `id` que la aplicación manda a la api es
 * la clave con la que `api` busca en `users` (`User.findByPk`), y ahí las filas están
 * guardadas con el `sub` de Zitadel. Un UUID da 404 `user_not_found` en toda suscripción, y
 * además rompe la comparación `subscribers.some((s) => s.id === currentUserId)`, que nunca
 * puede dar `true`.
 *
 * Por eso el `sub` se rescata de `account.providerAccountId` en el callback `jwt` (el único
 * momento en que `account` existe) y se guarda aparte en el token.
 */

/** La parte del `account` de NextAuth que nos interesa: dónde quedó el `sub` del proveedor. */
interface AccountWithProviderId {
  providerAccountId?: string | null;
}

/** Lo que el callback `jwt` guardó en `token.user`, que puede venir incompleto. */
interface TokenUser {
  id: string;
  name?: string | null;
  email?: string | null;
  roles?: string[];
}

/** Los campos de la sesión previa que se usan como fallback de nombre e email. */
interface SessionUserFallback {
  name?: string | null;
  email?: string | null;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

/**
 * Extrae el `sub` de Zitadel del `account`.
 *
 * `account` solo llega en el login; en los refrescos posteriores del token es `undefined`, y
 * por eso quien lo llama guarda el resultado con `??=`.
 */
export function subFromAccount(
  account: AccountWithProviderId | null | undefined
): string | undefined {
  return account?.providerAccountId ?? undefined;
}

/**
 * Arma el `session.user` con el `sub` como `id`.
 *
 * Si todavía no hay `sub` se cae al `id` del token (el UUID de NextAuth). Es a propósito:
 * `middleware.ts` desloguea cuando `!session?.user?.id`, así que un id vacío sacaría al
 * usuario de la aplicación — peor que un id que la api va a rechazar con un 404 visible.
 */
export function buildSessionUser(
  tokenUser: TokenUser,
  sub: string | undefined,
  previous: SessionUserFallback | undefined
): SessionUser {
  return {
    id: sub ?? tokenUser.id,
    name: tokenUser.name ?? previous?.name ?? '',
    email: tokenUser.email ?? previous?.email ?? '',
    roles: tokenUser.roles ?? [],
  };
}
