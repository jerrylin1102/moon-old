import type { GameMode } from '@moon/shared';
import { DIFFICULTY_PRESETS, type GameState } from './state';
import { createWorshipper, LANE_X } from './worshipper';

/** 模擬層需要的外部資料：願望要挑哪一則，由呼叫端（前端願望池）決定 */
export interface SimDeps {
  pickWishId: () => string;
  intensityOf: (wishId: string) => number;
}

/** 生成間隔最快可以縮到原本的幾成 */
const MIN_INTERVAL_RATIO = 0.38;
/** 走道全滿時，隔多久再看一次有沒有空位 */
const RETRY_DELAY = 0.6;

/**
 * 各模式的節奏調性：
 * - rush：一路加速，撐到打烊的緊繃感
 * - sorting：起始間隔拉長（規則書要看、要想），全程加速幅度小很多，維持「中速」的判斷節奏
 * - story：全程不加速，維持慢節奏——一天只有 5–8 人，急著把人塞進來沒有意義
 */
const MODE_TEMPO: Record<GameMode, { intervalMultiplier: number; accel: number }> = {
  rush: { intervalMultiplier: 1, accel: 0.62 },
  sorting: { intervalMultiplier: 1.5, accel: 0.25 },
  story: { intervalMultiplier: 2.4, accel: 0 },
};

/** 目前這一刻的生成間隔：越接近打烊，人來得越急（幅度依模式而定） */
export function spawnInterval(state: GameState): number {
  const tempo = MODE_TEMPO[state.mode];
  const base = DIFFICULTY_PRESETS[state.difficulty].spawnInterval * tempo.intervalMultiplier;
  const progress = state.dayLength > 0 ? Math.min(1, state.elapsed / state.dayLength) : 0;
  const ratio = Math.max(MIN_INTERVAL_RATIO, 1 - progress * tempo.accel);
  // 加一點抖動，免得節奏聽起來像節拍器
  return base * ratio * (0.82 + Math.random() * 0.36);
}

function freeLane(state: GameState): number | null {
  const taken = new Set(state.worshippers.map((w) => w.lane));
  for (let lane = 0; lane < LANE_X.length; lane++) {
    if (!taken.has(lane)) return lane;
  }
  return null;
}

export function updateSpawner(state: GameState, dt: number, deps: SimDeps): void {
  // 打烊之後不再放人進來（rush／sorting 用時間，story 沒有時限）
  if (state.dayLength > 0 && state.elapsed >= state.dayLength) return;
  // story 模式沒有時限，靠「今天的名額用完了沒」決定還放不放人進來
  if (state.mode === 'story' && state.nextId - 1 >= state.storyRosterToday) return;

  state.nextSpawnIn -= dt;
  if (state.nextSpawnIn > 0) return;

  const lane = freeLane(state);
  if (lane === null) {
    state.nextSpawnIn = RETRY_DELAY;
    return;
  }

  const patience = DIFFICULTY_PRESETS[state.difficulty].patience;
  state.worshippers.push(createWorshipper(state, deps.pickWishId(), lane, patience));
  state.nextSpawnIn = spawnInterval(state);
}
