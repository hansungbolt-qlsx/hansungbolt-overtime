import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export type Session = {
  userId: string;
  username: string;
  fullName: string;
  // qlsx (user 24/7): nhân viên QLSX — xem KHSX + in phiếu (KHSX/DCCD đủ 4 CĐ),
  // xem Máy dừng + Tổng hợp tăng ca; KHÔNG in tem, KHÔNG đăng ký tăng ca
  role: 'admin' | 'leader' | 'worker' | 'qlsx';
  // CO = Coating (anh Hữu 05/10/2026) — danh mục ở lib/departments.ts
  department: 'HD' | 'RL' | 'QLSX' | 'CO' | null;
  // Đã tích "Ghi nhớ đăng nhập" → middleware tự gia hạn 400 ngày (anh Hữu 06/10/2026)
  remember?: boolean;
};

export const SESSION_COOKIE = 'session';
const SESSION_TTL_DAYS = 7;
// 400 ngày = trần cookie của Chrome; gia hạn trượt ở middleware nên dùng thường xuyên là không phải đăng nhập lại
const SESSION_REMEMBER_TTL_DAYS = 400;
// Gia hạn tối đa 1 lần/ngày/máy (khỏi đặt cookie mới ở mọi request)
export const SESSION_RENEW_AFTER_SEC = 24 * 60 * 60;

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function signSession(session: Session): Promise<string> {
  // Bỏ iat/exp cũ nếu session đến từ verifySession (lúc gia hạn)
  const { iat: _iat, exp: _exp, ...claims } = session as Session & { iat?: number; exp?: number };
  void _iat; void _exp;
  return new SignJWT(claims as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_REMEMBER_TTL_DAYS}d`)
    .sign(secret);
}

export async function verifySession(token: string): Promise<Session & { iat?: number }> {
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as Session & { iat?: number };
}

export const SESSION_MAX_AGE = SESSION_TTL_DAYS * 24 * 60 * 60;
export const SESSION_REMEMBER_MAX_AGE = SESSION_REMEMBER_TTL_DAYS * 24 * 60 * 60;
