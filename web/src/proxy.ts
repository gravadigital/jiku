// proxy.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import type { NextRequest } from 'next/server';

const redirections: Record<string, string> = {
  '/': '/projects',
};

export async function proxy(req: NextRequest) {
  const { user } = (await auth()) ?? {};
  const isLoggedIn = !!user;

  const pathname = req.nextUrl.pathname;
  const isInLoginPage = pathname === '/login';

  if (isLoggedIn && isInLoginPage) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  if (!isLoggedIn && !isInLoginPage) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (redirections[pathname]) {
    return NextResponse.redirect(new URL(redirections[pathname], req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
};
