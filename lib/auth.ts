import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export type Session = {
  userId: string;
  username: string;
  fullName: string;
  role: 'admin' | 'leader';
  department: 'HD' | 'RL' | null;
};

export const SESSION_COOKIE = 'session';
const SESSION_TTL_DAYS = 7;

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function signSession(session: Session): Promise<string> {
  return new SignJWT(session as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_DAYS}d`)
    .sign(secret);
}

export async function verifySession(token: string): Promise<Session> {
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as Session;
}

export const SESSION_MAX_AGE = SESSION_TTL_DAYS * 24 * 60 * 60;
