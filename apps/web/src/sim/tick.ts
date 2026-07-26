import type { GameState } from './state';
import { addFatigue, isOverwhelmed } from './resources';
import { updateSpawner, type SimDeps } from './spawner';
import { isWaiting, resolveWorshipperCollisions, updateWorshipper } from './worshipper';

/** 固定步長。實際 dt 會被切成這個大小推進，避免不同螢幕刷新率跑出不同難度 */
export const FIXED_STEP = 1 / 60;
/** 單次 update 最多補幾步，避免分頁切回來時一次補上幾千步 */
const MAX_STEPS = 8;

/** 沒有信眾在等的時候，疲勞會慢慢回復（每秒） */
const IDLE_FATIGUE_RECOVERY = 0.35;

/** 推進一個固定步長。直接改動 state（模擬層刻意可變，省掉每帧配置物件） */
function step(state: GameState, dt: number, deps: SimDeps | undefined): void {
  state.elapsed += dt;

  // 先記峰值再推進：批示當下衝上去的疲勞要算數，
  // 不然會被同一步的閒置回復吃掉一點點
  if (state.fatigue > state.peakFatigue) state.peakFatigue = state.fatigue;

  // 怨氣滿了就收攤；時間到就打烊。兩者都停止生成，但讓在場的人自己走完
  if (state.status === 'running') {
    if (isOverwhelmed(state)) state.status = 'overwhelmed';
    else if (state.dayLength > 0 && state.elapsed >= state.dayLength) state.status = 'closed';
  }

  if (deps) {
    if (state.status === 'running') updateSpawner(state, dt, deps);
    for (const w of state.worshippers) {
      updateWorshipper(state, w, dt, deps.intensityOf);
    }
    // 走位算完之後才做人際碰撞，不然疊在一起的推擠會被下一步的走位覆蓋掉
    resolveWorshipperCollisions(state);
    // 離場走完的人就從清單移除，順手把走道讓給下一位
    if (state.worshippers.some((w) => w.phase === 'gone')) {
      state.worshippers = state.worshippers.filter((w) => w.phase !== 'gone');
    }
  }

  // 後果提示過期就移除
  if (state.outcomes.length > 0) {
    for (const o of state.outcomes) o.ttl -= dt;
    if (state.outcomes.some((o) => o.ttl <= 0)) {
      state.outcomes = state.outcomes.filter((o) => o.ttl > 0);
    }
  }

  const busy = state.worshippers.some(isWaiting);
  if (!busy) addFatigue(state, -IDLE_FATIGUE_RECOVERY * dt);
}

/**
 * 對外入口：把任意 dt 切成固定步長推進。
 * 沒給 deps 就只跑時間與資源（測試與尚未接上願望池的情境用）。
 */
export function advance(state: GameState, dt: number, deps?: SimDeps): void {
  if (state.paused) return;

  let remaining = Math.min(dt, FIXED_STEP * MAX_STEPS);
  while (remaining > 0) {
    const slice = Math.min(FIXED_STEP, remaining);
    step(state, slice, deps);
    remaining -= slice;
  }
}
