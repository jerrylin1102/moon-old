import type { FastifyInstance } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../db/client';
import { authEnabled, env, minioEnabled } from '../env';
import { clearSession, currentUser, identityCode, issueSession } from '../auth/session';
import { checkNickname } from '../moderation/rules';
import { cacheAvatar } from '../storage/minio';

const client = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

const loginSchema = z.object({ credential: z.string().min(20) });
const patchMeSchema = z.object({
  displayName: z.string().trim().min(1).max(16).optional(),
  emailOptIn: z.boolean().optional(),
  introSeen: z.boolean().optional(),
});

/** 前端需要知道的自己，刻意不含 email 以外的敏感欄位 */
function publicUser(user: typeof schema.users.$inferSelect) {
  return {
    id: user.id,
    displayName: user.displayName,
    code: identityCode(user.id),
    avatarUrl: user.avatarUrl,
    email: user.email,
    emailOptIn: user.emailOptIn,
    introSeen: user.introSeen,
    blocked: user.blocked,
    blockedReason: user.blocked ? user.blockedReason : null,
  };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /** 前端用這支決定登入按鈕要不要顯示 */
  app.get('/api/auth/config', async () => ({
    googleClientId: env.GOOGLE_CLIENT_ID ?? null,
    enabled: authEnabled,
  }));

  /**
   * 用 Google ID token 換自己的 session。
   * verifyIdToken 會驗簽章、發行者與 aud——偽造的 token 過不了這關。
   */
  app.post(
    '/api/auth/google',
    { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } },
    async (request, reply) => {
      if (!client || !db) return reply.code(503).send({ error: '這台沒有開放登入' });

      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: '缺少 credential' });

      let payload;
      try {
        const ticket = await client.verifyIdToken({
          idToken: parsed.data.credential,
          audience: env.GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
      } catch (error) {
        request.log.warn({ err: error }, 'Google ID token 驗證失敗');
        return reply.code(401).send({ error: '登入驗證沒過' });
      }

      if (!payload?.sub || !payload.email) {
        return reply.code(401).send({ error: '這個 Google 帳號沒有可用的 email' });
      }

      const fallbackName = (payload.name ?? payload.email.split('@')[0] ?? '香客').slice(0, 16);

      const [user] = await db
        .insert(schema.users)
        .values({
          googleSub: payload.sub,
          email: payload.email,
          displayName: fallbackName,
          avatarUrl: payload.picture ?? null,
        })
        .onConflictDoUpdate({
          target: schema.users.googleSub,
          // 重新登入時更新 email 與頭像，但不覆蓋使用者自己改過的暱稱
          set: { email: payload.email, avatarUrl: payload.picture ?? null, lastSeenAt: new Date() },
        })
        .returning();

      if (!user) return reply.code(500).send({ error: '建立帳號失敗' });

      await issueSession(reply, user.id);

      // 頭像快取進 MinIO：非同步進行，不擋這次登入的回應。
      // 這次回應仍然是 Google 的原始網址，快取完成後下次登入／讀取就會是 MinIO 網址。
      if (minioEnabled && payload.picture) {
        const userId = user.id;
        void cacheAvatar(payload.picture, userId).then((cachedUrl) => {
          if (cachedUrl && db) {
            void db.update(schema.users).set({ avatarUrl: cachedUrl }).where(eq(schema.users.id, userId));
          }
        });
      }

      return { user: publicUser(user) };
    },
  );

  /**
   * 開發用假登入。條件極嚴：必須同時是 development 且明確設定 ALLOW_DEV_LOGIN=true。
   * 正式環境這支根本不會被掛載——沒有 flag 就沒有這個路由。
   */
  if (env.NODE_ENV === 'development' && env.ALLOW_DEV_LOGIN) {
    app.log.warn('ALLOW_DEV_LOGIN 已開啟：/api/auth/dev-login 可用。正式環境絕對不要開');

    app.post('/api/auth/dev-login', async (request, reply) => {
      if (!db) return reply.code(503).send({ error: '這台沒有接資料庫' });

      const body = z
        .object({ name: z.string().trim().min(1).max(16).default('測試香客') })
        .safeParse(request.body ?? {});
      const name = body.success ? body.data.name : '測試香客';
      const sub = `dev-${name}`;

      const [user] = await db
        .insert(schema.users)
        .values({ googleSub: sub, email: `${sub}@example.test`, displayName: name })
        .onConflictDoUpdate({ target: schema.users.googleSub, set: { lastSeenAt: new Date() } })
        .returning();

      if (!user) return reply.code(500).send({ error: '建立帳號失敗' });
      await issueSession(reply, user.id);
      return { user: publicUser(user) };
    });
  }

  app.post('/api/auth/logout', async (_request, reply) => {
    clearSession(reply);
    return { ok: true };
  });

  /** 目前登入者。沒登入回 { user: null }，不是 401——前端要靠它決定畫面 */
  app.get('/api/me', async (request) => {
    const user = await currentUser(request);
    return { user: user ? publicUser(user) : null };
  });

  /** 改暱稱、email 通知開關、教學已讀狀態 */
  app.patch('/api/me', async (request, reply) => {
    if (!db) return reply.code(503).send({ error: '這台沒有接資料庫' });

    const user = await currentUser(request);
    if (!user) return reply.code(401).send({ error: '請先登入' });

    const parsed = patchMeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: '格式不對', issues: parsed.error.issues.map((i) => i.message) });
    }

    const { displayName, emailOptIn, introSeen } = parsed.data;

    if (displayName !== undefined) {
      // 暱稱會被別人看到，一樣要過濾廣告與辱罵
      const flags = checkNickname(displayName);
      if (flags.length > 0) return reply.code(422).send({ error: '這個暱稱不能用，換一個吧。' });
    }

    const [updated] = await db
      .update(schema.users)
      .set({
        ...(displayName !== undefined ? { displayName } : {}),
        ...(emailOptIn !== undefined ? { emailOptIn } : {}),
        ...(introSeen !== undefined ? { introSeen } : {}),
        lastSeenAt: new Date(),
      })
      .where(eq(schema.users.id, user.id))
      .returning();

    return { user: updated ? publicUser(updated) : publicUser(user) };
  });
}
