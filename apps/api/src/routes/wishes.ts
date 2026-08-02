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
import { cached, invalidate } from '../ttlCache';

/** 已核准願望列表的快取時間：內容只會因審核／投稿／收回而變，不需要即時 */
const APPROVED_CACHE_KEY = 'wishes:approved';
const APPROVED_CACHE_TTL_MS = 60_000;

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
  authorAvatarUrl: string | null;
}): Wish {
  const parsed = storedResolutionsSchema.safeParse(row.resolutions);
  const resolutions = parsed.success ? parsed.data : FALLBACK_RESOLUTIONS;
  // Google 頭像網址偶爾會是相對值或空字串，safeParse 失敗就當作沒有頭像，不讓整包回應壞掉
  const avatarUrl = z.string().url().safeParse(row.authorAvatarUrl).success
    ? (row.authorAvatarUrl as string)
    : undefined;

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
    avatarUrl,
  };
}

export async function wishRoutes(app: FastifyInstance): Promise<void> {
  /**
   * 已核准的社群願望。前端啟動時拉一次，merge 進本地願望池。
   * 只回 approved 且未被作者收回的——pending 與 rejected 的內容永遠不會離開資料庫。
   */
  app.get('/api/wishes/approved', async (_request, reply) => {
    const dbConn = db;
    if (!dbConn) return reply.code(503).send({ error: '這台沒有接資料庫' });

    const wishes = await cached(APPROVED_CACHE_KEY, APPROVED_CACHE_TTL_MS, async () => {
      const rows = await dbConn
        .select({
          id: schema.submissions.id,
          text: schema.submissions.text,
          category: schema.submissions.category,
          resolutions: schema.submissions.resolutions,
          // 匿名投稿（authorId 為 null）就沒有頭像可 join，留 null 即可
          authorAvatarUrl: schema.users.avatarUrl,
        })
        .from(schema.submissions)
        .leftJoin(schema.users, eq(schema.users.id, schema.submissions.authorId))
        .where(
          and(eq(schema.submissions.status, 'approved'), isNull(schema.submissions.deletedAt)),
        )
        .orderBy(desc(schema.submissions.createdAt))
        .limit(500);

      return rows.map(toWish);
    });

    return { wishes };
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
   * 投稿。預設不用人工審核就直接發佈——送出後立刻進入願望池，
   * 別人下一場值班就可能遇到。程式規則仍然攔電話／email／個資這類硬傷，
   * 命中就直接退件；LLM 預審繼續跑，但只寫進 auto_flags 供後台事後檢視，
   * 不擋發佈。管理員在後台看得到所有投稿，需要的話可以事後下架。
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
        status: 'approved',
        autoFlags: { rules, llm },
        ipHash: ipHash(request),
      });
      invalidate(APPROVED_CACHE_KEY);

      return reply.code(201).send({
        status: 'approved',
        message: '送出了！它現在就在廟裡，別人隨時可能遇到。',
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
    invalidate(APPROVED_CACHE_KEY);
    return { ok: true };
  });
}
