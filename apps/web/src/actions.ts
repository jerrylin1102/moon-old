import type { Divination, Verdict } from '@moon/shared';
import { useGame } from './gameStore';
import { useInteraction } from './interactionStore';
import { findWish } from './content/pool';
import {
  castBlessing,
  castDivination,
  resolveVerdict,
  tieRedThread,
  type WishInfo,
} from './sim/verdict';
import { isWaiting } from './sim/worshipper';
import { onCooldown, startCooldown } from './sim/fatigue';
import { eatOffering } from './sim/resources';
import type { Worshipper } from './sim/state';

/**
 * UI 與模擬層之間的橋。願望池是渲染層的資料，
 * 所以「把願望資料撈出來餵給 sim」這件事放在這裡，sim 保持不認識願望池。
 */

function wishInfo(wishId: string): WishInfo | null {
  const wish = findWish(wishId);
  if (!wish) return null;
  return {
    intensity: wish.intensity,
    category: wish.category,
    domain: wish.domain,
    resolutions: wish.resolutions,
  };
}

/** 只有正在說願望或等回應的信眾可以被回應 */
function respondable(id: string | null): Worshipper | null {
  if (!id) return null;
  const w = useGame.getState().state?.worshippers.find((x) => x.id === id);
  return w && isWaiting(w) ? w : null;
}

export function applyVerdict(id: string | null, verdict: Verdict): boolean {
  const state = useGame.getState().state;
  const w = respondable(id);
  if (!state || !w || onCooldown(state)) return false;

  const wish = wishInfo(w.wishId);
  if (!wish) return false;

  resolveVerdict(state, w, verdict, wish);
  startCooldown(state);
  useInteraction.getState().focus(null);
  useGame.getState().bump();
  return true;
}

/** 偷吃神桌上的供品，回體力 */
export function applyEatOffering(offeringId: string): boolean {
  const state = useGame.getState().state;
  if (!state) return false;

  const ok = eatOffering(state, offeringId);
  useGame.getState().bump();
  return ok;
}

export function applyDivination(id: string | null, result: Divination): boolean {
  const state = useGame.getState().state;
  const w = respondable(id);
  if (!state || !w || onCooldown(state)) return false;

  const wish = wishInfo(w.wishId);
  if (!wish) return false;

  castDivination(state, w, result, wish);
  startCooldown(state);
  // 笑筊不算結案，信眾還在等，所以維持選中狀態
  if (result !== 'xiao') useInteraction.getState().focus(null);
  useGame.getState().bump();
  return true;
}

export function applyBlessing(): boolean {
  const state = useGame.getState().state;
  if (!state) return false;

  const ok = castBlessing(state);
  useGame.getState().bump();
  return ok;
}

export function applyThread(fromId: string, toId: string): boolean {
  const state = useGame.getState().state;
  const a = respondable(fromId);
  const b = respondable(toId);
  if (!state || !a || !b) return false;

  const wishA = wishInfo(a.wishId);
  const wishB = wishInfo(b.wishId);
  if (!wishA || !wishB) return false;

  const from: [number, number] = [...a.position];
  const to: [number, number] = [...b.position];
  const ok = tieRedThread(state, a, b, wishA, wishB);
  if (ok) useInteraction.getState().addThread(from, to);

  useInteraction.getState().focus(null);
  useGame.getState().bump();
  return ok;
}
