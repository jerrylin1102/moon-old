import { create } from 'zustand';

/** 已完成配對的紅線，畫給玩家看幾秒 */
export interface ThreadVisual {
  id: number;
  from: [number, number];
  to: [number, number];
  /** performance.now() 的到期時間 */
  until: number;
}

interface InteractionStore {
  /** 目前選中的信眾（傾聽中） */
  focusedId: string | null;
  /** 滑鼠指到的信眾 */
  hoveredId: string | null;
  /** 正在從這位信眾拉紅線 */
  threadFrom: string | null;
  /** 拖曳中的紅線終點（世界座標 x,z），沒有就是 null */
  threadTip: [number, number] | null;
  threads: ThreadVisual[];
  nextThreadId: number;

  focus: (id: string | null) => void;
  hover: (id: string | null) => void;
  startThread: (id: string) => void;
  moveThread: (tip: [number, number] | null) => void;
  endThread: () => void;
  addThread: (from: [number, number], to: [number, number]) => void;
  pruneThreads: () => void;
  reset: () => void;
}

const THREAD_VISIBLE_MS = 2600;

export const useInteraction = create<InteractionStore>((set, get) => ({
  focusedId: null,
  hoveredId: null,
  threadFrom: null,
  threadTip: null,
  threads: [],
  nextThreadId: 1,

  focus: (focusedId) => set({ focusedId }),
  hover: (hoveredId) => set({ hoveredId }),
  startThread: (id) => set({ threadFrom: id, focusedId: id }),
  moveThread: (threadTip) => set({ threadTip }),
  endThread: () => set({ threadFrom: null, threadTip: null }),
  addThread: (from, to) =>
    set((s) => ({
      threads: [
        ...s.threads,
        { id: s.nextThreadId, from, to, until: performance.now() + THREAD_VISIBLE_MS },
      ],
      nextThreadId: s.nextThreadId + 1,
    })),
  pruneThreads: () => {
    const now = performance.now();
    if (get().threads.some((t) => t.until <= now)) {
      set((s) => ({ threads: s.threads.filter((t) => t.until > now) }));
    }
  },
  reset: () =>
    set({ focusedId: null, hoveredId: null, threadFrom: null, threadTip: null, threads: [] }),
}));
