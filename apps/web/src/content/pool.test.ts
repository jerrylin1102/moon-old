import { describe, expect, it } from 'vitest';
import { officialPool, storyPool, findWish, pickWishId, intensityOf } from './pool';
import { createInitialState } from '../sim/state';
import { SUPPORT_WISH_ID } from './supportWish';

/**
 * 願望池是純資料，最容易在編輯時出錯（重複 id、忘了寫某個 resolution、
 * 文字太長導致氣泡爆版）。這幾條測試就是為了在編輯時擋下來。
 */
describe('官方願望池', () => {
  it('數量夠撐一場班', () => {
    expect(officialPool.length).toBeGreaterThanOrEqual(100);
  });

  it('id 不重複', () => {
    const ids = officialPool.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('每一則都有三種後果，而且不是空字串', () => {
    for (const w of officialPool) {
      for (const key of ['approve', 'reject', 'transfer'] as const) {
        expect(w.resolutions[key].length, `${w.id}.${key}`).toBeGreaterThan(3);
      }
    }
  });

  it('願望長度控制在氣泡塞得下的範圍', () => {
    for (const w of officialPool) {
      expect(w.text.length, w.id).toBeLessThanOrEqual(60);
    }
  });

  it('感情類佔比接近一半——這是月老的本業', () => {
    const love = officialPool.filter((w) => w.category === 'love').length;
    const ratio = love / officialPool.length;
    expect(ratio).toBeGreaterThan(0.35);
    expect(ratio).toBeLessThan(0.65);
  });

  it('不歸月老管的願望要夠多，轉單機制才有戲', () => {
    const others = officialPool.filter((w) => w.domain !== 'yuelao').length;
    expect(others).toBeGreaterThan(20);
  });

  it('挑願望不會連續撞題', () => {
    const s = createInitialState('rush', 'normal');
    const picked = Array.from({ length: 6 }, () => pickWishId(s));
    expect(new Set(picked).size).toBe(picked.length);
  });

  it('題庫夠大時，記憶窗口會放大到遠超過舊版固定的 6 則，連續 30 次也不撞題', () => {
    const s = createInitialState('rush', 'normal');
    s.supportNpcShown = true; // 排除贊助彩蛋的干擾，只看一般抽選邏輯
    const picked = Array.from({ length: 30 }, () => pickWishId(s));
    expect(new Set(picked).size).toBe(picked.length);
  });

  it('查得到願望，也查得到強度', () => {
    const first = officialPool[0]!;
    expect(findWish(first.id)?.text).toBe(first.text);
    expect(intensityOf(first.id)).toBe(first.intensity);
    expect(intensityOf('不存在的願望')).toBe(1);
  });
});

describe('贊助作者彩蛋信眾', () => {
  it('查得到贊助願望的內容', () => {
    const wish = findWish(SUPPORT_WISH_ID);
    expect(wish?.source).toBe('support');
    expect(wish?.text.length).toBeGreaterThan(0);
  });

  it('同一場最多出現一次：一旦標記過就不會再被抽中', () => {
    const s = createInitialState('rush', 'normal');
    s.supportNpcShown = true;
    const picked = Array.from({ length: 300 }, () => pickWishId(s));
    expect(picked.every((id) => id !== SUPPORT_WISH_ID)).toBe(true);
  });

  it('機率不是 0：夠多次嘗試後至少會被抽中一次', () => {
    const s = createInitialState('rush', 'normal');
    const picked = Array.from({ length: 2000 }, () => pickWishId(s));
    expect(picked.some((id) => id === SUPPORT_WISH_ID)).toBe(true);
    // 抽中之後立刻標記，不會在同一輪嘗試裡重複出現
    expect(picked.filter((id) => id === SUPPORT_WISH_ID)).toHaveLength(1);
  });
});

/**
 * 模式 B 專用池，跟 officialPool 分開存放（見 pool.ts 的註解），
 * 但兩邊共用同一個 id 命名空間，混用一套測試邏輯確保不會互相打架。
 */
describe('故事願望池', () => {
  it('id 不重複，而且不會跟官方池撞名', () => {
    const ids = storyPool.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);

    const officialIds = new Set(officialPool.map((w) => w.id));
    for (const id of ids) {
      expect(officialIds.has(id), id).toBe(false);
    }
  });

  it('每一則都有三種後果，而且不是空字串', () => {
    for (const w of storyPool) {
      for (const key of ['approve', 'reject', 'transfer'] as const) {
        expect(w.resolutions[key].length, `${w.id}.${key}`).toBeGreaterThan(3);
      }
    }
  });

  it('都標了 story tag，才不會被一般模式的隨機池誤挑到', () => {
    for (const w of storyPool) {
      expect(w.tags, w.id).toContain('story');
    }
  });

  it('findWish 也查得到故事願望', () => {
    const first = storyPool[0]!;
    expect(findWish(first.id)?.text).toBe(first.text);
  });
});
