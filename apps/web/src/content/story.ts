import type { Wish } from '@moon/shared';
import { findWish, storyPool } from './pool';

/**
 * 模式 B（凡人故事）的存檔與排人邏輯。
 *
 * 跟 sim/ 的界線刻意保持一致：純函式（buildDayRoster、advanceStorySave）
 * 不碰 localStorage，方便單獨測試；真正讀寫瀏覽器儲存的部分集中在
 * loadStorySave / persistStorySave 這兩個函式，跟 authStore.ts 的 guest 存檔同一套風格。
 */

export interface StorySave {
  /** 第幾天。新玩家從第 1 天開始 */
  day: number;
  /** 排隊要在「今天」出場的回訪願望 id（上一天結算時算出來的） */
  pendingFollowUps: string[];
  /** 玩過的角色（願望 id），用來避免同一個人在還沒排到回訪之前就重複出現 */
  metCharacters: string[];
}

export function emptyStorySave(): StorySave {
  return { day: 1, pendingFollowUps: [], metCharacters: [] };
}

const STORY_SAVE_KEY = 'moon.story';

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

export function loadStorySave(): StorySave {
  try {
    const raw = localStorage.getItem(STORY_SAVE_KEY);
    if (!raw) return emptyStorySave();
    const parsed = JSON.parse(raw) as Partial<StorySave>;
    return {
      day: typeof parsed.day === 'number' && parsed.day > 0 ? parsed.day : 1,
      pendingFollowUps: isStringArray(parsed.pendingFollowUps) ? parsed.pendingFollowUps : [],
      metCharacters: isStringArray(parsed.metCharacters) ? parsed.metCharacters : [],
    };
  } catch {
    // localStorage 可能被瀏覽器擋掉，那就每次都當第一天
    return emptyStorySave();
  }
}

function persistStorySave(save: StorySave): void {
  try {
    localStorage.setItem(STORY_SAVE_KEY, JSON.stringify(save));
  } catch {
    // 存不進去就算了，只是下次不記得昨天發生的事
  }
}

/** 重新開始一段新故事：清掉存檔，回到第一天、沒人回訪過 */
export function resetStorySave(): void {
  try {
    localStorage.removeItem(STORY_SAVE_KEY);
  } catch {
    /* noop */
  }
}

/**
 * 純函式：把「回訪佇列 + 故事池」排成今天要出場的名單。
 * 回訪的人優先排進去；剩下的名額從還沒遇過的角色裡隨機挑，
 * 角色都遇過了才允許重複（故事池夠大的話正常不會走到這步）。
 */
export function buildDayRoster(
  save: StorySave,
  rosterSize: number,
  pool: Wish[] = storyPool,
  random: () => number = Math.random,
): string[] {
  const poolIds = new Set(pool.map((w) => w.id));
  const roster = save.pendingFollowUps.filter((id) => poolIds.has(id));
  const metSet = new Set(save.metCharacters);

  while (roster.length < rosterSize) {
    const unmet = pool.filter((w) => !roster.includes(w.id) && !metSet.has(w.id));
    const candidates = unmet.length > 0 ? unmet : pool.filter((w) => !roster.includes(w.id));
    if (candidates.length === 0) break;
    const picked = candidates[Math.floor(random() * candidates.length)]!;
    roster.push(picked.id);
  }

  return roster;
}

/**
 * 純函式：值班收工時，把今天處理過、還有下集的願望排進明天的回訪佇列，
 * 並把今天出現過的角色記進「已經遇過」。傳入舊存檔、回傳新的，不直接改參數。
 */
export function advanceStorySave(
  save: StorySave,
  history: { wishId: string; action: string }[],
): StorySave {
  const nextFollowUps: string[] = [];
  const metToday = new Set(save.metCharacters);

  for (const record of history) {
    const wish = findWish(record.wishId);
    if (!wish) continue;
    metToday.add(wish.id);
    // 沒聽到的人不會有下一集——故事得靠你真的回應了才會繼續
    if (record.action !== 'ignored' && wish.followUp) {
      nextFollowUps.push(wish.followUp);
    }
  }

  return {
    day: save.day + 1,
    pendingFollowUps: nextFollowUps,
    metCharacters: [...metToday],
  };
}

/**
 * 執行期排班表：今天要出場的 id 序列，SimLoop 依序吐出去給 spawner。
 * 這一小塊刻意保留成模組層級的可變狀態（跟 pool.ts 的 recent／rareQueue 同風格），
 * 是唯讀存檔與 sim 之間的橋，本身不做任何持久化。
 */
let todayRoster: string[] = [];
let rosterIndex = 0;

/** 值班開始時呼叫一次：讀存檔、排今天的名單 */
export function prepareStoryDay(rosterSize: number): void {
  const save = loadStorySave();
  todayRoster = buildDayRoster(save, rosterSize);
  rosterIndex = 0;
}

/** spawner 要生下一位信眾時呼叫；正常情況下最多被呼叫 rosterSize 次 */
export function pickStoryWishId(): string {
  if (rosterIndex < todayRoster.length) {
    return todayRoster[rosterIndex++]!;
  }
  // 保底：理論上 sim 會在名額用完後停止生成，不應該走到這裡
  const fallback = storyPool[Math.floor(Math.random() * storyPool.length)];
  return fallback?.id ?? '';
}

/** 值班收工時呼叫：結算存檔，回傳新的一天是第幾天 */
export function concludeStoryDay(history: { wishId: string; action: string }[]): number {
  const save = loadStorySave();
  const next = advanceStorySave(save, history);
  persistStorySave(next);
  return next.day;
}

export function currentStoryDay(): number {
  return loadStorySave().day;
}
