import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { cached } from '../ttlCache';

/** admin.ts 的題庫 CRUD 寫入後會呼叫 invalidate 用同一把 key，不用等 TTL 過期 */
export const WISH_BANK_CACHE_KEY = 'wish-bank:official';
const WISH_BANK_CACHE_TTL_MS = 60_000;

function toWish(row: typeof schema.wishBank.$inferSelect) {
  return {
    id: row.legacyId,
    category: row.category,
    domain: row.domain,
    text: row.text,
    intensity: row.intensity,
    tags: row.tags as string[],
    resolutions: row.resolutions as { approve: string; reject: string; transfer: string },
    followUp: row.followUp ?? undefined,
    source: 'official' as const,
  };
}

export async function wishBankRoutes(app: FastifyInstance): Promise<void> {
  /**
   * 官方題庫（一般模式用的 official 池）。取代直接打包 JSON——
   * 後台編輯的內容不用重新部署前端就會生效。前端 fetch 失敗（離線、後端掛掉）
   * 就 fallback 回內建的 JSON 快照，遊戲照樣能玩。
   */
  app.get('/api/wish-bank', async (_request, reply) => {
    const dbConn = db;
    if (!dbConn) return reply.code(503).send({ error: '這台沒有接資料庫' });

    const wishes = await cached(WISH_BANK_CACHE_KEY, WISH_BANK_CACHE_TTL_MS, async () => {
      const rows = await dbConn
        .select()
        .from(schema.wishBank)
        .where(and(eq(schema.wishBank.active, true), eq(schema.wishBank.poolType, 'official')));
      return rows.map(toWish);
    });

    return { wishes };
  });
}
