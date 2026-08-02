import { describe, expect, it } from 'vitest';
import { createInitialState, DIFFICULTY_PRESETS, type GameState } from './state';
import { addResentment, eatOffering, OFFERING_RECOVERY } from './resources';
import {
  onCooldown,
  startCooldown,
  strain,
  verdictCooldown,
  vignetteDarkness,
  wishNoiseRatio,
} from './fatigue';
import { advance } from './tick';
import type { SimDeps } from './spawner';

const deps: SimDeps = { pickWishId: () => 'love-001', intensityOf: () => 2 };

function run(state: GameState, seconds: number): void {
  let left = seconds;
  while (left > 0) {
    const dt = Math.min(8 / 60, left);
    advance(state, dt, deps);
    left -= dt;
  }
}

describe('疲勞的後果', () => {
  it('低疲勞完全沒有負面效果', () => {
    const s = createInitialState('rush', 'normal');
    s.fatigue = 30;
    expect(strain(s)).toBe(0);
    expect(wishNoiseRatio(s)).toBe(0);
    expect(verdictCooldown(s)).toBe(0);
  });

  it('過了寬容值之後，聽不清楚、手也變慢', () => {
    const s = createInitialState('rush', 'normal');
    s.fatigue = 100;
    expect(strain(s)).toBe(1);
    expect(wishNoiseRatio(s)).toBeCloseTo(0.45);
    expect(verdictCooldown(s)).toBeCloseTo(1.4);
    expect(vignetteDarkness(s)).toBeGreaterThan(vignetteDarkness(createInitialState('rush', 'normal')));
  });

  it('冷卻會隨時間過去', () => {
    const s = createInitialState('rush', 'normal');
    s.fatigue = 100;
    startCooldown(s);
    expect(onCooldown(s)).toBe(true);
    s.elapsed += 1.5;
    expect(onCooldown(s)).toBe(false);
  });

  it('不累的時候批示沒有冷卻', () => {
    const s = createInitialState('rush', 'normal');
    startCooldown(s);
    expect(onCooldown(s)).toBe(false);
  });
});

describe('供品', () => {
  it('信眾擺完供品，神桌上就會多一份', () => {
    // 只有四成多的信眾會帶供品，靠隨機生成來測會偶發失敗，
    // 所以直接把一位帶供品的信眾推到「擺供品」那個階段
    const s = createInitialState('rush', 'normal');
    s.worshippers.push({
      id: 'w1',
      wishId: 'love-001',
      phase: 'placingOffering',
      phaseTime: 0,
      position: [0, 1],
      patience: 10,
      hasOffering: true,
      lane: 0,
      speed: 1,
      facing: 0,
      seed: 0.9,
      gender: 'male',
    });

    run(s, 2);
    expect(s.offerings).toHaveLength(1);
    expect(s.worshippers[0]?.phase).toBe('kneeling');
  });

  it('偷吃回體力，但會累積一點怨氣', () => {
    const s = createInitialState('rush', 'normal');
    s.offerings.push({ id: 'o1', x: 0, seed: 0.5 });
    s.fatigue = 50;

    expect(eatOffering(s, 'o1')).toBe(true);
    expect(s.fatigue).toBe(50 - OFFERING_RECOVERY);
    expect(s.snacks).toBe(1);
    expect(s.resentment).toBe(1);
    expect(s.offerings).toHaveLength(0);
  });

  it('吃不存在的供品不會有事', () => {
    const s = createInitialState('rush', 'normal');
    expect(eatOffering(s, 'nope')).toBe(false);
    expect(s.snacks).toBe(0);
  });
});

describe('暫停', () => {
  it('暫停時時間與信眾都不動——打字留言不該讓別人的耐心流失', () => {
    const s = createInitialState('rush', 'normal');
    run(s, 30);
    const snapshot = {
      elapsed: s.elapsed,
      worshippers: s.worshippers.length,
      patience: s.worshippers[0]?.patience,
    };

    s.paused = true;
    run(s, 20);

    expect(s.elapsed).toBe(snapshot.elapsed);
    expect(s.worshippers.length).toBe(snapshot.worshippers);
    expect(s.worshippers[0]?.patience).toBe(snapshot.patience);

    s.paused = false;
    run(s, 1);
    expect(s.elapsed).toBeGreaterThan(snapshot.elapsed);
  });
});

describe('收班條件', () => {
  it('怨氣滿了就收攤，而且不再有人進門', () => {
    const s = createInitialState('rush', 'normal');
    addResentment(s, DIFFICULTY_PRESETS.normal.resentmentCap);
    run(s, 2);

    expect(s.status).toBe('overwhelmed');
    const count = s.worshippers.length;
    run(s, 30);
    expect(s.worshippers.length).toBeLessThanOrEqual(count);
  });

  it('時間到就打烊', () => {
    const s = createInitialState('rush', 'normal');
    s.elapsed = s.dayLength - 0.5;
    run(s, 2);
    expect(s.status).toBe('closed');
  });

  it('記得今天最累的時候', () => {
    const s = createInitialState('rush', 'normal');
    s.fatigue = 70;
    run(s, 1);
    s.fatigue = 20;
    run(s, 1);
    expect(s.peakFatigue).toBeGreaterThanOrEqual(70);
  });
});
