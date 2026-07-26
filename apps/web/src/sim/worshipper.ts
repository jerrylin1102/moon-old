import { ALTAR_Z, CENSER_POSITION, DOOR_Z } from '../scene/layout';
import { addFatigue, addIncense, addResentment } from './resources';
import type { GameState, Worshipper, WorshipperPhase } from './state';

/**
 * 信眾狀態機。座標常數從 scene/layout 借用——那個檔案只有純數字，
 * 沒有 import three，所以模擬層拿來用不會破壞「sim 不碰渲染」的界線。
 */

/** 一人一道，省掉互相避讓的邏輯。八道剛好鋪滿 15m 寬的廟 */
export const LANE_X = [-4.2, -3, -1.8, -0.6, 0.6, 1.8, 3, 4.2] as const;

const BASE_WALK_SPEED = 1.15;
/** 走到定點的容許誤差 */
const ARRIVE_EPSILON = 0.08;

/** 停留型階段的長度（秒） */
const PHASE_DURATION: Partial<Record<WorshipperPhase, number>> = {
  offeringIncense: 2.2,
  placingOffering: 1.4,
  kneeling: 0.9,
  wishing: 2,
};

/** 上香補的香火 */
const INCENSE_PER_STICK = 6;
/** 供品補的香火 */
const INCENSE_PER_OFFERING = 4;
/** 願望被忽略時，每點 intensity 累積多少怨氣 */
const RESENTMENT_PER_INTENSITY = 4;

export function createWorshipper(
  state: GameState,
  wishId: string,
  lane: number,
  patience: number,
): Worshipper {
  const seed = Math.random();
  const laneX = LANE_X[lane] ?? 0;

  return {
    id: `w${state.nextId++}`,
    wishId,
    phase: 'entering',
    phaseTime: 0,
    position: [laneX, DOOR_Z - 0.5],
    patience,
    hasOffering: seed > 0.55,
    lane,
    speed: BASE_WALK_SPEED * (0.85 + seed * 0.35),
    facing: 0,
    seed,
  };
}

/** 移動型階段的目標點；回傳 null 表示這個階段是站在原地做事 */
function targetFor(w: Worshipper): [number, number] | null {
  const laneX = LANE_X[w.lane] ?? 0;

  switch (w.phase) {
    case 'entering':
      return [laneX, DOOR_Z + 2];
    case 'toCenser':
      // 往香爐靠攏，但保留走道的橫向偏移，不要全部疊在中線
      return [laneX * 0.32, CENSER_POSITION[2] - 1.5];
    case 'toAltar':
      // 走道很寬（進門像人群），但跪拜時往中間收攏到 ±2.3m 內，
      // 否則手機直式螢幕的橫向視野裝不下最外側的人。
      // 深度也要退開：離神桌太近，整個人會落進桌沿的視線死角，只剩一顆頭露出來。
      return [laneX * 0.62, ALTAR_Z - 2.8];
    case 'leaving':
      return [laneX, DOOR_Z - 1.5];
    default:
      return null;
  }
}

function enter(w: Worshipper, phase: WorshipperPhase): void {
  w.phase = phase;
  w.phaseTime = 0;
}

/** 走到定點之後接哪個階段 */
function onArrival(w: Worshipper): void {
  switch (w.phase) {
    case 'entering':
      enter(w, 'toCenser');
      break;
    case 'toCenser':
      enter(w, 'offeringIncense');
      break;
    case 'toAltar':
      // 轉身面向神座再跪。不轉的話會保持走進來的朝向，等於對著門口拜
      w.facing = 0;
      enter(w, w.hasOffering ? 'placingOffering' : 'kneeling');
      break;
    case 'leaving':
      enter(w, 'gone');
      break;
    default:
      break;
  }
}

/** 停留型階段時間到了之後接哪個階段 */
function onPhaseComplete(state: GameState, w: Worshipper): void {
  switch (w.phase) {
    case 'offeringIncense':
      addIncense(state, INCENSE_PER_STICK);
      enter(w, 'toAltar');
      break;
    case 'placingOffering':
      addIncense(state, INCENSE_PER_OFFERING);
      placeOffering(state, w);
      enter(w, 'kneeling');
      break;
    case 'kneeling':
      enter(w, 'wishing');
      break;
    case 'wishing':
      enter(w, 'awaiting');
      break;
    default:
      break;
  }
}

/** 神桌最多擺得下幾樣供品，滿了就擠掉最舊的 */
const MAX_OFFERINGS = 7;
/** 供品在桌面上的橫向範圍 */
const OFFERING_SPREAD = 2.5;

function placeOffering(state: GameState, w: Worshipper): void {
  state.offerings.push({
    id: `${w.id}-offering`,
    x: ((w.lane - (LANE_X.length - 1) / 2) / (LANE_X.length - 1)) * 2 * OFFERING_SPREAD,
    seed: w.seed,
  });
  if (state.offerings.length > MAX_OFFERINGS) state.offerings.shift();
}

/** 願望被放到過期：信眾摸摸鼻子走人，怨氣留下來 */
export function ignoreWish(state: GameState, w: Worshipper, intensity: number): void {
  state.ignored += 1;
  state.history.push({ wishId: w.wishId, action: 'ignored', at: state.elapsed });
  addResentment(state, intensity * RESENTMENT_PER_INTENSITY);
  addFatigue(state, 1.5);
  enter(w, 'leaving');
}

export function updateWorshipper(
  state: GameState,
  w: Worshipper,
  dt: number,
  intensityOf: (wishId: string) => number,
): void {
  w.phaseTime += dt;

  const target = targetFor(w);
  if (target) {
    const [tx, tz] = target;
    const dx = tx - w.position[0];
    const dz = tz - w.position[1];
    const dist = Math.hypot(dx, dz);

    if (dist <= ARRIVE_EPSILON) {
      onArrival(w);
      return;
    }

    const step = Math.min(dist, w.speed * dt);
    w.position[0] += (dx / dist) * step;
    w.position[1] += (dz / dist) * step;
    w.facing = Math.atan2(dx, dz);
    return;
  }

  if (w.phase === 'awaiting') {
    w.patience -= dt;
    if (w.patience <= 0) ignoreWish(state, w, intensityOf(w.wishId));
    return;
  }

  const duration = PHASE_DURATION[w.phase];
  if (duration !== undefined && w.phaseTime >= duration) onPhaseComplete(state, w);
}

/** 這位信眾的願望是否正在等月老回應 */
export function isWaiting(w: Worshipper): boolean {
  return w.phase === 'wishing' || w.phase === 'awaiting';
}
