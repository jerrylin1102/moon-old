import { useCallback, useEffect } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useGame } from '../../gameStore';
import { isWaiting } from '../../sim/worshipper';
import type { Worshipper } from '../../sim/state';
import { useInteraction } from '../../interactionStore';
import { applyThread } from '../../actions';

/**
 * 信眾的指標事件（點選、拖紅線、hover）。
 * 命中盒的實例索引就是走道編號，所以只要反查現在站在那條走道上的是誰即可。
 */
export function useWorshipperInteraction() {
  const worshipperAt = useCallback((slot: number | undefined): Worshipper | undefined => {
    if (slot === undefined) return undefined;
    return useGame.getState().state?.worshippers.find((w) => w.lane === slot);
  }, []);

  const onDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (useGame.getState().state?.status !== 'running') return;
      const w = worshipperAt(e.instanceId);
      if (!w || !isWaiting(w)) return;
      e.stopPropagation();
      // 按下就先選中；如果接著拖到別人身上，就變成牽紅線
      useInteraction.getState().startThread(w.id);
    },
    [worshipperAt],
  );

  const onUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const w = worshipperAt(e.instanceId);
      const { threadFrom, endThread, focus } = useInteraction.getState();
      if (!w || !threadFrom) return;
      e.stopPropagation();

      if (w.id !== threadFrom) {
        applyThread(threadFrom, w.id);
      } else {
        focus(w.id);
      }
      endThread();
    },
    [worshipperAt],
  );

  const onMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const w = worshipperAt(e.instanceId);
      useInteraction.getState().hover(w && isWaiting(w) ? w.id : null);
    },
    [worshipperAt],
  );

  const onOut = useCallback(() => useInteraction.getState().hover(null), []);

  // 手指或滑鼠放在廟裡任何地方鬆開，都要結束拖曳中的紅線
  useEffect(() => {
    const end = () => useInteraction.getState().endThread();
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, []);

  return { worshipperAt, onDown, onUp, onMove, onOut };
}
