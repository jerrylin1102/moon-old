import { create } from 'zustand';
import type { GameMode } from '@moon/shared';

export type Phase = 'landing' | 'prepare' | 'play' | 'summary';
export type Difficulty = 'easy' | 'normal' | 'hard';

interface SessionState {
  phase: Phase;
  mode: GameMode;
  difficulty: Difficulty;
  /** 是否讓 AI 生成的稀有信眾出現（需要後端；關掉就純用預寫願望池） */
  aiRareEnabled: boolean;
  /** 首次進入的免責說明是否已看過 */
  disclaimerSeen: boolean;

  setPhase: (phase: Phase) => void;
  setMode: (mode: GameMode) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  setAiRareEnabled: (enabled: boolean) => void;
  dismissDisclaimer: () => void;
}

export const useSession = create<SessionState>((set) => ({
  phase: 'landing',
  mode: 'rush',
  difficulty: 'normal',
  aiRareEnabled: false,
  disclaimerSeen: false,

  setPhase: (phase) => set({ phase }),
  setMode: (mode) => set({ mode }),
  setDifficulty: (difficulty) => set({ difficulty }),
  setAiRareEnabled: (aiRareEnabled) => set({ aiRareEnabled }),
  dismissDisclaimer: () => set({ disclaimerSeen: true }),
}));
