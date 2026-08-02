import { create } from 'zustand';
import type { GameMode } from '@moon/shared';

export type Phase = 'landing' | 'prepare' | 'play' | 'summary';
export type Difficulty = 'easy' | 'normal' | 'hard';

interface SessionState {
  phase: Phase;
  mode: GameMode;
  difficulty: Difficulty;
  /** 首次進入的免責說明是否已看過 */
  disclaimerSeen: boolean;

  setPhase: (phase: Phase) => void;
  setMode: (mode: GameMode) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  dismissDisclaimer: () => void;
}

export const useSession = create<SessionState>((set) => ({
  phase: 'landing',
  mode: 'rush',
  difficulty: 'normal',
  disclaimerSeen: false,

  setPhase: (phase) => set({ phase }),
  setMode: (mode) => set({ mode }),
  setDifficulty: (difficulty) => set({ difficulty }),
  dismissDisclaimer: () => set({ disclaimerSeen: true }),
}));
