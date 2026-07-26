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

/** 目前這一刻的生成間隔：越接近打烊，人來得越急 */
export function spawnInterval(state: GameState): number {
  const base = DIFFICULTY_PRESETS[state.difficulty].spawnInterval;
  const progress = state.dayLength > 0 ? Math.min(1, state.elapsed / state.dayLength) : 0;
  const ratio = Math.max(MIN_INTERVAL_RATIO, 1 - progress * 0.62);
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
  // story / sorting 模式的節奏在 M8、M9 才做
  if (state.mode !== 'rush') return;
  // 打烊之後不再放人進來
  if (state.dayLength > 0 && state.elapsed >= state.dayLength) return;

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
