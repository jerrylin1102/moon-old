import { wishPoolSchema, type Wish } from '@moon/shared';
import type { GameState } from '../sim/state';
import { useAuth } from '../authStore';
import core from './wishes/core.json';
import love from './wishes/love.json';
import life from './wishes/life.json';
import absurd from './wishes/absurd.json';
import story from './wishes/story.json';
import { SUPPORT_WISH, SUPPORT_WISH_ID } from './supportWish';

/**
 * 官方願望池打包進前端 bundle 的離線快照——後端掛掉、fetch 失敗，遊戲照樣能玩。
 * 資料庫（wish_bank）現在才是編輯的真相來源：開局時會用 `hydrateOfficialPool()`
 * 把從 `/api/wish-bank` 拉到的內容覆蓋過來，拉不到就繼續用這份 bundle 內建的版本。
 */
export const officialPool: Wish[] = wishPoolSchema.parse([...core, ...love, ...life, ...absurd]);

/** 開局時從 /api/wish-bank 拉到題庫後的「即時版」，蓋過 bundle 版；拉不到就維持 null，回退用 officialPool */
let officialPoolLive: Wish[] | null = null;

/**
 * 後台編輯過的題庫不用重新部署前端就會生效——遊戲開局時呼叫這支，
 * 把 `/api/wish-bank` 拉到的內容換上；空陣列（fetch 失敗或這台沒接資料庫）就維持用 bundle 版本。
 */
export function hydrateOfficialPool(wishes: Wish[]): void {
  if (wishes.length === 0) return;
  officialPoolLive = wishes;
}

function currentOfficialPool(): Wish[] {
  return officialPoolLive ?? officialPool;
}

/**
 * 模式 B（凡人故事）專用願望池。刻意跟 officialPool 分開：
 * 這些願望靠 `followUp` 串成跨天的故事，混進 rush / sorting 的隨機池會讓回訪機制失去意義，
 * 文字也寫得比一般願望長（多段對話），不受一般願望池「氣泡塞得下」的長度測試限制。
 */
export const storyPool: Wish[] = wishPoolSchema.parse(story);

/** 執行期合併進來的社群/AI 願望 */
let extraPool: Wish[] = [];

export function mergeExtraWishes(wishes: Wish[]): void {
  const known = new Set([...currentOfficialPool(), ...extraPool].map((w) => w.id));
  extraPool = [...extraPool, ...wishes.filter((w) => !known.has(w.id))];
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
  return [...currentOfficialPool(), ...extraPool];
}

export function findWish(id: string): Wish | undefined {
  if (id === SUPPORT_WISH_ID) return SUPPORT_WISH;
  return (
    currentOfficialPool().find((w) => w.id === id) ??
    extraPool.find((w) => w.id === id) ??
    storyPool.find((w) => w.id === id)
  );
}

/**
 * 隨機挑一則願望。同一則短時間內不重複出現——
 * 願望池只有幾十則時，撞題會讓玩家立刻失去新鮮感。
 *
 * 記憶窗口依題庫總數動態調整：題庫越大，記得越久，
 * 不然題庫擴充了、還是常常撞到同一批（見 recentMemorySize）。
 */
const recent: string[] = [];
/** 記憶窗口下限／上限：題庫太小時至少記 6 則，太大也不用無止盡記下去 */
const MIN_RECENT_MEMORY = 6;
const MAX_RECENT_MEMORY = 30;

function recentMemorySize(poolSize: number): number {
  return Math.min(MAX_RECENT_MEMORY, Math.max(MIN_RECENT_MEMORY, Math.floor(poolSize / 3)));
}

/**
 * 跨場次的「看過的題目」記憶，存在 localStorage（依訪客／登入身分分 key），
 * 讓重玩時不會一開局就先遇到跟上次一樣的那幾則。這是soft的排除——
 * 篩完候選是空的就會整池回退，不會因為記憶體而真的抽不到題目。
 */
const SEEN_MEMORY_LIMIT = 100;

function seenStorageKey(): string {
  const { me, guest } = useAuth.getState();
  return `moon.seenWishes.${me?.id ?? guest.guestId}`;
}

function loadSeen(): string[] {
  try {
    const raw = localStorage.getItem(seenStorageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveSeen(ids: string[]): void {
  try {
    localStorage.setItem(seenStorageKey(), JSON.stringify(ids));
  } catch {
    // 存不進去就算了（無痕模式／被瀏覽器擋掉），只是下次重玩比較容易撞到同一批題目
  }
}

let seen: string[] = loadSeen();

/** 稀有信眾出現的機率 */
const RARE_CHANCE = 0.05;

/**
 * 贊助作者的彩蛋信眾出現機率：要「不能太低也不能太高」——
 * 太低幾乎沒人看得到，太高又會讓人覺得每場都在推銷。1.5% 且同場最多出現一次。
 */
const SUPPORT_CHANCE = 0.015;

export function pickWishId(state: GameState): string {
  // 贊助彩蛋同場只出現一次，優先擲這個籤，不佔用稀有信眾的機率池
  if (!state.supportNpcShown && Math.random() < SUPPORT_CHANCE) {
    state.supportNpcShown = true;
    return SUPPORT_WISH_ID;
  }

  // 抽中稀有籤而且手上真的有貨，才用 AI 生成的那則
  if (Math.random() < RARE_CHANCE) {
    const rare = takeRareWish();
    if (rare) return rare.id;
  }

  const pool = allWishes();
  const memory = recentMemorySize(pool.length);
  const recentWindow = recent.slice(-memory);

  // 先排掉這場最近抽過的，再排掉跨場次看過的；篩完是空的就一路退回全池，保證一定抽得到
  const notRecent = pool.filter((w) => !recentWindow.includes(w.id));
  const fresh = notRecent.filter((w) => !seen.includes(w.id));
  const candidates = fresh.length > 0 ? fresh : notRecent.length > 0 ? notRecent : pool;

  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  const id = picked?.id ?? pool[0]?.id ?? '';

  recent.push(id);
  if (recent.length > memory) recent.shift();

  if (!seen.includes(id)) {
    seen = [...seen, id];
    if (seen.length > SEEN_MEMORY_LIMIT) seen = seen.slice(-SEEN_MEMORY_LIMIT);
    saveSeen(seen);
  }

  return id;
}

export function intensityOf(wishId: string): number {
  return findWish(wishId)?.intensity ?? 1;
}
