import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { z } from 'zod';

// docker compose 由環境變數直接注入，不需要這步；本機 npm run dev 才需要讀 repo 根目錄的 .env
config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env') });

/**
 * 環境變數在啟動時一次驗證完。缺東西就直接開不起來，
 * 不要留到執行期才變成神秘的 500。
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url().optional(),

  // OpenAI（AI 彩蛋信眾）。沒設 key 就是關閉這個功能，不是壞掉。
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).default('gpt-5.4-mini'),
  AI_DAILY_CAP: z.coerce.number().int().nonnegative().default(500),

  // 審核後台帳密。兩個都要設，缺一個就當作沒設——不要開一個只驗一半的後台
  ADMIN_USERNAME: z.string().min(1).optional(),
  ADMIN_PASSWORD: z.string().min(1).optional(),
  IP_HASH_SALT: z.string().min(1).default('dev-only-salt'),

  // 帳號：沒設 GOOGLE_CLIENT_ID 就是「這台不開放登入」，遊戲其餘功能照常
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  SESSION_SECRET: z.string().min(16).default('dev-only-session-secret-change-me'),
  /** 開發用假登入開關。只在 NODE_ENV=development 時有作用 */
  ALLOW_DEV_LOGIN: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  APP_BASE_URL: z.string().url().default('http://localhost:5173'),

  // 寄信：沒設 SMTP_HOST 就走 log transport，功能照跑但不真的寄
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  MAIL_FROM: z.string().default('月老值班中 <no-reply@localhost>'),
});

export const env = envSchema.parse(process.env);

export const aiEnabled = Boolean(env.OPENAI_API_KEY);
export const dbEnabled = Boolean(env.DATABASE_URL);
export const authEnabled = Boolean(env.GOOGLE_CLIENT_ID);
export const mailEnabled = Boolean(env.SMTP_HOST);
export const adminEnabled = Boolean(env.ADMIN_USERNAME && env.ADMIN_PASSWORD);
