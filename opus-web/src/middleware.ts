import { NextResponse } from 'next/server';
import { auth } from '@/features/auth/config/nextauth.config';
import type { Session } from 'next-auth';
import type { NextRequest } from 'next/server';

/**
 * Con NextAuth v5 la sesión se lee con `auth()`, no con `getToken()` de `next-auth/jwt`
 * — que en v5 está marcado explícitamente como no recomendado.
 *
 * La validación de expiración se mantiene: el callback `jwt` guarda `expiresAt` en
 * milisegundos, y una sesión con el access token vencido no sirve aunque la cookie siga
 * siendo válida.
 */
function isSessionValid(session: Session | null): boolean {
  if (!session?.user?.id) {
    return false;
  }
  const expiresAt = (session as { expiresAt?: number }).expiresAt;
  if (typeof expiresAt === 'number' && expiresAt > 0 && expiresAt <= Date.now()) {
    return false;
  }
  return true;
}

export default async function middleware(request: NextRequest) {
  // `auth` está sobrecargada en v5: sirve como wrapper de middleware y como getter de
  // sesión. Acá se usa la segunda forma, así que se acota el tipo.
  const session = (await (auth as unknown as () => Promise<Session | null>)()) ?? null;
  const isValid = isSessionValid(session);
  const isLoginPage = request.nextUrl.pathname === '/login';

  // Autenticado en /login → redirigir a inicio
  if (isValid && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // No autenticado fuera de /login → redirigir a login
  if (!isValid && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
};
