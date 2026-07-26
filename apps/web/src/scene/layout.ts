/**
 * 廟宇尺寸與關鍵座標。單位為公尺。
 *
 * 座標約定：神座在 +Z 深處，廟門在 -Z。相機預設朝 -Z，
 * 所以月老天生就是「面向門口」，不需要額外轉基準。
 */
// 廟開得比第一版寬、天花板拉高：原本 12×18×6 太窄，坐在神座上很有壓迫感
export const HALL_WIDTH = 15;
export const HALL_DEPTH = 21;
export const WALL_HEIGHT = 7.8;
export const WALL_THICKNESS = 0.4;

export const DOOR_WIDTH = 4.6;
export const DOOR_HEIGHT = 4.6;
export const DOOR_Z = -HALL_DEPTH / 2;

/**
 * 神座（也就是相機）位置：抬高、靠後牆。
 * 高度要壓過神桌，不然跪在桌前的信眾會整個被桌面遮住——神明看不到信眾就沒戲了。
 */
export const THRONE_POSITION = [0, 3.7, 7] as const;
export const THRONE_PLATFORM_HEIGHT = 2;

/** 神桌：擺供品的地方，在神座正前方 */
export const ALTAR_Z = 3.6;
/**
 * 桌面高度受「神座 → 跪拜區」的視線限制：桌沿會在地板上投下視線死角，
 * 太高就把整排信眾切成一顆頭。神座 3.7m、跪拜區 z=0.8 時，上限約 1.2m。
 */
export const ALTAR_HEIGHT = 1.05;
export const ALTAR_WIDTH = 6.4;
export const ALTAR_DEPTH = 1.5;

/** 香爐：信眾第一站 */
export const CENSER_POSITION = [0, 1.0, -1.2] as const;
/** 香爐爐台的實際佔地（寬×深），跟 Temple.tsx 的爐台 boxGeometry 對齊，避免碰撞箱跟視覺對不上 */
export const CENSER_FOOTPRINT_WIDTH = 2.4;
export const CENSER_FOOTPRINT_DEPTH = 1.4;

/** 柱子位置（左右各三根） */
export const PILLAR_X = 5.8;
export const PILLAR_Z = [-7.5, -1.5, 4.5] as const;
export const PILLAR_RADIUS = 0.42;

/** 信眾排隊路徑上的定點，M2 生成信眾時會用到 */
export const QUEUE_ANCHORS = {
  door: [0, 0, DOOR_Z + 1] as const,
  censer: [0, 0, CENSER_POSITION[2] - 1.4] as const,
  altar: [0, 0, ALTAR_Z - 1.8] as const,
};

/** 香爐裡第 index 支香（0-based）落在灰堆裡的位置與長短，跟總支數無關，只跟索引本身有關 */
export interface CenserStickSlot {
  x: number;
  z: number;
  h: number;
  tilt: number;
}

/**
 * 每一支插進香爐的香，最終落點都是這條公式算出來的固定值。
 * Temple.tsx 的靜態香枝跟信眾上香時手上那支「正在飛過去」的香都要用同一條公式算，
 * 兩邊才能在動畫結束的瞬間完全對上同一個位置／角度／長度，不會看起來像插完又蹦出另一支。
 */
export function censerStickSlot(index: number, total: number): CenserStickSlot {
  const angle = (index / total) * Math.PI * 2 + index * 0.7;
  const r = 0.16 + ((index * 37) % 5) * 0.1;
  const h = 0.62 + ((index * 13) % 4) * 0.12;
  return {
    x: Math.cos(angle) * r,
    z: Math.sin(angle) * r,
    h,
    tilt: (index % 2 === 0 ? 1 : -1) * 0.03,
  };
}
