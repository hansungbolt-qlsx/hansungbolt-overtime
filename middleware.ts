import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = req.cookies.get(SESSION_COOKIE)?.value;

  if (pathname === '/login') {
    if (token) {
      try {
        const session = await verifySession(token);
        return NextResponse.redirect(
          new URL(session.role === 'admin' ? '/dashboard' : '/register', req.url),
        );
      } catch {
        // token invalid → let user see login
      }
    }
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    const session = await verifySession(token);
    if (
      pathname.startsWith('/dashboard') &&
      !pathname.startsWith('/dashboard/registrations/') &&
      session.role !== 'admin'
    ) {
      return NextResponse.redirect(new URL('/register', req.url));
    }
    if (pathname.startsWith('/register') && session.role === 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(new URL('/login', req.url));
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth|api/labels/cleanup|api/registrations/cleanup).*)',
  ],
};
