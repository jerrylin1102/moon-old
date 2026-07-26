import type { FastifyInstance } from 'fastify';
import { gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { wishCategorySchema, type Wish } from '@moon/shared';
import { db, schema } from '../db/client';
import { env } from '../env';
import { ipHash } from '../ipHash';
import { chatJson, OpenAiUnavailable } from '../openai';
import { checkRules } from '../moderation/rules';

/**
 * AI 彩蛋信眾。
 *
 * 這是整個服務唯一會花錢的端點，所以三層限制都在這裡：
 * 單 IP 每小時、全站每日上限、單次 max_tokens。
 * 任何一層擋下來就靜默失敗——前端會自己退回預寫願望池，玩家不會看到錯誤。
 *
 * 生成出來的文字只當展示文本，永遠不會被當成指令執行。
 */

const generatedSchema = z.object({
  text: z.string().min(6).max(60),
  category: wishCategorySchema,
});

const SYSTEM = `你在為一款台灣廟宇題材的小遊戲生成「信眾對月老說的願望」。
規則：
- 一句到兩句繁體中文，最多 40 字，口語、有台灣生活感。
- 可以好笑、可以心酸，但不嘲弄信仰、不涉政治、不出現真實人名或品牌。
- 不要寫成詩或文言文，就是一個普通人跪在神桌前會講的話。
- category 要符合願望內容。搶票、健康、離譜的願望不屬月老業務，但信眾還是會問。`;

const DOMAIN_BY_CATEGORY = {
  love: 'yuelao',
  money: 'caishen',
  exam: 'wenchang',
  ticket: 'nobody',
  health: 'nobody',
  revenge: 'chenghuang',
  absurd: 'nobody',
} as const;

const FALLBACK_RESOLUTIONS = {
  approve: '你准了。他愣了一下，好像沒想到真的會有回應。',
  reject: '你駁了。他說了聲謝謝還是走了。',
  transfer: '你把單子轉出去了。對方收得莫名其妙。',
};

/** 單 IP 每小時上限 */
const PER_IP_HOURLY = 5;

async function dailyCount(): Promise<number> {
  if (!db) return 0;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.aiUsage)
    .where(gte(schema.aiUsage.createdAt, sql`now() - interval '1 day'`));
  return row?.count ?? 0;
}

async function ipCount(hash: string): Promise<number> {
  if (!db) return 0;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.aiUsage)
    .where(
      sql`${schema.aiUsage.ipHash} = ${hash} and ${schema.aiUsage.createdAt} >= now() - interval '1 hour'`,
    );
  return row?.count ?? 0;
}

export async function blessingRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/api/blessing/rare',
    { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } },
    async (request, reply) => {
      if (!env.OPENAI_API_KEY) {
        return reply.code(503).send({ error: 'ai_disabled' });
      }

      const hash = ipHash(request);

      if (db) {
        const [today, mine] = await Promise.all([dailyCount(), ipCount(hash)]);
        if (today >= env.AI_DAILY_CAP) return reply.code(429).send({ error: 'daily_cap' });
        if (mine >= PER_IP_HOURLY) return reply.code(429).send({ error: 'ip_cap' });
      }

      try {
        const { data, usage } = await chatJson(
          {
            system: SYSTEM,
            user: '生成一則新的願望。',
            maxTokens: 200,
            schema: {
              name: 'wish',
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['text', 'category'],
                properties: {
                  text: { type: 'string' },
                  category: {
                    type: 'string',
                    enum: ['love', 'money', 'exam', 'ticket', 'health', 'revenge', 'absurd'],
                  },
                },
              },
            },
          },
          generatedSchema,
        );

        // 生成的東西一樣要過濾。模型也可能吐出電話號碼或髒話
        const flags = checkRules(data.text);
        if (flags.length > 0) {
          request.log.warn({ flags }, 'AI 生成內容被過濾器擋下');
          return reply.code(422).send({ error: 'filtered' });
        }

        if (db) {
          await db.insert(schema.aiUsage).values({
            ipHash: hash,
            model: env.OPENAI_MODEL,
            promptTokens: usage.prompt,
            completionTokens: usage.completion,
          });
        }

        const wish: Wish = {
          id: `ai-${Date.now().toString(36)}`,
          category: data.category,
          domain: DOMAIN_BY_CATEGORY[data.category],
          text: data.text,
          intensity: 2,
          tags: ['rare'],
          resolutions: FALLBACK_RESOLUTIONS,
          source: 'ai',
        };
        return { wish };
      } catch (error) {
        const reason = error instanceof OpenAiUnavailable ? 'upstream' : 'invalid_output';
        request.log.warn({ err: error }, `AI 彩蛋生成失敗：${reason}`);
        return reply.code(502).send({ error: reason });
      }
    },
  );
}
