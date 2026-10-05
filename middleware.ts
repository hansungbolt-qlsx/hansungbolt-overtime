import { NextResponse, type NextRequest } from 'next/server';
import {
  SESSION_COOKIE,
  SESSION_REMEMBER_MAX_AGE,
  SESSION_RENEW_AFTER_SEC,
  signSession,
  verifySession,
  type Session,
} from '@/lib/auth';

// Đã tích "Ghi nhớ đăng nhập" → mỗi ngày mở app lần đầu thì cấp lại cookie 400 ngày (anh Hữu 06/10/2026).
// Phiên cũ (trước 06/10, không có cờ remember) không gia hạn — đăng nhập lại 1 lần có tích ô là được.
async function renewIfRemembered(res: NextResponse, session: Session & { iat?: number }): Promise<NextResponse> {
  if (!session.remember) return res;
  const age = Math.floor(Date.now() / 1000) - (session.iat ?? 0);
  if (age < SESSION_RENEW_AFTER_SEC) return res;
  res.cookies.set(SESSION_COOKIE, await signSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_REMEMBER_MAX_AGE,
    path: '/',
  });
  return res;
}

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
      return renewIfRemembered(NextResponse.redirect(new URL('/register', req.url)), session);
    }
    if (pathname.startsWith('/register') && session.role === 'admin') {
      return renewIfRemembered(NextResponse.redirect(new URL('/dashboard', req.url)), session);
    }
    return renewIfRemembered(NextResponse.next(), session);
  } catch {
    const res = NextResponse.redirect(new URL('/login', req.url));
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
}

export const config = {
  matcher: [
    // api/overtime-export: agent kéo tăng ca (tự check Bearer AGENT_SECRET như print-jobs)
    '/((?!_next/static|_next/image|favicon.ico|api/auth|api/labels/cleanup|api/registrations/cleanup|api/print-jobs|api/overtime-export).*)',
  ],
};
