import { describe, expect, it } from 'vitest';
import { createInitialState, DIFFICULTY_PRESETS, type GameState } from './state';
import { advance } from './tick';
import { LANE_X } from './worshipper';
import { spawnInterval } from './spawner';
import type { SimDeps } from './spawner';

const deps: SimDeps = { pickWishId: () => 'love-001', intensityOf: () => 2 };

/** 以固定步長推進 seconds 秒 */
function run(state: GameState, seconds: number): void {
  const stepsPerCall = 8 / 60;
  let left = seconds;
  while (left > 0) {
    const dt = Math.min(stepsPerCall, left);
    advance(state, dt, deps);
    left -= dt;
  }
}

describe('信眾生成', () => {
  it('rush 模式會有人進門', () => {
    const s = createInitialState('rush', 'normal');
    run(s, 10);
    expect(s.worshippers.length).toBeGreaterThan(0);
  });

  it('走道是唯一的，不會兩個人疊在同一條', () => {
    const s = createInitialState('rush', 'hard');
    run(s, 60);
    const lanes = s.worshippers.map((w) => w.lane);
    expect(new Set(lanes).size).toBe(lanes.length);
    expect(s.worshippers.length).toBeLessThanOrEqual(LANE_X.length);
  });

  it('尚未實作的模式不生成信眾', () => {
    for (const mode of ['story', 'sorting'] as const) {
      const s = createInitialState(mode, 'normal');
      run(s, 30);
      expect(s.worshippers).toHaveLength(0);
    }
  });

  it('打烊之後不再放人進來', () => {
    const s = createInitialState('rush', 'normal');
    s.elapsed = s.dayLength;
    run(s, 20);
    expect(s.worshippers).toHaveLength(0);
  });

  it('越接近打烊，人來得越急', () => {
    const early = createInitialState('rush', 'normal');
    const late = createInitialState('rush', 'normal');
    late.elapsed = late.dayLength * 0.95;
    // 有抖動，取多次平均比較
    const mean = (s: GameState) =>
      Array.from({ length: 200 }, () => spawnInterval(s)).reduce((a, b) => a + b, 0) / 200;
    expect(mean(late)).toBeLessThan(mean(early));
  });
});

describe('信眾流程', () => {
  it('會走到香爐上香，香火因此增加', () => {
    const s = createInitialState('rush', 'normal');
    s.incense = 0;
    run(s, 30);
    expect(s.incense).toBeGreaterThan(0);
  });

  it('最後會跪下來說願望並等待回應', () => {
    const s = createInitialState('rush', 'normal');
    run(s, 40);
    const phases = s.worshippers.map((w) => w.phase);
    expect(phases.some((p) => p === 'wishing' || p === 'awaiting')).toBe(true);
  });

  it('沒人回應就過期：累積怨氣與忽略數，然後離場', () => {
    const s = createInitialState('rush', 'normal');
    const patience = DIFFICULTY_PRESETS.normal.patience;
    run(s, 40 + patience + 5);
    expect(s.ignored).toBeGreaterThan(0);
    expect(s.resentment).toBeGreaterThan(0);
  });

  it('離場走完的人會從清單移除，走道讓給下一位', () => {
    const s = createInitialState('rush', 'normal');
    run(s, 180);
    expect(s.worshippers.length).toBeLessThanOrEqual(LANE_X.length);
    expect(s.worshippers.every((w) => w.phase !== 'gone')).toBe(true);
    // 180 秒下來，進出的人數應該超過走道數
    expect(s.nextId).toBeGreaterThan(LANE_X.length);
  });
});
