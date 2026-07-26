import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../db/client';
import { env } from '../env';

/**
 * 審核後台。三層審核的最後一層——只有這裡能把投稿改成 approved。
 * 沒設 ADMIN_TOKEN 就整組不掛載，避免不小心開了一個沒有保護的後台。
 */

function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // 長度不同時 timingSafeEqual 會丟例外，先擋掉
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!env.ADMIN_TOKEN || !tokenMatches(token, env.ADMIN_TOKEN)) {
    await reply.code(401).send({ error: '需要管理者權杖' });
  }
}

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

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  if (!env.ADMIN_TOKEN) {
    app.log.warn('未設定 ADMIN_TOKEN，審核後台不啟用');
    return;
  }

  app.addHook('onRequest', requireAdmin);

  /** 待審清單，附上自動過濾的結果供參考 */
  app.get('/admin/submissions', async (request, reply) => {
    if (!db) return reply.code(503).send({ error: '這台沒有接資料庫' });

    const status = z
      .enum(['pending', 'approved', 'rejected'])
      .catch('pending')
      .parse((request.query as { status?: string })?.status);

    const rows = await db
      .select()
      .from(schema.submissions)
      .where(eq(schema.submissions.status, status))
      .orderBy(desc(schema.submissions.createdAt))
      .limit(100);

    return { status, count: rows.length, submissions: rows };
  });

  /** 檢舉清單。附上被檢舉內容與作者，方便判斷 */
  app.get('/admin/reports', async (_request, reply) => {
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
  app.get('/admin/blocked', async (_request, reply) => {
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
  app.post('/admin/unblock', async (request, reply) => {
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

  /** 核准或退件。只有這個端點能產生 approved */
  app.post('/admin/review', async (request, reply) => {
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
      .where(and(eq(schema.submissions.id, id), eq(schema.submissions.status, 'pending')))
      .returning({ id: schema.submissions.id, status: schema.submissions.status });

    if (updated.length === 0) {
      return reply.code(404).send({ error: '找不到這筆待審投稿（可能已經審過了）' });
    }

    return { ok: true, id, status: decision };
  });
}
