import 'next-auth';
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      roles: string[];
      zitadelId?: string;
    } & DefaultSession['user'];
    accessToken: string;
  }

  interface User {
    id: string;
    roles: string[];
    zitadelId?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    user?: {
      id: string;
      roles: string[];
    };
    accessToken?: string;
    expiresAt?: number;
    zitadelSub?: string;
  }
}
