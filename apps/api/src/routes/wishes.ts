import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  submissionInputSchema,
  type DeityDomain,
  type Wish,
  type WishCategory,
} from '@moon/shared';
import { db, schema } from '../db/client';
import { ipHash } from '../ipHash';
import { checkRules, shouldAutoReject } from '../moderation/rules';
import { reviewWithLlm } from '../moderation/llm';
import { currentUser } from '../auth/session';

/** 一個人同時最多能有幾則願望在廟裡 */
export const WISH_LIMIT = 50;

/** 社群願望沒有人工寫的後果時，用這組通用的 */
const FALLBACK_RESOLUTIONS = {
  approve: '你准了。後來怎麼樣，只有他自己知道。',
  reject: '你駁了。他站起來，拍了拍膝蓋就走了。',
  transfer: '你把單子轉出去了。對方收得莫名其妙。',
};

/** 類別對應真正該管的神明，決定轉單對不對 */
const DOMAIN_BY_CATEGORY: Record<WishCategory, DeityDomain> = {
  love: 'yuelao',
  money: 'caishen',
  exam: 'wenchang',
  ticket: 'nobody',
  health: 'nobody',
  revenge: 'chenghuang',
  absurd: 'nobody',
};

/** 人工核准時可以補寫的三種後果 */
const storedResolutionsSchema = z.object({
  approve: z.string().min(1).max(200),
  reject: z.string().min(1).max(200),
  transfer: z.string().min(1).max(200),
});

function toWish(row: {
  id: string;
  text: string;
  category: WishCategory;
  resolutions: unknown;
}): Wish {
  const parsed = storedResolutionsSchema.safeParse(row.resolutions);
  const resolutions = parsed.success ? parsed.data : FALLBACK_RESOLUTIONS;

  return {
    id: `community-${row.id}`,
    submissionId: row.id,
    category: row.category,
    domain: DOMAIN_BY_CATEGORY[row.category],
    text: row.text,
    intensity: 2,
    tags: ['community'],
    resolutions,
    source: 'community',
  };
}

export async function wishRoutes(app: FastifyInstance): Promise<void> {
  /**
   * 已核准的社群願望。前端啟動時拉一次，merge 進本地願望池。
   * 只回 approved 且未被作者收回的——pending 與 rejected 的內容永遠不會離開資料庫。
   */
  app.get('/api/wishes/approved', async (_request, reply) => {
    if (!db) return reply.code(503).send({ error: '這台沒有接資料庫' });

    const rows = await db
      .select({
        id: schema.submissions.id,
        text: schema.submissions.text,
        category: schema.submissions.category,
        resolutions: schema.submissions.resolutions,
      })
      .from(schema.submissions)
      .where(
        and(eq(schema.submissions.status, 'approved'), isNull(schema.submissions.deletedAt)),
      )
      .orderBy(desc(schema.submissions.createdAt))
      .limit(500);

    return { wishes: rows.map(toWish) };
  });

  /**
   * 我的願望。附上每則被互動的統計與留言數——
   * 這是作者唯一看得到「別人怎麼對待我的願望」的地方。
   */
  app.get('/api/wishes/mine', async (request, reply) => {
    if (!db) return reply.code(503).send({ error: '這台沒有接資料庫' });
    const user = await currentUser(request);
    if (!user) return reply.code(401).send({ error: '請先登入' });

    const rows = await db
      .select({
        id: schema.submissions.id,
        text: schema.submissions.text,
        category: schema.submissions.category,
        status: schema.submissions.status,
        moderationNote: schema.submissions.moderationNote,
        createdAt: schema.submissions.createdAt,
      })
      .from(schema.submissions)
      .where(
        and(eq(schema.submissions.authorId, user.id), isNull(schema.submissions.deletedAt)),
      )
      .orderBy(desc(schema.submissions.createdAt))
      .limit(WISH_LIMIT);

    const ids = rows.map((r) => r.id);
    const stats = new Map<string, Record<string, number>>();
    const commentCounts = new Map<string, number>();

    if (ids.length > 0) {
      const grouped = await db
        .select({
          submissionId: schema.interactions.submissionId,
          action: schema.interactions.action,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.interactions)
        .where(inArray(schema.interactions.submissionId, ids))
        .groupBy(schema.interactions.submissionId, schema.interactions.action);

      for (const row of grouped) {
        const bucket = stats.get(row.submissionId) ?? {};
        bucket[row.action] = row.count;
        stats.set(row.submissionId, bucket);
      }

      const comments = await db
        .select({
          submissionId: schema.comments.submissionId,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.comments)
        .where(and(inArray(schema.comments.submissionId, ids), isNull(schema.comments.hiddenAt)))
        .groupBy(schema.comments.submissionId);

      for (const row of comments) commentCounts.set(row.submissionId, row.count);
    }

    return {
      limit: WISH_LIMIT,
      used: rows.length,
      wishes: rows.map((r) => ({
        ...r,
        interactions: stats.get(r.id) ?? {},
        commentCount: commentCounts.get(r.id) ?? 0,
      })),
    };
  });

  /**
   * 投稿。三層審核的前兩層在這裡跑，但無論結果如何都不會直接上線——
   * status 只會是 pending 或 rejected，approved 只有人工能給。
   */
  app.post(
    '/api/wishes/submit',
    {
      config: {
        rateLimit: { max: 5, timeWindow: '10 minutes' },
      },
    },
    async (request, reply) => {
      if (!db) return reply.code(503).send({ error: '這台沒有接資料庫' });

      const user = await currentUser(request);
      if (!user) return reply.code(401).send({ error: '請先登入才能許願' });
      if (user.blocked) {
        return reply.code(403).send({
          error: 'blocked',
          message: '你的帳號目前無法使用許願功能。可以在許願頁提出申訴。',
        });
      }

      const parsed = submissionInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: '投稿格式不對',
          issues: parsed.error.issues.map((i) => i.message),
        });
      }

      const [{ count } = { count: 0 }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.submissions)
        .where(
          and(
            eq(schema.submissions.authorId, user.id),
            isNull(schema.submissions.deletedAt),
            sql`${schema.submissions.status} <> 'rejected'`,
          ),
        );

      if (count >= WISH_LIMIT) {
        return reply.code(422).send({
          error: 'limit',
          message: `廟裡最多同時放 ${WISH_LIMIT} 則你的願望。收回幾則舊的就能再投。`,
        });
      }

      const { text, category } = parsed.data;
      const rules = checkRules(text);

      if (shouldAutoReject(rules)) {
        // 留下紀錄，方便之後看濫用樣態；但不告訴投稿者是哪一條規則命中
        await db.insert(schema.submissions).values({
          authorId: user.id,
          text,
          category,
          status: 'rejected',
          autoFlags: { rules, llm: null },
          moderationNote: '程式規則自動退件',
          reviewedAt: new Date(),
          ipHash: ipHash(request),
        });
        return reply.code(422).send({
          status: 'rejected',
          message: '這則願望裡好像有聯絡方式或個資，請拿掉之後再試一次。',
        });
      }

      const llm = await reviewWithLlm(text);

      await db.insert(schema.submissions).values({
        authorId: user.id,
        text,
        category,
        status: 'pending',
        autoFlags: { rules, llm },
        ipHash: ipHash(request),
      });

      return reply.code(202).send({
        status: 'pending',
        message: '收到了。願望會先由人工看過才會出現在廟裡。',
      });
    },
  );

  /** 收回自己的願望。軟刪除：紀錄留著供稽核，但不再出現在遊戲裡，也不佔額度 */
  app.delete('/api/wishes/:id', async (request, reply) => {
    if (!db) return reply.code(503).send({ error: '這台沒有接資料庫' });
    const user = await currentUser(request);
    if (!user) return reply.code(401).send({ error: '請先登入' });

    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'id 不對' });

    const deleted = await db
      .update(schema.submissions)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(schema.submissions.id, params.data.id),
          eq(schema.submissions.authorId, user.id),
          isNull(schema.submissions.deletedAt),
        ),
      )
      .returning({ id: schema.submissions.id });

    if (deleted.length === 0) return reply.code(404).send({ error: '找不到這則願望' });
    return { ok: true };
  });
}
