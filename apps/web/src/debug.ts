import { create } from 'zustand';

/** 開發期效能監看：對照計畫的效能預算（draw call < 100、手機 60fps） */
interface DebugStore {
  fps: number;
  drawCalls: number;
  triangles: number;
  setStats: (stats: { fps: number; drawCalls: number; triangles: number }) => void;
}

export const useDebug = create<DebugStore>((set) => ({
  fps: 0,
  drawCalls: 0,
  triangles: 0,
  setStats: (stats) => set(stats),
}));
