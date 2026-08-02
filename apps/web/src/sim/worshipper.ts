import {
  ALTAR_Z,
  CENSER_FOOTPRINT_DEPTH,
  CENSER_FOOTPRINT_WIDTH,
  CENSER_POSITION,
  DOOR_WIDTH,
  DOOR_Z,
  WALL_THICKNESS,
} from '../scene/layout';
import { addFatigue, addIncense, addResentment } from './resources';
import type { GameState, Worshipper, WorshipperGender, WorshipperPhase } from './state';

/**
 * 信眾狀態機。座標常數從 scene/layout 借用——那個檔案只有純數字，
 * 沒有 import three，所以模擬層拿來用不會破壞「sim 不碰渲染」的界線。
 */

/**
 * 一人一道：走道本身互不相交，省掉走位時的避讓邏輯。八道剛好鋪滿 15m 寬的廟。
 * 但跪拜區會收攏＋加隨機錯位，鄰道的人仍可能擠在一起，
 * 那段身體重疊靠 resolveWorshipperCollisions 事後推開，不是靠走道分流。
 */
export const LANE_X = [-4.2, -3, -1.8, -0.6, 0.6, 1.8, 3, 4.2] as const;

const BASE_WALK_SPEED = 1.15;
/** 走到定點的容許誤差 */
const ARRIVE_EPSILON = 0.08;
/** 一般離場時，前段彎繞要花多少秒才收斂回直線 */
const LEAVE_CURVE_DURATION = 1.6;

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

/**
 * 決定下一位信眾的性別：哪邊生成得少，就提高機率補回來，
 * 避免單場遊戲全男或全女（用戶要求機率大致平衡）。
 * 差距在 0-1 內維持 50/50；差距 ≥2 時，80% 機率補少的那邊。
 */
export function pickGender(state: GameState): WorshipperGender {
  const diff = state.spawnedMale - state.spawnedFemale;
  if (Math.abs(diff) < 2) return Math.random() < 0.5 ? 'male' : 'female';
  const under: WorshipperGender = diff > 0 ? 'female' : 'male';
  const over: WorshipperGender = diff > 0 ? 'male' : 'female';
  return Math.random() < 0.8 ? under : over;
}

export function createWorshipper(
  state: GameState,
  wishId: string,
  lane: number,
  patience: number,
  gender: WorshipperGender,
): Worshipper {
  const seed = Math.random();
  const entryDrift = jitterOf(seed, 2.3) * 0.9;
  // 生成點就直接卡在門洞寬度內（跟 targetFor 的 entering 分支同一條公式），
  // 外側走道（±3、±4.2）的人才不會一出生就卡在門洞外側的實牆裡
  const spawnX = funnelThroughDoor((LANE_X[lane] ?? 0) + entryDrift);

  return {
    id: `w${state.nextId++}`,
    wishId,
    phase: 'entering',
    phaseTime: 0,
    position: [spawnX, DOOR_Z - 0.5],
    patience,
    hasOffering: seed > 0.55,
    lane,
    speed: BASE_WALK_SPEED * (0.85 + seed * 0.35),
    facing: 0,
    seed,
    gender,
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

/**
 * 門洞淨寬扣掉人的肩寬，走道最外側兩道（±3、±4.2）、以及紅線配對後的 exitX
 * 都可能落在這個範圍外——只要人還卡在門洞的牆體 z 帶內，x 就得先收攏進來，
 * 不然會直接對著門洞兩側的實牆走一條直線穿過去。
 */
const DOOR_PASS_HALF_WIDTH = DOOR_WIDTH / 2 - 0.5;

/** entering/leaving 算出來的 x 最極端可能是「最外側走道 + 最大隨機偏移」，等比例縮進門洞寬度要用這個當分母 */
const MAX_ENTRY_X = Math.max(...LANE_X.map(Math.abs)) + 0.9;

/**
 * 等比例縮放進門洞寬度內，而不是直接截斷（clamp）——
 * 截斷會讓所有超出範圍的走道／seed 全部疊到同一個邊界值，
 * 外側走道的人穿門時會變成排成一直線，看起來又是排練過的隊伍。
 * 線性縮放維持單調遞增，不同走道、不同 seed 算出來的落點還是彼此有別。
 */
function funnelThroughDoor(x: number): number {
  return (x / MAX_ENTRY_X) * DOOR_PASS_HALF_WIDTH;
}

/** 前牆實際厚度的一半，x 要等完全穿出這個 z 帶才能放行走回原本（可能超出門洞寬度）的走道 */
const WALL_HALF_THICKNESS = WALL_THICKNESS / 2;

/** 移動型階段的目標點；回傳 null 表示這個階段是站在原地做事 */
function targetFor(w: Worshipper): [number, number] | null {
  const laneX = LANE_X[w.lane] ?? 0;

  switch (w.phase) {
    case 'entering': {
      // 每個人進門的落點依 seed 略為錯開，不然同一走道進來的人永遠走同一條線，像排練過
      const entryDrift = jitterOf(w.seed, 2.3) * 0.9;
      // 人還在門洞外（z 還沒過門檻）時，先瞄準收攏到門洞寬度內的落點，
      // 免得外側走道的人直接對著實牆走一條直線穿過去；進門之後才放行走回自己的走道
      if (w.position[1] < DOOR_Z + WALL_HALF_THICKNESS) {
        return [funnelThroughDoor(laneX + entryDrift), DOOR_Z + 0.4];
      }
      return [laneX + entryDrift, DOOR_Z + 2];
    }
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
    case 'leaving': {
      // 紅線配對成功的兩人，離場目標收斂到共同算好的中點，牽手並肩走出去——
      // 這個目標本身就跟平常離場不同，不用再疊加隨機彎繞，保持乾淨的收斂路徑。
      // 一般離場：剛轉身的前段先往一個依 seed 偏移的中繼點彎，快到門口時才收斂回直線，
      // 不然所有人離場都是同一條回頭直線，跟進門時的隊形一樣死板。
      const leaveDrift = jitterOf(w.seed, 6.1) * 1.1;
      const curveProgress = Math.min(1, w.phaseTime / LEAVE_CURVE_DURATION);
      const finalX = w.exitX !== undefined ? w.exitX : laneX + leaveDrift * (1 - curveProgress);

      // 人還沒出門檻（z 還在牆體那一帶）時，先收攏到門洞寬度內再出去，
      // exitX 或最外側走道都可能超出門洞——直接照原本 x 走會撞牆
      if (w.position[1] > DOOR_Z - WALL_HALF_THICKNESS) {
        return [funnelThroughDoor(finalX), DOOR_Z - 0.4];
      }
      return [finalX, DOOR_Z - 1.5];
    }
    default:
      return null;
  }
}

/** 信眾肩寬半徑，碰撞箱／人際避讓都用這個值撐出人的「體積」 */
export const WORSHIPPER_RADIUS = 0.35;

/**
 * 香爐周圍的禁行帶：往神桌或往門口移動時，貼著中線走會直接穿過爐身。
 * 半徑／深度直接從爐台實際佔地（CENSER_FOOTPRINT_*）推算，再加上人的肩寬，
 * 這樣碰撞箱才會跟 Temple.tsx 畫出來的爐台對齊，不會出現「繞過的位置其實還在爐身裡」。
 */
const CENSER_AVOID_RADIUS = CENSER_FOOTPRINT_WIDTH / 2 + WORSHIPPER_RADIUS;
const CENSER_AVOID_FRONT_Z = CENSER_POSITION[2] - (CENSER_FOOTPRINT_DEPTH / 2 + WORSHIPPER_RADIUS);
const CENSER_AVOID_BACK_Z = CENSER_POSITION[2] + (CENSER_FOOTPRINT_DEPTH / 2 + WORSHIPPER_RADIUS);

/**
 * 移動目標若會讓人貼著中線穿過香爐深度帶，先把方向煞成往旁邊閃，
 * 等橫向拉開到禁行半徑之外才放行繼續原本的路徑。
 * 只影響移動的「方向」，抵達判定仍然看真正的目的地，不會因為閃避點提早觸發下一階段。
 *
 * z 一定要用「目標」的 z，不能用當下 pz——早期版本閃避時把 z 釘死在當下位置，
 * 人只要 x 還沒拉開到禁行半徑外就完全卡在爐台旁邊的深度帶裡動彈不得，
 * 每 frame 被 resolveWorshipperCollisions 推來推去，看起來就是貼著桌子狂抖、
 * 身體還可能被推進桌沿。z 跟著目標走，閃避期間人仍持續往前推進，
 * 頂多繞爐台側邊多花半秒，不會卡死在原地。
 *
 * 閃避側用「自己走道」的正負號決定，不能用當下 px 的正負號——
 * 人被 resolveWorshipperCollisions 擠到中線附近時 px 正負號會逐 frame翻來覆去，
 * 若閃避側跟著翻，目標點就在 -RADIUS/+RADIUS 之間跳，畫面表現成貼著爐台邊緣狂閃。
 * 走道位置整場固定，用它當側別就不會被推擠影響。
 */
function avoidCenser(w: Worshipper, target: [number, number]): [number, number] {
  const [px, pz] = w.position;
  if (Math.abs(px) >= CENSER_AVOID_RADIUS) return target;
  if (pz < CENSER_AVOID_FRONT_Z || pz > CENSER_AVOID_BACK_Z) return target;

  const side = (LANE_X[w.lane] ?? 0) >= 0 ? 1 : -1;
  return [side * CENSER_AVOID_RADIUS, target[1]];
}

/** 兩個人中心距離小於這個值就算身體疊在一起 */
const MIN_WORSHIPPER_DISTANCE = WORSHIPPER_RADIUS * 2;

/**
 * 人與人的碰撞箱：跪拜區收攏＋隨機錯位（見 targetFor 的 toAltar 分支）算下來，
 * 相鄰走道的人有機率擠到彼此身體裡。每 tick 逐對檢查，疊在一起就各退一半，
 * 只處理「已經重疊」的情況，不影響原本走位／站位的目標。
 */
export function resolveWorshipperCollisions(state: GameState): void {
  const list = state.worshippers;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (!a || a.phase === 'gone') continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (!b || b.phase === 'gone') continue;

      const dx = b.position[0] - a.position[0];
      const dz = b.position[1] - a.position[1];
      const dist = Math.hypot(dx, dz);
      if (dist >= MIN_WORSHIPPER_DISTANCE) continue;

      // 完全疊在同一點時方向不存在，用 seed 排出穩定的推開方向，不然除以 0 會炸開
      const nx = dist < 1e-4 ? (a.seed >= b.seed ? 1 : -1) : dx / dist;
      const nz = dist < 1e-4 ? 0 : dz / dist;
      const push = (MIN_WORSHIPPER_DISTANCE - dist) / 2;

      a.position[0] -= nx * push;
      a.position[1] -= nz * push;
      b.position[0] += nx * push;
      b.position[1] += nz * push;
    }
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
