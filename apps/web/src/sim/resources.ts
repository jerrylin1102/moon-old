import { DIFFICULTY_PRESETS, type GameState } from './state';

export const INCENSE_MAX = 100;
export const FATIGUE_MAX = 100;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** 上香、收供品會補香火 */
export function addIncense(state: GameState, amount: number): void {
  state.incense = clamp(state.incense + amount, 0, INCENSE_MAX);
}

/**
 * 施展神通要花香火。香火不夠就整筆不扣、回傳 false，
 * 呼叫端負責播「顯靈失敗」的回饋。
 */
export function spendIncense(state: GameState, amount: number): boolean {
  if (state.incense < amount) return false;
  state.incense -= amount;
  return true;
}

export function addFatigue(state: GameState, amount: number): void {
  state.fatigue = clamp(state.fatigue + amount, 0, FATIGUE_MAX);
}

export function addResentment(state: GameState, amount: number): void {
  const cap = DIFFICULTY_PRESETS[state.difficulty].resentmentCap;
  state.resentment = clamp(state.resentment + amount, 0, cap);
}

export function addMerit(state: GameState, amount: number): void {
  state.merit = Math.max(0, state.merit + amount);
}

/** 怨氣滿了：信眾轉去別間廟，今天的班就這樣結束 */
export function isOverwhelmed(state: GameState): boolean {
  return state.resentment >= DIFFICULTY_PRESETS[state.difficulty].resentmentCap;
}

/** 0–1 的疲勞比例，渲染層用它決定畫面模糊與雜訊強度 */
export function fatigueRatio(state: GameState): number {
  return state.fatigue / FATIGUE_MAX;
}

/** 吃供品回復的疲勞 */
export const OFFERING_RECOVERY = 18;

/**
 * 偷吃供品。回體力最快的方法，代價是那份供品本來是要供著的——
 * 信眾看到空盤子多少會有意見。
 */
export function eatOffering(state: GameState, offeringId: string): boolean {
  const index = state.offerings.findIndex((o) => o.id === offeringId);
  if (index < 0) return false;

  state.offerings.splice(index, 1);
  state.snacks += 1;
  addFatigue(state, -OFFERING_RECOVERY);
  addResentment(state, 1);
  return true;
}
