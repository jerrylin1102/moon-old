import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { deityDomainSchema, wishCategorySchema } from '@moon/shared';
import { db, schema } from '../db/client';
import { adminEnabled, env } from '../env';
import { clearAdminSession, isAdminAuthenticated, issueAdminSession } from '../auth/session';
import { invalidate } from '../ttlCache';
import { WISH_BANK_CACHE_KEY } from './wishBank';

/** 跟 routes/wishes.ts 共用同一把 key，審核後立刻讓玩家看到最新結果，不用等 TTL 過期 */
const APPROVED_CACHE_KEY = 'wishes:approved';

/**
 * 審核後台。標準帳號密碼登入，換一個 httpOnly session cookie——
 * 不是貼權杖到輸入框那種。
 * 沒同時設 ADMIN_USERNAME 與 ADMIN_PASSWORD 就整組不掛載，
 * 避免不小心開了一個只驗一半的後台。
 */

function safeEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // 長度不同時 timingSafeEqual 會丟例外，先擋掉
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!(await isAdminAuthenticated(request))) {
    await reply.code(401).send({ error: '請先登入管理後台' });
  }
}

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const reviewSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  note: z.string().max(200).optional(),
  resolutions: z
    .object({
      approve: z.string().min(1).max(200),
      reject: z.string().min(1).max(200),
      transfer: z.string().min(1).max(200),
    })
    .optional(),
});

const wishBankResolutionsSchema = z.object({
  approve: z.string().min(1).max(200),
  reject: z.string().min(1).max(200),
  transfer: z.string().min(1).max(200),
});

const wishBankCreateSchema = z.object({
  legacyId: z.string().min(1).max(64),
  category: wishCategorySchema,
  domain: deityDomainSchema,
  text: z.string().min(4).max(140),
  intensity: z.number().int().min(1).max(3),
  tags: z.array(z.string()).default([]),
  resolutions: wishBankResolutionsSchema,
  followUp: z.string().max(64).optional(),
  poolType: z.enum(['official', 'story']).default('official'),
});

const wishBankUpdateSchema = wishBankCreateSchema.partial().extend({
  active: z.boolean().optional(),
});

/** Postgres 的 unique violation 錯誤碼 */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  /** 前端用這支決定要顯示登入表單還是「這台沒開後台」 */
  app.get('/admin/session', async (request) => ({
    enabled: adminEnabled,
    authenticated: adminEnabled && (await isAdminAuthenticated(request)),
  }));

  app.post(
    '/admin/login',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      if (!adminEnabled || !env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
        return reply.code(503).send({ error: '這台沒有開放後台' });
      }

      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: '請輸入帳號密碼' });

      const { username, password } = parsed.data;
      const ok =
        safeEqual(username, env.ADMIN_USERNAME) && safeEqual(password, env.ADMIN_PASSWORD);

      if (!ok) return reply.code(401).send({ error: '帳號或密碼錯誤' });

      await issueAdminSession(reply);
      return { ok: true };
    },
  );

  app.post('/admin/logout', async (_request, reply) => {
    clearAdminSession(reply);
    return { ok: true };
  });

  if (!adminEnabled) {
    app.log.warn('未設定 ADMIN_USERNAME / ADMIN_PASSWORD，審核後台不啟用');
    return;
  }

  // 以下路由都要先登入——用子作用域掛 hook，才不會連 /admin/login 都被自己擋住
  await app.register(async (protectedApp) => {
    protectedApp.addHook('onRequest', requireAdmin);

    /** 投稿清單。願望預設一投稿就直接發佈，這裡是給後台事後檢視、必要時下架用的 */
    protectedApp.get('/admin/submissions', async (request, reply) => {
      if (!db) return reply.code(503).send({ error: '這台沒有接資料庫' });

      const statusParam = (request.query as { status?: string })?.status;
      const status = z.enum(['pending', 'approved', 'rejected', 'all']).catch('all').parse(statusParam);

      const rows = await db
        .select()
        .from(schema.submissions)
        .where(status === 'all' ? undefined : eq(schema.submissions.status, status))
        .orderBy(desc(schema.submissions.createdAt))
        .limit(200);

      return { status, count: rows.length, submissions: rows };
    });

    /** 檢舉清單。附上被檢舉內容與作者，方便判斷 */
    protectedApp.get('/admin/reports', async (_request, reply) => {
      if (!db) return reply.code(503).send({ error: '這台沒有接資料庫' });

      const rows = await db
        .select({
          id: schema.reports.id,
          targetType: schema.reports.targetType,
          targetId: schema.reports.targetId,
          reason: schema.reports.reason,
          createdAt: schema.reports.createdAt,
          authorId: schema.reports.targetAuthorId,
          authorName: schema.users.displayName,
          authorBlocked: schema.users.blocked,
        })
        .from(schema.reports)
        .innerJoin(schema.users, eq(schema.users.id, schema.reports.targetAuthorId))
        .orderBy(desc(schema.reports.createdAt))
        .limit(200);

      return { reports: rows };
    });

    /** 封鎖清單，連同這個人送過的申訴一起顯示 */
    protectedApp.get('/admin/blocked', async (_request, reply) => {
      if (!db) return reply.code(503).send({ error: '這台沒有接資料庫' });

      const users = await db
        .select({
          id: schema.users.id,
          displayName: schema.users.displayName,
          email: schema.users.email,
          blockedAt: schema.users.blockedAt,
          blockedReason: schema.users.blockedReason,
        })
        .from(schema.users)
        .where(eq(schema.users.blocked, true))
        .orderBy(desc(schema.users.blockedAt));

      const appeals = await db
        .select()
        .from(schema.appeals)
        .orderBy(desc(schema.appeals.createdAt))
        .limit(200);

      return {
        users: users.map((u) => ({
          ...u,
          appeals: appeals.filter((a) => a.userId === u.id),
        })),
      };
    });

    /** 手動解鎖。自動封鎖只能由人工解除，這是唯一的出口 */
    protectedApp.post('/admin/unblock', async (request, reply) => {
      if (!db) return reply.code(503).send({ error: '這台沒有接資料庫' });

      const parsed = z.object({ userId: z.string().uuid() }).safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: '格式不對' });

      const [user] = await db
        .update(schema.users)
        .set({ blocked: false, blockedAt: null, blockedReason: null })
        .where(eq(schema.users.id, parsed.data.userId))
        .returning({ id: schema.users.id, displayName: schema.users.displayName });

      if (!user) return reply.code(404).send({ error: '找不到這個帳號' });

      // 解鎖後把舊檢舉清掉，否則下一次被檢舉就會立刻又滿三次
      await db.delete(schema.reports).where(eq(schema.reports.targetAuthorId, parsed.data.userId));
      await db
        .update(schema.appeals)
        .set({ status: 'resolved' })
        .where(eq(schema.appeals.userId, parsed.data.userId));

      return { ok: true, user };
    });

    /**
     * 核准或退件。願望預設一投稿就已經是 approved，
     * 這支現在的角色是事後審核：可以把已發佈的內容下架，也可以反悔重新上架。
     */
    protectedApp.post('/admin/review', async (request, reply) => {
      if (!db) return reply.code(503).send({ error: '這台沒有接資料庫' });

      const parsed = reviewSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: '格式不對', issues: parsed.error.issues.map((i) => i.message) });
      }

      const { id, decision, note, resolutions } = parsed.data;
      const updated = await db
        .update(schema.submissions)
        .set({
          status: decision,
          moderationNote: note ?? null,
          reviewedAt: new Date(),
          ...(resolutions ? { resolutions } : {}),
        })
        .where(eq(schema.submissions.id, id))
        .returning({ id: schema.submissions.id, status: schema.submissions.status });

      if (updated.length === 0) {
        return reply.code(404).send({ error: '找不到這則投稿' });
      }

      invalidate(APPROVED_CACHE_KEY);
      return { ok: true, id, status: decision };
    });

    /** 題庫列表。依 poolType／category／active 篩選，預設看得到所有（含已下架的） */
    protectedApp.get('/admin/wish-bank', async (request, reply) => {
      if (!db) return reply.code(503).send({ error: '這台沒有接資料庫' });

      const query = request.query as { poolType?: string; category?: string; active?: string };
      const poolType = z.enum(['official', 'story', 'all']).catch('all').parse(query.poolType);
      const activeParam = z.enum(['true', 'false', 'all']).catch('all').parse(query.active);
      const category = wishCategorySchema.safeParse(query.category);

      const conditions = [
        poolType === 'all' ? undefined : eq(schema.wishBank.poolType, poolType),
        activeParam === 'all' ? undefined : eq(schema.wishBank.active, activeParam === 'true'),
        category.success ? eq(schema.wishBank.category, category.data) : undefined,
      ].filter((c): c is NonNullable<typeof c> => c !== undefined);

      const rows = await db
        .select()
        .from(schema.wishBank)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(schema.wishBank.createdAt))
        .limit(500);

      return { count: rows.length, wishes: rows };
    });

    /** 新增一則題目 */
    protectedApp.post('/admin/wish-bank', async (request, reply) => {
      if (!db) return reply.code(503).send({ error: '這台沒有接資料庫' });

      const parsed = wishBankCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: '格式不對', issues: parsed.error.issues.map((i) => i.message) });
      }

      try {
        const [row] = await db
          .insert(schema.wishBank)
          .values({ ...parsed.data, followUp: parsed.data.followUp ?? null })
          .returning();

        invalidate(WISH_BANK_CACHE_KEY);
        return reply.code(201).send({ ok: true, wish: row });
      } catch (err) {
        if (isUniqueViolation(err)) {
          return reply.code(409).send({ error: '這個題目 id 已經存在，換一個吧' });
        }
        throw err;
      }
    });

    /** 編輯題目內容，或切換 active（下架／重新上架） */
    protectedApp.patch('/admin/wish-bank/:id', async (request, reply) => {
      if (!db) return reply.code(503).send({ error: '這台沒有接資料庫' });

      const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: 'id 不對' });

      const parsed = wishBankUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: '格式不對', issues: parsed.error.issues.map((i) => i.message) });
      }
      if (Object.keys(parsed.data).length === 0) {
        return reply.code(400).send({ error: '沒有要更新的欄位' });
      }

      try {
        const [row] = await db
          .update(schema.wishBank)
          .set({ ...parsed.data, updatedAt: new Date() })
          .where(eq(schema.wishBank.id, params.data.id))
          .returning();

        if (!row) return reply.code(404).send({ error: '找不到這則題目' });

        invalidate(WISH_BANK_CACHE_KEY);
        return { ok: true, wish: row };
      } catch (err) {
        if (isUniqueViolation(err)) {
          return reply.code(409).send({ error: '這個題目 id 已經存在，換一個吧' });
        }
        throw err;
      }
    });

    /** 下架題目。軟刪除（active=false），不做硬刪除——避免刪掉正在被玩家遊玩中引用的題目 */
    protectedApp.delete('/admin/wish-bank/:id', async (request, reply) => {
      if (!db) return reply.code(503).send({ error: '這台沒有接資料庫' });

      const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: 'id 不對' });

      const [row] = await db
        .update(schema.wishBank)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(schema.wishBank.id, params.data.id))
        .returning({ id: schema.wishBank.id });

      if (!row) return reply.code(404).send({ error: '找不到這則題目' });

      invalidate(WISH_BANK_CACHE_KEY);
      return { ok: true };
    });
  });
}
