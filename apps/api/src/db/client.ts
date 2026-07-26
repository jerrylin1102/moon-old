import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { env } from '../env';
import * as schema from './schema';

/**
 * 資料庫連線。沒設 DATABASE_URL 就是「這台沒有資料庫」，
 * 相關端點會回 503 而不是整個服務起不來——遊戲本體本來就不需要後端。
 */
let pool: pg.Pool | null = null;
let database: ReturnType<typeof drizzle<typeof schema>> | null = null;

if (env.DATABASE_URL) {
  pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 });
  database = drizzle(pool, { schema });
}

export const db = database;
export { schema };

export async function closeDb(): Promise<void> {
  await pool?.end();
}

/**
 * 開機時把 migration 跑完。
 * 用 drizzle-orm 內建的 migrator，不需要把 drizzle-kit 帶進正式映像；
 * 已經套用過的 migration 會自己跳過，重開機是安全的。
 */
export async function runMigrations(): Promise<void> {
  if (!database) return;
  const folder = fileURLToPath(new URL('./migrations', import.meta.url));
  await migrate(database, { migrationsFolder: folder });
}

/** 開機時確認資料庫真的連得上，連不上就講清楚，不要等到第一個請求才爆 */
export async function pingDb(): Promise<boolean> {
  if (!pool) return false;
  try {
    await pool.query('select 1');
    return true;
  } catch {
    return false;
  }
}
