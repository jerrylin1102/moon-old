import { create } from 'zustand';

/** 已完成配對的紅線，畫給玩家看幾秒 */
export interface ThreadVisual {
  id: number;
  from: [number, number];
  to: [number, number];
  /** performance.now() 的到期時間 */
  until: number;
}

/** 紅線配對成功時的愛心粒子噴發：男女配對用紅色，同性配對用彩虹色 */
export interface HeartBurstVisual {
  id: number;
  from: [number, number];
  to: [number, number];
  rainbow: boolean;
  startedAt: number;
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
  heartBursts: HeartBurstVisual[];
  nextHeartBurstId: number;
  /** 目前打開贊助彈窗的是哪位信眾（點「准」後開啟，關閉時要幫這位信眾正常收尾） */
  supportPromptId: string | null;

  focus: (id: string | null) => void;
  hover: (id: string | null) => void;
  startThread: (id: string) => void;
  moveThread: (tip: [number, number] | null) => void;
  endThread: () => void;
  addThread: (from: [number, number], to: [number, number]) => void;
  pruneThreads: () => void;
  addHeartBurst: (from: [number, number], to: [number, number], rainbow: boolean) => void;
  pruneHeartBursts: () => void;
  openSupportPrompt: (id: string) => void;
  closeSupportPrompt: () => void;
  reset: () => void;
}

const THREAD_VISIBLE_MS = 2600;
const HEART_BURST_VISIBLE_MS = 2200;

export const useInteraction = create<InteractionStore>((set, get) => ({
  focusedId: null,
  hoveredId: null,
  threadFrom: null,
  threadTip: null,
  threads: [],
  nextThreadId: 1,
  heartBursts: [],
  nextHeartBurstId: 1,
  supportPromptId: null,

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
  addHeartBurst: (from, to, rainbow) =>
    set((s) => {
      const now = performance.now();
      return {
        heartBursts: [
          ...s.heartBursts,
          { id: s.nextHeartBurstId, from, to, rainbow, startedAt: now, until: now + HEART_BURST_VISIBLE_MS },
        ],
        nextHeartBurstId: s.nextHeartBurstId + 1,
      };
    }),
  pruneHeartBursts: () => {
    const now = performance.now();
    if (get().heartBursts.some((b) => b.until <= now)) {
      set((s) => ({ heartBursts: s.heartBursts.filter((b) => b.until > now) }));
    }
  },
  openSupportPrompt: (id) => set({ supportPromptId: id }),
  closeSupportPrompt: () => set({ supportPromptId: null }),
  reset: () =>
    set({
      focusedId: null,
      hoveredId: null,
      threadFrom: null,
      threadTip: null,
      threads: [],
      heartBursts: [],
      supportPromptId: null,
    }),
}));
