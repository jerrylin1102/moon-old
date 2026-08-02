import { sql } from 'drizzle-orm';
import { db, schema } from './client';
import core from './seed/core.json';
import love from './seed/love.json';
import life from './seed/life.json';
import absurd from './seed/absurd.json';
import story from './seed/story.json';

interface SeedWish {
  id: string;
  category: string;
  domain: string;
  text: string;
  intensity: number;
  tags: string[];
  resolutions: { approve: string; reject: string; transfer: string };
  followUp?: string;
}

const OFFICIAL = [...core, ...love, ...life, ...absurd] as SeedWish[];
const STORY = story as SeedWish[];

/**
 * 把官方題庫的 JSON 快照灌進 wish_bank，只在資料表還是空的時候跑一次
 * （legacyId 的 unique constraint + onConflictDoNothing 做雙重保險，重複開機也不會出錯）。
 * 灌完之後，資料庫就是編輯的真相來源——後續內容異動走 /admin 題庫管理，
 * 這幾份 JSON 檔案（跟 apps/web 那份同步複製而來）只當作一次性的初始快照。
 */
export async function seedWishBankIfEmpty(log: { info: (msg: string) => void }): Promise<void> {
  if (!db) return;

  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.wishBank);
  if ((row?.count ?? 0) > 0) return;

  const rows = [
    ...OFFICIAL.map((w) => ({ ...w, poolType: 'official' as const })),
    ...STORY.map((w) => ({ ...w, poolType: 'story' as const })),
  ].map((w) => ({
    legacyId: w.id,
    category: w.category as (typeof schema.wishCategory.enumValues)[number],
    domain: w.domain as (typeof schema.deityDomain.enumValues)[number],
    text: w.text,
    intensity: w.intensity,
    tags: w.tags,
    resolutions: w.resolutions,
    followUp: w.followUp ?? null,
    poolType: w.poolType,
  }));

  await db
    .insert(schema.wishBank)
    .values(rows)
    .onConflictDoNothing({ target: schema.wishBank.legacyId });

  log.info(`題庫已灌入 ${rows.length} 則初始資料（來源：JSON 快照）`);
}
