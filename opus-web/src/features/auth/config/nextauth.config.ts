import NextAuth from 'next-auth';
import Zitadel from 'next-auth/providers/zitadel';

const { ZITADEL_CLIENT_ID, ZITADEL_ISSUER, ZITADEL_PROJECT_ID } = process.env;

/**
 * Configuración de NextAuth v5.
 *
 * `auth` reemplaza a `getServerSession(authOptions)` de v4: se llama sin argumentos y
 * sirve tanto en server components como en route handlers. `handlers` es lo que exporta
 * la ruta `[...nextauth]`.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      token.user ??= user;
      token.accessToken ??= account?.access_token;
      token.refreshToken ??= account?.refresh_token;
      token.expiresAt ??= (account?.expires_at ?? 0) * 1000;
      token.error = null;
      return token;
    },
    async session({ session, token }) {
      const tokenUser = token.user as {
        id: string;
        name?: string;
        email?: string;
        roles: string[];
      };
      session.user = {
        ...session.user,
        id: tokenUser.id,
        name: tokenUser.name ?? session.user?.name ?? '',
        email: tokenUser.email ?? session.user?.email ?? '',
        roles: tokenUser.roles,
      };
      session.accessToken = token.accessToken as string;
      // El middleware necesita `expiresAt` para rechazar sesiones cuyo access token ya
      // venció, así que se expone acá: en v4 lo leía del token vía getToken().
      (session as { expiresAt?: number }).expiresAt = token.expiresAt as number;
      return session;
    },
  },
  providers: [
    Zitadel({
      authorization: {
        params: {
          scope:
            'openid profile email urn:zitadel:iam:org:projects:roles ' +
            `urn:zitadel:iam:org:project:id:${ZITADEL_PROJECT_ID}:aud`,
        },
      },
      clientId: ZITADEL_CLIENT_ID || '',
      clientSecret: '', // Cliente público - usa PKCE
      issuer: ZITADEL_ISSUER || '',
      async profile(profile, tokens) {
        let name = profile.name ?? profile.preferred_username ?? '';
        let email = profile.email ?? '';

        // Si name o email vienen vacíos, los buscamos en el userinfo endpoint
        if (!name || !email) {
          try {
            const res = await fetch(`${ZITADEL_ISSUER}/oidc/v1/userinfo`, {
              headers: { Authorization: `Bearer ${tokens.access_token}` },
            });
            if (res.ok) {
              const userinfo = await res.json();
              name = name || userinfo.name || userinfo.preferred_username || '';
              email = email || userinfo.email || '';
            }
          } catch {
            // si falla el userinfo, usamos lo que tenemos
          }
        }

        return {
          id: profile.sub,
          name,
          email,
          roles: Object.keys(
            profile[`urn:zitadel:iam:org:project:${ZITADEL_PROJECT_ID}:roles`] || {}
          ),
        };
      },
    }),
  ],
});
