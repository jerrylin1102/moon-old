import type { Difficulty } from '../store';
import type { GameMode, WishCategory } from '@moon/shared';
import { buildMemoSchedule, initialRulebook, type RulebookMemo } from './rulebook';

/**
 * 純模擬狀態：這個資料夾不 import three、也不 import react。
 * 三種玩法模式共用同一份底層，並且可以單獨跑測試。
 */

/** 信眾生命週期 */
export type WorshipperPhase =
  | 'entering' // 從廟門走進來
  | 'toCenser' // 走向香爐
  | 'offeringIncense' // 上香
  | 'toAltar' // 走向神桌
  | 'placingOffering' // 擺供品
  | 'kneeling' // 跪下
  | 'wishing' // 說出願望
  | 'awaiting' // 等月老回應（有耐心倒數）
  | 'divining' // 擲筊
  | 'leaving' // 離場
  | 'gone';

export interface Worshipper {
  id: string;
  wishId: string;
  phase: WorshipperPhase;
  /** 目前階段已經過的秒數 */
  phaseTime: number;
  /** 地板座標 [x, z]，y 由渲染層決定 */
  position: [number, number];
  /** 剩餘耐心（秒）。歸零 = 願望被忽略，累積怨氣 */
  patience: number;
  hasOffering: boolean;
  /** 走道編號。一人一道，省掉互相避讓的邏輯 */
  lane: number;
  /** 走路速度，每個人略有差異 */
  speed: number;
  /** 面朝方向（弧度），渲染層直接拿去轉身體 */
  facing: number;
  /** 外觀種子：身高、膚色、衣色都由它決定，同一人每帧長得一樣 */
  seed: number;
}

/** 批示之後浮出來的後果文字。UI 讀它做提示條 */
export interface Outcome {
  id: number;
  text: string;
  tone: 'good' | 'bad' | 'neutral';
  /** 剩餘顯示秒數 */
  ttl: number;
}

/** 信眾留在神桌上的供品。月老可以偷吃回體力 */
export interface Offering {
  id: string;
  /** 神桌上的橫向位置 */
  x: number;
  /** 外觀種子：決定是橘子、糕餅還是一束花 */
  seed: number;
}

/** 這場班還在跑，還是已經收了 */
export type RunStatus = 'running' | 'overwhelmed' | 'closed';

/** 每一件處理過（或沒處理到）的願望，日終要拿來寫日記 */
export interface HandledRecord {
  wishId: string;
  /** 你當時怎麼回應的 */
  action: 'approve' | 'reject' | 'transfer' | 'sheng' | 'xiao' | 'yin' | 'thread' | 'ignored';
  /** 發生在值班的第幾秒 */
  at: number;
}

export interface GameState {
  status: RunStatus;
  /** 打字留言時會暫停：不然打字期間其他信眾的耐心照跑，等於逼玩家放棄留言 */
  paused: boolean;
  mode: GameMode;
  difficulty: Difficulty;
  /** 這天已值班的秒數 */
  elapsed: number;
  /** 一天多長（秒）。rush 模式是撐到打烊 */
  dayLength: number;

  /** 香火：施展神通的資源 */
  incense: number;
  /** 疲勞：越高視聽越衰退、動作越慢 */
  fatigue: number;
  /** 怨氣：滿了就結束值班 */
  resentment: number;
  /** 功德：解鎖用 */
  merit: number;

  handled: number;
  ignored: number;
  matched: number;

  worshippers: Worshipper[];
  /** 距離下一位信眾進門還有幾秒 */
  nextSpawnIn: number;
  /** 下一個信眾 id 的流水號 */
  nextId: number;

  outcomes: Outcome[];
  nextOutcomeId: number;

  /** 神桌上還沒被吃掉的供品 */
  offerings: Offering[];
  /** 香爐裡插著的香數量，每次信眾上香就加一支，上限見 MAX_CENSER_STICKS */
  censerSticks: number;
  /** 批示冷卻：疲勞越高，處理完一個願望後越久才動得了下一個 */
  cooldownUntil: number;
  /** 偷吃供品的次數，日終結算會拿來嘴你 */
  snacks: number;
  /** 今天最累的時候。結算用 */
  peakFatigue: number;
  /** 當日處理歷程，日記從這裡長出來 */
  history: HandledRecord[];

  /**
   * 模式 C 用：業務範圍規則書，category → 目前是否算月老親自受理。
   * 批示對錯永遠看願望自己的 domain，這張表只是玩家看得到的參考（見 sim/rulebook.ts）。
   */
  rulebook: Record<WishCategory, boolean>;
  /** 還沒發出的公文，到了 elapsed 就套用並推播 */
  pendingMemos: RulebookMemo[];
  /** 已經發出的公文紀錄，UI 可以拿來顯示「最近更新」 */
  rulebookLog: { at: number; text: string }[];

  /**
   * 模式 B 用：今天總共會有幾位信眾（5–8 人），0 表示不適用（rush／sorting）。
   * 沒有時限，人數用完、在場的人都走完就打烊——判定邏輯見 tick.ts。
   */
  storyRosterToday: number;
}

export interface DifficultyPreset {
  startingIncense: number;
  /** 怨氣容忍上限，超過就結束 */
  resentmentCap: number;
  /** 信眾等待回應的耐心（秒） */
  patience: number;
  /** 生成間隔的起始值（秒），會隨時間縮短 */
  spawnInterval: number;
}

export const DIFFICULTY_PRESETS: Record<Difficulty, DifficultyPreset> = {
  easy: { startingIncense: 60, resentmentCap: 120, patience: 22, spawnInterval: 9 },
  normal: { startingIncense: 40, resentmentCap: 100, patience: 16, spawnInterval: 6.5 },
  hard: { startingIncense: 25, resentmentCap: 80, patience: 11, spawnInterval: 4.5 },
};

/** 一天的長度（秒），依模式不同 */
const DAY_LENGTH: Record<GameMode, number> = {
  rush: 300,
  story: 0, // 敘事模式沒有時限，處理完當天信眾就收工
  sorting: 240,
};

export function createInitialState(mode: GameMode, difficulty: Difficulty): GameState {
  const preset = DIFFICULTY_PRESETS[difficulty];
  const dayLength = DAY_LENGTH[mode];
  return {
    status: 'running',
    paused: false,
    mode,
    difficulty,
    elapsed: 0,
    dayLength,
    incense: preset.startingIncense,
    fatigue: 0,
    resentment: 0,
    merit: 0,
    handled: 0,
    ignored: 0,
    matched: 0,
    worshippers: [],
    nextSpawnIn: 2,
    nextId: 1,
    outcomes: [],
    nextOutcomeId: 1,
    offerings: [],
    censerSticks: 3,
    cooldownUntil: 0,
    snacks: 0,
    peakFatigue: 0,
    history: [],
    rulebook: initialRulebook(),
    pendingMemos: mode === 'sorting' ? buildMemoSchedule(dayLength) : [],
    rulebookLog: [],
    // 5–8 人，每次開新的一天都重擲一次，故事節奏才不會每天長度都一樣
    storyRosterToday: mode === 'story' ? 5 + Math.floor(Math.random() * 4) : 0,
  };
}
