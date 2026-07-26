import { useEffect } from 'react';
import { fetchRareWish } from '../api';
import { hasRareWish, stashRareWish } from '../content/pool';

/** 每隔多久補一次貨 */
const INTERVAL_MS = 30_000;

/**
 * 值班中在背景預抓 AI 生成的稀有信眾。
 *
 * 為什麼要預抓：生成要等一兩秒，不能讓信眾卡在門口等 API。
 * 抓不到就什麼都不做——spawner 自己會用預寫願望池頂上，玩家不會看到任何錯誤。
 */
export function useRareWishes(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let alive = true;
    const top = () => {
      if (!alive || hasRareWish()) return;
      void fetchRareWish().then((wish) => {
        if (alive && wish) stashRareWish(wish);
      });
    };

    top();
    const timer = setInterval(top, INTERVAL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [enabled]);
}
