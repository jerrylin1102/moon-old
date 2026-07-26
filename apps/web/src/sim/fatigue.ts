import { FATIGUE_MAX, fatigueRatio } from './resources';
import type { GameState } from './state';

/**
 * 疲勞的實際後果。全部集中在這裡，渲染層與 UI 都從這幾個函式拿數字，
 * 免得「累的表現」散在四處、各自定義一套曲線。
 *
 * 設計原則：疲勞不是扣血條，而是讓你「做不好事」——
 * 聽不清楚願望、手變慢、畫面晃。玩家會自己感覺到該休息了。
 */

/** 疲勞低於這個比例完全沒有負面效果，不然一開場就在扣體驗 */
const GRACE = 0.35;

/** 0–1：超過寬容值之後的疲勞程度 */
export function strain(state: GameState): number {
  const ratio = fatigueRatio(state);
  if (ratio <= GRACE) return 0;
  return (ratio - GRACE) / (1 - GRACE);
}

/** 願望文字被雜訊蓋掉的比例（0–0.45）。聽不清楚，就得靠猜 */
export function wishNoiseRatio(state: GameState): number {
  return strain(state) * 0.45;
}

/** 願望文字的模糊程度，單位 px */
export function wishBlurPx(state: GameState): number {
  return strain(state) * 2.2;
}

/** 批示之後多久才動得了下一個（秒）。累到極限要等 1.4 秒 */
export function verdictCooldown(state: GameState): number {
  return strain(state) * 1.4;
}

/** 鏡頭晃動幅度（弧度）。神明也會頭暈 */
export function swayAmount(state: GameState): number {
  return 0.004 + strain(state) * 0.02;
}

/** 暗角深度：越累視野越窄 */
export function vignetteDarkness(state: GameState): number {
  return 0.42 + strain(state) * 0.3;
}

/** 現在是不是還在冷卻中 */
export function onCooldown(state: GameState): boolean {
  return state.elapsed < state.cooldownUntil;
}

/** 批示完之後開始冷卻 */
export function startCooldown(state: GameState): void {
  state.cooldownUntil = state.elapsed + verdictCooldown(state);
}

export { FATIGUE_MAX };
