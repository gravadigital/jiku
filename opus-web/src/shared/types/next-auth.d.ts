import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      roles: string[];
    };
    accessToken: string;
  }
}

// La augmentación va sobre `@auth/core/jwt` y no sobre `next-auth/jwt`, que es solo un
// `export * from '@auth/core/jwt'`: es ahí donde vive la interfaz que ve el callback.
declare module '@auth/core/jwt' {
  interface JWT {
    /**
     * El `sub` de Zitadel, que es la clave con la que la api busca en `users`.
     *
     * No se usa `sub` a secas porque NextAuth ya lo inicializa con el UUID aleatorio que le
     * pone al usuario. Ver `features/auth/config/session-identity.ts`.
     */
    identitySub?: string;
  }
}
