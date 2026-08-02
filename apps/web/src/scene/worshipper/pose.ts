import { KNEEL_ANIM_DURATION, phaseDuration } from '../../sim/worshipper';
import type { Worshipper } from '../../sim/state';

/** 0-1 平滑緩動，跪拜／起身都靠它避免瞬間卡一格的生硬感 */
export function easeSmooth(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 跪拜程度 0-1：0 是站著，1 是完全跪下。
 * kneeling 階段從 0 緩緩爬到 1；wishing／awaiting／divining 全程維持 1；
 * leaving 階段再從 1 緩緩放回 0——起身動作跟下跪共用同一條緩動曲線。
 */
export function kneelAmount(w: Worshipper): number {
  switch (w.phase) {
    case 'kneeling':
      return easeSmooth(w.phaseTime / KNEEL_ANIM_DURATION);
    case 'wishing':
    case 'awaiting':
    case 'divining':
      return 1;
    case 'leaving':
      return 1 - easeSmooth(w.phaseTime / KNEEL_ANIM_DURATION);
    default:
      return 0;
  }
}

/** 這個階段有沒有在走路（走路才需要上下擺動與手腳擺盪） */
export function isWalking(w: Worshipper): boolean {
  return (
    w.phase === 'entering' || w.phase === 'toCenser' || w.phase === 'toAltar' || w.phase === 'leaving'
  );
}

export const OFFERING_INCENSE_DURATION = phaseDuration('offeringIncense') ?? 2.2;
export const PLACING_OFFERING_DURATION = phaseDuration('placingOffering') ?? 1.4;
