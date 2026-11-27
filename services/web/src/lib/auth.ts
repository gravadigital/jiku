import NextAuth from 'next-auth';
import Zitadel from 'next-auth/providers/zitadel';

const { ZITADEL_CLIENT_ID, ZITADEL_ISSUER, ZITADEL_CLIENT_SECRET, ZITADEL_PROJECT_ID } =
  process.env;

const getAccessTokenSub = (accessToken?: string): string | null => {
  if (!accessToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
    return payload.sub ?? null;
  } catch {
    return null;
  }
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: {
    strategy: 'jwt',
    maxAge: 12 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        return {
          ...token,
          user,
          accessToken: account.access_token,
          expiresAt: account.expires_at,
          zitadelSub: getAccessTokenSub(account.access_token),
        };
      }

      token.user ??= user;

      if (token.expiresAt && Date.now() > (token.expiresAt as number) * 1000) {
        console.warn('Access token has expired - user needs to re-authenticate');
        return null;
      }

      return token;
    },
    async session({ session, token }) {
      if (token.user) {
        session.user = {
          ...session.user,
          id: (token.user as { id: string }).id,
          roles: (token.user as { roles: string[] }).roles,
          zitadelId: (token.zitadelSub as string) ?? undefined,
        };
      }
      if (token.accessToken) {
        session.accessToken = token.accessToken as string;
      }
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
      clientSecret: ZITADEL_CLIENT_SECRET || '',
      issuer: ZITADEL_ISSUER || '',
      async profile(profile) {
        return {
          id: profile.sub,
          roles: Object.keys(
            profile['urn:zitadel:iam:org:project:' + `${ZITADEL_PROJECT_ID}:roles`] || {}
          ),
        };
      },
    }),
  ],
});
