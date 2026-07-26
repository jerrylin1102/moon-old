import { describe, expect, it } from 'vitest';
import { createInitialState } from './state';
import {
  addFatigue,
  addIncense,
  addResentment,
  isOverwhelmed,
  spendIncense,
  FATIGUE_MAX,
  INCENSE_MAX,
} from './resources';
import { advance } from './tick';

describe('香火', () => {
  it('不會超過上限', () => {
    const s = createInitialState('rush', 'normal');
    addIncense(s, 9999);
    expect(s.incense).toBe(INCENSE_MAX);
  });

  it('香火不足時整筆不扣', () => {
    const s = createInitialState('rush', 'normal');
    s.incense = 5;
    expect(spendIncense(s, 20)).toBe(false);
    expect(s.incense).toBe(5);
  });

  it('香火足夠時才扣款', () => {
    const s = createInitialState('rush', 'normal');
    s.incense = 30;
    expect(spendIncense(s, 20)).toBe(true);
    expect(s.incense).toBe(10);
  });
});

describe('疲勞', () => {
  it('夾在 0 與上限之間', () => {
    const s = createInitialState('rush', 'normal');
    addFatigue(s, 500);
    expect(s.fatigue).toBe(FATIGUE_MAX);
    addFatigue(s, -500);
    expect(s.fatigue).toBe(0);
  });

  it('沒人在等的時候會回復', () => {
    const s = createInitialState('rush', 'normal');
    s.fatigue = 50;
    advance(s, 0.1);
    expect(s.fatigue).toBeLessThan(50);
  });
});

describe('怨氣', () => {
  it('達到難度上限就算被淹沒', () => {
    const s = createInitialState('rush', 'hard');
    expect(isOverwhelmed(s)).toBe(false);
    addResentment(s, 9999);
    expect(s.resentment).toBe(80); // hard 的 resentmentCap
    expect(isOverwhelmed(s)).toBe(true);
  });
});

describe('固定步長', () => {
  it('把大 dt 截斷，不會一次補上幾千步', () => {
    const s = createInitialState('rush', 'normal');
    advance(s, 60);
    expect(s.elapsed).toBeCloseTo((1 / 60) * 8, 5);
  });
});
