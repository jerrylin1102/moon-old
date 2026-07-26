import type { GameState } from './state';

/**
 * 排行榜分數。
 *
 * 刻意讓「配對」權重最高、「沒聽到」扣分——
 * 這場遊戲想獎勵的是把人聽完，不是把單子清光。
 */
export function computeScore(state: GameState): number {
  const raw =
    state.handled * 10 + state.matched * 40 + Math.round(state.merit) * 2 - state.ignored * 8;
  return Math.max(0, raw);
}
