import type { FastifyInstance } from 'fastify';
import { desc, eq, sql } from 'drizzle-orm';
import { gameModeSchema, playSessionSchema } from '@moon/shared';
import { db, schema } from '../db/client';
import { ipHash } from '../ipHash';
import { checkNickname } from '../moderation/rules';
import { currentUser, identityCode } from '../auth/session';

export async function scoreRoutes(app: FastifyInstance): Promise<void> {
  /**
   * 排行榜。同一個人（帳號或訪客）不管玩了幾場，排行榜只留他最高分那一筆——
   * 不然玩很多次的人會把整張榜洗成自己的紀錄。
   * play_sessions 本身仍然是每場都插入一列，不能刪也不能改：
   * /api/me/sessions 的個人遊玩紀錄需要完整歷史，排行榜只是額外用
   * DISTINCT ON 從裡面挑出「每個人的最佳一場」，不動底層資料。
   */
  app.get('/api/scores', async (request, reply) => {
    if (!db) return reply.code(503).send({ error: '這台沒有接資料庫' });

    const mode = gameModeSchema.catch('rush').parse((request.query as { mode?: string })?.mode);

    // 分組鍵：登入用帳號 id，訪客用本機識別碼；兩者都沒有的異常情況退回自己的 row id，
    // 不會被誤合併成同一組
    const identity = sql<string>`coalesce(${schema.playSessions.userId}::text, ${schema.playSessions.guestHash}, ${schema.playSessions.id}::text)`;

    const bestPerPlayer = db.$with('best_per_player').as(
      db
        .selectDistinctOn([identity], {
          id: schema.playSessions.id,
          userId: schema.playSessions.userId,
          guestHash: schema.playSessions.guestHash,
          nickname: schema.playSessions.nickname,
          score: schema.playSessions.score,
          wishesHandled: schema.playSessions.handled,
          matched: schema.playSessions.matched,
          peakFatigue: schema.playSessions.peakFatigue,
          title: schema.playSessions.title,
          createdAt: schema.playSessions.createdAt,
        })
        .from(schema.playSessions)
        .where(eq(schema.playSessions.mode, mode))
        // DISTINCT ON 要求 ORDER BY 開頭欄位跟它一致，同一組內再用分數高到低排，
        // 就會挑出每個人分數最高的那一列
        .orderBy(identity, desc(schema.playSessions.score)),
    );

    const rows = await db
      .with(bestPerPlayer)
      .select()
      .from(bestPerPlayer)
      .orderBy(desc(bestPerPlayer.score))
      .limit(20);

    return {
      mode,
      scores: rows.map((r) => ({
        nickname: r.nickname,
        // 同名的人靠這三碼分辨。訪客用本機 id 的雜湊，會員用帳號 id
        code: identityCode(r.userId ?? r.guestHash ?? r.id),
        score: r.score,
        wishesHandled: r.wishesHandled,
        matched: r.matched,
        peakFatigue: r.peakFatigue,
        title: r.title,
        createdAt: r.createdAt,
      })),
    };
  });

  /** 我的遊玩紀錄。只有登入者有 */
  app.get('/api/me/sessions', async (request, reply) => {
    if (!db) return reply.code(503).send({ error: '這台沒有接資料庫' });
    const user = await currentUser(request);
    if (!user) return reply.code(401).send({ error: '請先登入' });

    const rows = await db
      .select()
      .from(schema.playSessions)
      .where(eq(schema.playSessions.userId, user.id))
      .orderBy(desc(schema.playSessions.createdAt))
      .limit(50);

    return { sessions: rows };
  });

  /** 上傳一場值班的結果。登入者的身分以 cookie 為準，不採信前端自稱 */
  app.post(
    '/api/scores',
    { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } },
    async (request, reply) => {
      if (!db) return reply.code(503).send({ error: '這台沒有接資料庫' });

      const parsed = playSessionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: '格式不對', issues: parsed.error.issues.map((i) => i.message) });
      }

      const input = parsed.data;
      const user = await currentUser(request);

      // 登入者用帳號暱稱，避免有人用假名洗榜；訪客才用自己填的
      const nickname = user ? user.displayName : input.nickname;
      const flags = checkNickname(nickname);
      if (flags.length > 0) return reply.code(422).send({ error: '這個暱稱不能用，換一個吧。' });

      await db.insert(schema.playSessions).values({
        userId: user?.id ?? null,
        guestHash: user ? null : (input.guestId ?? null),
        nickname,
        mode: input.mode,
        difficulty: input.difficulty,
        score: input.score,
        handled: input.wishesHandled,
        ignored: input.ignored,
        matched: input.matched,
        peakFatigue: input.peakFatigue,
        title: input.title ?? null,
        ipHash: ipHash(request),
      });

      return reply.code(201).send({ ok: true });
    },
  );
}
