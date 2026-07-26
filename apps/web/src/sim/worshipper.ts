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
/** 香爐插滿了就不再增加，免得渲染層的 instancedMesh 超出容量 */
export const MAX_CENSER_STICKS = 24;

/** 跪拜／起身漸變動畫的秒數，渲染層拿去算 lean 角度的緩動 */
export const KNEEL_ANIM_DURATION = 0.5;

/** 停留型階段的長度，渲染層（供品搬運、上香手勢）拿去算動畫進度 */
export function phaseDuration(phase: WorshipperPhase): number | undefined {
  return PHASE_DURATION[phase];
}

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

/**
 * 依 seed 產生穩定的 -1~1 偽隨機值：同一人每一帧都算出同一個數，
 * 但换個 salt 就跟 seed 本身的分布沒有關聯，可以拿來各自獨立地擾動 x／z／朝向，
 * 不會因為都用同一個 seed 而每個人的偏移量彼此連動。
 */
function jitterOf(seed: number, salt: number): number {
  const v = Math.sin((seed + salt) * 12.9898) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
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
    case 'toAltar': {
      // 走道很寬（進門像人群），但跪拜時往中間收攏到 ±2.3m 內，
      // 否則手機直式螢幕的橫向視野裝不下最外側的人。
      // 深度也要退開：離神桌太近，整個人會落進桌沿的視線死角，只剩一顆頭露出來。
      // 加一點隨機錯位，不然每個人都準準地站在走道正中央，跪成一排像在排隊點名——
      // 現實中誰跪拜會排得那麼整齊。橫向錯位故意比縱向小，避免跟旁邊走道的人擠在一起。
      const scatterX = jitterOf(w.seed, 1.7) * 0.4;
      const scatterZ = jitterOf(w.seed, 4.2) * 0.6;
      return [laneX * 0.62 + scatterX, ALTAR_Z - 2.8 + scatterZ];
    }
    case 'leaving':
      return [laneX, DOOR_Z - 1.5];
    default:
      return null;
  }
}

/** 香爐周圍的禁行帶：往神桌或往門口移動時，貼著中線走會直接穿過爐身 */
const CENSER_AVOID_RADIUS = 0.95;
const CENSER_AVOID_FRONT_Z = CENSER_POSITION[2] - 1.0;
const CENSER_AVOID_BACK_Z = CENSER_POSITION[2] + 1.0;

/**
 * 移動目標若會讓人貼著中線穿過香爐深度帶，先把方向煞成往旁邊閃，
 * 等橫向拉開到禁行半徑之外才放行繼續原本的路徑。
 * 只影響移動的「方向」，抵達判定仍然看真正的目的地，不會因為閃避點提早觸發下一階段。
 */
function avoidCenser(w: Worshipper, target: [number, number]): [number, number] {
  const [px, pz] = w.position;
  if (Math.abs(px) >= CENSER_AVOID_RADIUS) return target;
  if (pz < CENSER_AVOID_FRONT_Z || pz > CENSER_AVOID_BACK_Z) return target;

  const side = px === 0 ? 1 : Math.sign(px);
  return [side * CENSER_AVOID_RADIUS, pz];
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
      // 轉身面向神座再跪。不轉的話會保持走進來的朝向，等於對著門口拜。
      // 加一點點角度誤差，不然一排人臉朝向完全平行，還是很像排練過的隊伍
      w.facing = jitterOf(w.seed, 9.3) * 0.18;
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
      state.censerSticks = Math.min(MAX_CENSER_STICKS, state.censerSticks + 1);
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

/** 這條走道的供品最終會落在桌面哪個 x 座標。渲染層算搬運動畫的終點也要用同一條公式 */
export function offeringSlotX(lane: number): number {
  return ((lane - (LANE_X.length - 1) / 2) / (LANE_X.length - 1)) * 2 * OFFERING_SPREAD;
}

function placeOffering(state: GameState, w: Worshipper): void {
  state.offerings.push({
    id: `${w.id}-offering`,
    x: offeringSlotX(w.lane),
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

    const [sx, sz] = avoidCenser(w, target);
    const sdx = sx - w.position[0];
    const sdz = sz - w.position[1];
    const sdist = Math.hypot(sdx, sdz) || 1;

    const step = Math.min(dist, w.speed * dt);
    w.position[0] += (sdx / sdist) * step;
    w.position[1] += (sdz / sdist) * step;
    w.facing = Math.atan2(sdx, sdz);
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
