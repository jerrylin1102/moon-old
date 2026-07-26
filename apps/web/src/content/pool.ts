import { wishPoolSchema, type Wish } from '@moon/shared';
import core from './wishes/core.json';
import love from './wishes/love.json';
import life from './wishes/life.json';
import absurd from './wishes/absurd.json';

/**
 * 官方願望池。刻意留在 repo 的 JSON 檔裡走版本控制（改動看得到 diff），
 * 並且打包進前端 bundle——後端掛掉遊戲照樣能玩。
 *
 * 玩家投稿的已核准願望會在執行期從 /api/wishes/approved 拉回來 merge（M6）。
 */
export const officialPool: Wish[] = wishPoolSchema.parse([...core, ...love, ...life, ...absurd]);

/** 執行期合併進來的社群/AI 願望 */
let extraPool: Wish[] = [];

export function mergeExtraWishes(wishes: Wish[]): void {
  const seen = new Set([...officialPool, ...extraPool].map((w) => w.id));
  extraPool = [...extraPool, ...wishes.filter((w) => !seen.has(w.id))];
}

/**
 * 待用的稀有信眾（AI 生成）。預先抓好放著，
 * 因為生成要等一兩秒，不能讓信眾卡在門口等 API。
 */
let rareQueue: Wish[] = [];

export function stashRareWish(wish: Wish): void {
  mergeExtraWishes([wish]);
  rareQueue.push(wish);
  if (rareQueue.length > 3) rareQueue.shift();
}

export function hasRareWish(): boolean {
  return rareQueue.length > 0;
}

function takeRareWish(): Wish | undefined {
  return rareQueue.shift();
}

export function allWishes(): Wish[] {
  return [...officialPool, ...extraPool];
}

export function findWish(id: string): Wish | undefined {
  return officialPool.find((w) => w.id === id) ?? extraPool.find((w) => w.id === id);
}

/**
 * 隨機挑一則願望。同一則短時間內不重複出現——
 * 願望池只有幾十則時，撞題會讓玩家立刻失去新鮮感。
 */
const recent: string[] = [];
const RECENT_MEMORY = 6;

/** 稀有信眾出現的機率 */
const RARE_CHANCE = 0.05;

export function pickWishId(): string {
  // 抽中稀有籤而且手上真的有貨，才用 AI 生成的那則
  if (Math.random() < RARE_CHANCE) {
    const rare = takeRareWish();
    if (rare) return rare.id;
  }

  const pool = allWishes();
  const fresh = pool.filter((w) => !recent.includes(w.id));
  const candidates = fresh.length > 0 ? fresh : pool;
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  const id = picked?.id ?? pool[0]?.id ?? '';

  recent.push(id);
  if (recent.length > RECENT_MEMORY) recent.shift();
  return id;
}

export function intensityOf(wishId: string): number {
  return findWish(wishId)?.intensity ?? 1;
}
