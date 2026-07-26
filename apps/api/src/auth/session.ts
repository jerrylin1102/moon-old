import { createHash } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { env } from '../env';

/**
 * Session。
 *
 * 用自己簽的 JWT 放在 httpOnly cookie：前端 JavaScript 讀不到，
 * 所以就算頁面上有 XSS 也偷不走登入狀態。Google 的 ID token 只在登入那一刻用一次，
 * 之後不再保留。
 */

const COOKIE = 'moon_session';
const MAX_AGE_DAYS = 30;
const secret = new TextEncoder().encode(env.SESSION_SECRET);

export async function issueSession(reply: FastifyReply, userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_DAYS}d`)
    .sign(secret);

  reply.setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_DAYS * 24 * 60 * 60,
  });
}

export function clearSession(reply: FastifyReply): void {
  reply.clearCookie(COOKIE, { path: '/' });
}

export type SessionUser = typeof schema.users.$inferSelect;

/** 讀出目前登入者；沒登入或 token 過期都回 null，呼叫端自己決定要不要擋 */
export async function currentUser(request: FastifyRequest): Promise<SessionUser | null> {
  const token = request.cookies?.[COOKIE];
  if (!token || !db) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.sub;
    if (!userId) return null;

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    return user ?? null;
  } catch {
    // 簽章不對、過期、被竄改——一律當成沒登入
    return null;
  }
}

/**
 * 排行榜上的識別碼。暱稱可以重複，靠這三碼區分是誰。
 * 對訪客與會員都適用，因為兩者都有一個穩定的 id。
 */
export function identityCode(id: string): string {
  return createHash('sha256').update(id).digest('hex').slice(0, 3);
}

/**
 * 管理員 session。跟一般使用者 session 分開一支 cookie、分開簽發，
 * 免得兩種身分的驗證邏輯混在一起——一般使用者不該因為拿到管理員 cookie 就變成管理員。
 * 效期比一般 session 短很多：這是後台，不是給人長期掛著的。
 */
const ADMIN_COOKIE = 'moon_admin';
const ADMIN_MAX_AGE_HOURS = 12;

export async function issueAdminSession(reply: FastifyReply): Promise<void> {
  const token = await new SignJWT({ admin: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_MAX_AGE_HOURS}h`)
    .sign(secret);

  reply.setCookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: ADMIN_MAX_AGE_HOURS * 60 * 60,
  });
}

export function clearAdminSession(reply: FastifyReply): void {
  reply.clearCookie(ADMIN_COOKIE, { path: '/' });
}

export async function isAdminAuthenticated(request: FastifyRequest): Promise<boolean> {
  const token = request.cookies?.[ADMIN_COOKIE];
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.admin === true;
  } catch {
    return false;
  }
}
