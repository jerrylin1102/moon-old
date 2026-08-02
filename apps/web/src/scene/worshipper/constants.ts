import { LANE_X } from '../../sim/worshipper';

/**
 * 信眾。身體共用幾個 InstancedMesh（衣袍＋頭＋雙手＋雙腳），
 * 所以不管來幾個人都只吃固定張數的 draw call。
 *
 * 實例索引直接用走道編號：走道在同一時間是唯一的，
 * 用它當索引就不會因為有人離場、陣列重排而讓大家「突然換衣服」。
 */
export const SLOTS = LANE_X.length;

/** 衣色刻意用高飽和度撞色：跟廟裡暖紅金的場景配色拉開差距，人群才會在畫面裡跳出來 */
export const ROBE_COLORS = [
  '#2f7dff',
  '#ff3d7f',
  '#33cc66',
  '#ffd23f',
  '#9b4dff',
  '#00d1d1',
  '#3ddc97',
  '#4d79ff',
];
export const SKIN_COLORS = ['#d8ab82', '#c69670', '#eec5a0', '#b5875c'];

/** 女性信眾頭上蝴蝶結的顏色 */
export const BOW_COLOR = '#ff5fa2';
