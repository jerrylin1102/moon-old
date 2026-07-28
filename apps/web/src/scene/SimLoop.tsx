import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGame } from '../gameStore';
import { advance } from '../sim/tick';
import type { SimDeps } from '../sim/spawner';
import { findWish, intensityOf, pickWishId } from '../content/pool';
import { pickStoryWishId } from '../content/story';
import { reportInteraction } from '../api';
import { useAuth } from '../authStore';
import { useInteraction } from '../interactionStore';
import { isWaiting } from '../sim/worshipper';

/** 把模擬層接上渲染迴圈。UI 用約 10Hz 的節奏更新，不跟著每帧重繪 */
export function SimLoop() {
  const uiAcc = useRef(0);
  /** 已經回報過的歷程長度。history 只會往後長，所以一個游標就夠 */
  const reported = useRef(0);
  // 願望池是渲染層的資料，用 deps 注入模擬層，維持 sim 的純淨。
  // 模式 B 的名單是值班開始時就排好的（見 story.ts），這裡只依當下模式決定要從哪個池子挑
  const deps = useMemo<SimDeps>(
    () => ({
      pickWishId: () =>
        useGame.getState().state?.mode === 'story' ? pickStoryWishId() : pickWishId(),
      intensityOf,
    }),
    [],
  );

  useFrame((_, dt) => {
    const { state, bump } = useGame.getState();
    if (!state) return;

    advance(state, dt, deps);

    // 別人的願望被怎麼對待，作者有權知道。
    // 集中在這裡回報，批示、擲筊、牽紅線、沒聽到全都涵蓋，不會漏掉某條路徑
    if (state.history.length > reported.current) {
      const guestId = useAuth.getState().guest.guestId;
      const isGuest = useAuth.getState().me === null;
      for (const record of state.history.slice(reported.current)) {
        const wish = findWish(record.wishId);
        if (wish?.source === 'community' && wish.submissionId) {
          reportInteraction(wish.submissionId, record.action, isGuest ? guestId : undefined);
        }
      }
      reported.current = state.history.length;
    }

    uiAcc.current += dt;
    if (uiAcc.current >= 0.1) {
      uiAcc.current = 0;

      // 選中的人如果等到不耐煩走了，選取狀態要跟著清掉，
      // 否則手機那排按鈕會維持可按，按下去卻什麼都沒發生
      const { focusedId, focus } = useInteraction.getState();
      if (focusedId) {
        const still = state.worshippers.find((w) => w.id === focusedId);
        if (!still || !isWaiting(still)) focus(null);
      }

      bump();
    }
  });

  return null;
}
