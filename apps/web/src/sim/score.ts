import type { Wish } from '@moon/shared';
import type { GameState } from './state';

/**
 * 排行榜分數。
 *
 * 刻意讓「配對」權重最高、「沒聽到」扣分——
 * 這場遊戲想獎勵的是把人聽完，不是把單子清光。
 * `bonusScore` 是稀有／社群信眾的加成疊加值，見 `addScoreBonus`。
 */
export function computeScore(state: GameState): number {
  const raw =
    state.handled * 10 +
    state.matched * 40 +
    Math.round(state.merit) * 2 -
    state.ignored * 8 +
    Math.round(state.bonusScore);
  return Math.max(0, raw);
}

/** 稀有（AI 生成）信眾多給 20%、社群（玩家投稿）信眾多給 12%，其餘來源不變 */
export function bonusMultiplier(source: Wish['source']): number {
  if (source === 'ai') return 1.2;
  if (source === 'community') return 1.12;
  return 1;
}

/**
 * 這次結案原本會貢獻多少分（跟 `computeScore` 的權重對齊：handled +10、matched +40、
 * merit 變化量 ×2），依這位信眾的願望來源套用加成，累加進 `state.bonusScore`。
 * 不動既有的 handled/matched/merit/ignored 計算，只疊加「多賺的那一截」，
 * 所以稀有／社群信眾的加成只影響最終分數，不影響疲勞、怨氣、功德等遊戲內數值。
 */
export function addScoreBonus(state: GameState, basePoints: number, source: Wish['source']): void {
  if (basePoints <= 0) return;
  const multiplier = bonusMultiplier(source);
  if (multiplier <= 1) return;
  state.bonusScore += basePoints * (multiplier - 1);
}
