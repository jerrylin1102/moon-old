import type { FastifyInstance } from 'fastify';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../db/client';
import { currentUser } from '../auth/session';
import { queueNotification } from '../notify';

/**
 * 玩家在遊戲裡對社群願望做了什麼。
 *
 * 訪客也能回報（只留匿名指紋），因為願望的作者想知道的是
 * 「有幾個人擲了聖筊」，不是「誰擲的」。
 */
const bodySchema = z.object({
  submissionId: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'transfer', 'sheng', 'xiao', 'yin', 'thread', 'ignored']),
  /** 訪客的本機識別碼，只用來去重 */
  guestId: z.string().uuid().optional(),
});

export async function interactionRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/api/interactions',
    // 一場值班會打不少次，限制放寬但仍有上限
    { config: { rateLimit: { max: 120, timeWindow: '10 minutes' } } },
    async (request, reply) => {
      if (!db) return reply.code(503).send({ error: '這台沒有接資料庫' });

      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: '格式不對' });

      const { submissionId, action, guestId } = parsed.data;
      const user = await currentUser(request);

      // 只接受「還在廟裡」的願望，避免有人對已收回或未核准的願望灌紀錄
      const [wish] = await db
        .select({ id: schema.submissions.id, authorId: schema.submissions.authorId })
        .from(schema.submissions)
        .where(
          and(
            eq(schema.submissions.id, submissionId),
            eq(schema.submissions.status, 'approved'),
            isNull(schema.submissions.deletedAt),
          ),
        )
        .limit(1);

      if (!wish) return reply.code(404).send({ error: '找不到這則願望' });

      await db.insert(schema.interactions).values({
        submissionId,
        actorUserId: user?.id ?? null,
        actorGuestHash: user ? null : (guestId ?? null),
        action,
      });

      await queueNotification(submissionId, wish.authorId, user?.id ?? null, {
        type: 'interaction',
        action,
      });

      return reply.code(202).send({ ok: true });
    },
  );
}
