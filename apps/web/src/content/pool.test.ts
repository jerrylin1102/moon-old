import { describe, expect, it } from 'vitest';
import { officialPool, findWish, pickWishId, intensityOf } from './pool';

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
    const picked = Array.from({ length: 6 }, () => pickWishId());
    expect(new Set(picked).size).toBe(picked.length);
  });

  it('查得到願望，也查得到強度', () => {
    const first = officialPool[0]!;
    expect(findWish(first.id)?.text).toBe(first.text);
    expect(intensityOf(first.id)).toBe(first.intensity);
    expect(intensityOf('不存在的願望')).toBe(1);
  });
});
