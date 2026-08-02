import type { FastifyInstance } from 'fastify';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../db/client';
import { currentUser, identityCode } from '../auth/session';
import { queueNotification } from '../notify';

/**
 * 留言、讚踩、檢舉。
 *
 * 留言需要登入——留言要能被檢舉、被通知、被追責，
 * 匿名留言等於把整套治理機制架空。
 */

/** 被不同人檢舉滿這個數字，作者就自動封鎖 */
export const REPORT_BLOCK_THRESHOLD = 3;

const commentSchema = z.object({ body: z.string().trim().min(2).max(300) });
const voteSchema = z.object({ value: z.union([z.literal(1), z.literal(-1)]) });
const reportSchema = z.object({
  targetType: z.enum(['comment', 'wish']),
  targetId: z.string().uuid(),
  reason: z.string().trim().max(200).optional(),
});

/**
 * 檢舉累積到門檻就自動封鎖作者。
 * 計算的是「幾個不同的人檢舉過這個作者」，同一人洗檢舉沒有用——
 * 資料表的 unique 約束已經擋掉同一人對同一則重複檢舉，這裡再用 distinct 收斂到人。
 */
async function maybeBlock(authorId: string): Promise<boolean> {
  if (!db) return false;

  const [{ reporters } = { reporters: 0 }] = await db
    .select({ reporters: sql<number>`count(distinct ${schema.reports.reporterId})::int` })
    .from(schema.reports)
    .where(eq(schema.reports.targetAuthorId, authorId));

  if (reporters < REPORT_BLOCK_THRESHOLD) return false;

  await db
    .update(schema.users)
    .set({
      blocked: true,
      blockedAt: new Date(),
      blockedReason: `自動封鎖：被 ${reporters} 位不同使用者檢舉`,
    })
    .where(eq(schema.users.id, authorId));

  return true;
}

export async function commentRoutes(app: FastifyInstance): Promise<void> {
  /**
   * 申訴解鎖。只有被封鎖的人需要用，所以刻意不擋 blocked——
   * 這是他唯一還能對系統說話的管道。
   */
  app.post(
    '/api/appeals',
    { config: { rateLimit: { max: 3, timeWindow: '1 day' } } },
    async (request, reply) => {
      if (!db) return reply.code(503).send({ error: '這台沒有接資料庫' });

      const user = await currentUser(request);
      if (!user) return reply.code(401).send({ error: '請先登入' });
      if (!user.blocked) return reply.code(422).send({ error: '你的帳號沒有被封鎖' });

      const parsed = z
        .object({ message: z.string().trim().min(10).max(500) })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: '請至少寫 10 個字說明你的情況' });
      }

      await db.insert(schema.appeals).values({ userId: user.id, message: parsed.data.message });
      return reply.code(202).send({ ok: true, message: '申訴送出了，管理員會看過。' });
    },
  );

  /** 某則願望的留言。已核准的願望才看得到留言 */
  app.get('/api/wishes/:id/comments', async (request, reply) => {
    if (!db) return reply.code(503).send({ error: '這台沒有接資料庫' });

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'id 不對' });

    const rows = await db
      .select({
        id: schema.comments.id,
        body: schema.comments.body,
        createdAt: schema.comments.createdAt,
        authorId: schema.comments.authorId,
        authorName: schema.users.displayName,
        up: sql<number>`coalesce(sum(case when ${schema.commentVotes.value} > 0 then 1 else 0 end), 0)::int`,
        down: sql<number>`coalesce(sum(case when ${schema.commentVotes.value} < 0 then 1 else 0 end), 0)::int`,
      })
      .from(schema.comments)
      .innerJoin(schema.users, eq(schema.users.id, schema.comments.authorId))
      .leftJoin(schema.commentVotes, eq(schema.commentVotes.commentId, schema.comments.id))
      .where(
        and(eq(schema.comments.submissionId, params.data.id), isNull(schema.comments.hiddenAt)),
      )
      .groupBy(schema.comments.id, schema.users.displayName)
      .orderBy(desc(schema.comments.createdAt))
      .limit(100);

    return {
      comments: rows.map((r) => ({
        id: r.id,
        body: r.body,
        createdAt: r.createdAt,
        author: { name: r.authorName, code: identityCode(r.authorId) },
        up: r.up,
        down: r.down,
      })),
    };
  });

  /** 留言。留言內容跑跟投稿同一套過濾 */
  app.post(
    '/api/wishes/:id/comments',
    { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } },
    async (request, reply) => {
      if (!db) return reply.code(503).send({ error: '這台沒有接資料庫' });

      const user = await currentUser(request);
      if (!user) return reply.code(401).send({ error: '留言要先登入' });
      if (user.blocked) {
        return reply.code(403).send({ error: 'blocked', message: '你的帳號目前無法留言。' });
      }

      const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
      const parsed = commentSchema.safeParse(request.body);
      if (!params.success || !parsed.success) return reply.code(400).send({ error: '格式不對' });

      const [wish] = await db
        .select({ id: schema.submissions.id, authorId: schema.submissions.authorId })
        .from(schema.submissions)
        .where(
          and(
            eq(schema.submissions.id, params.data.id),
            eq(schema.submissions.status, 'approved'),
            isNull(schema.submissions.deletedAt),
          ),
        )
        .limit(1);

      if (!wish) return reply.code(404).send({ error: '找不到這則願望' });

      const [comment] = await db
        .insert(schema.comments)
        .values({ submissionId: wish.id, authorId: user.id, body: parsed.data.body })
        .returning({ id: schema.comments.id });

      await queueNotification(wish.id, wish.authorId, user.id, {
        type: 'comment',
        excerpt: parsed.data.body.slice(0, 40),
      });

      return reply.code(201).send({ ok: true, id: comment?.id });
    },
  );

  /** 讚或倒讚。同一人對同一則只有一票，再按就是改票 */
  app.post('/api/comments/:id/vote', async (request, reply) => {
    if (!db) return reply.code(503).send({ error: '這台沒有接資料庫' });

    const user = await currentUser(request);
    if (!user) return reply.code(401).send({ error: '請先登入' });

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    const parsed = voteSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return reply.code(400).send({ error: '格式不對' });

    await db
      .insert(schema.commentVotes)
      .values({ commentId: params.data.id, voterId: user.id, value: parsed.data.value })
      .onConflictDoUpdate({
        target: [schema.commentVotes.commentId, schema.commentVotes.voterId],
        set: { value: parsed.data.value },
      });

    return { ok: true };
  });

  /** 檢舉。累積到三個不同的人就自動封鎖被檢舉內容的作者 */
  app.post(
    '/api/reports',
    { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } },
    async (request, reply) => {
      if (!db) return reply.code(503).send({ error: '這台沒有接資料庫' });

      const user = await currentUser(request);
      if (!user) return reply.code(401).send({ error: '請先登入' });
      if (user.blocked) return reply.code(403).send({ error: 'blocked' });

      const parsed = reportSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: '格式不對' });

      const { targetType, targetId, reason } = parsed.data;

      // 先確認被檢舉的東西存在，並找出它的作者
      let targetAuthorId: string | null = null;
      if (targetType === 'comment') {
        const [row] = await db
          .select({ authorId: schema.comments.authorId })
          .from(schema.comments)
          .where(eq(schema.comments.id, targetId))
          .limit(1);
        targetAuthorId = row?.authorId ?? null;
      } else {
        const [row] = await db
          .select({ authorId: schema.submissions.authorId })
          .from(schema.submissions)
          .where(eq(schema.submissions.id, targetId))
          .limit(1);
        targetAuthorId = row?.authorId ?? null;
      }

      if (!targetAuthorId) return reply.code(404).send({ error: '找不到這個內容' });
      if (targetAuthorId === user.id) {
        return reply.code(422).send({ error: '不能檢舉自己的內容' });
      }

      await db
        .insert(schema.reports)
        .values({
          targetType,
          targetId,
          targetAuthorId,
          reporterId: user.id,
          reason: reason ?? null,
        })
        // 同一人對同一則重複檢舉不算新的一筆
        .onConflictDoNothing();

      const blocked = await maybeBlock(targetAuthorId);
      return reply.code(202).send({ ok: true, blocked });
    },
  );
}
