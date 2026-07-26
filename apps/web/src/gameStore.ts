import { create } from 'zustand';
import type { GameMode } from '@moon/shared';
import { createInitialState, type GameState } from './sim/state';
import type { Difficulty } from './store';

/**
 * 遊戲狀態刻意放在 zustand 外層當「可變物件」：
 * 模擬層每帧直接改動 state，UI 只在 version 變動時重繪（約 10Hz），
 * 避免每帧觸發 React re-render。
 */
interface GameStore {
  state: GameState | null;
  version: number;
  start: (mode: GameMode, difficulty: Difficulty) => void;
  end: () => void;
  bump: () => void;
}

export const useGame = create<GameStore>((set) => ({
  state: null,
  version: 0,
  start: (mode, difficulty) => set({ state: createInitialState(mode, difficulty), version: 0 }),
  end: () => set({ state: null }),
  bump: () => set((s) => ({ version: s.version + 1 })),
}));
