import { describe, expect, it } from 'vitest';
import { createInitialState } from './state';
import { addScoreBonus, bonusMultiplier, computeScore } from './score';

describe('分數加成係數', () => {
  it('稀有（AI）信眾多 20%，社群信眾多 12%，官方願望不變', () => {
    expect(bonusMultiplier('ai')).toBeCloseTo(1.2);
    expect(bonusMultiplier('community')).toBeCloseTo(1.12);
    expect(bonusMultiplier('official')).toBe(1);
  });
});

describe('addScoreBonus / computeScore', () => {
  it('原本 100 分的官方互動不變；同樣 100 分的稀有互動多拿 20 分', () => {
    const official = createInitialState('rush', 'normal');
    official.handled = 10; // 10 * 10 = 100 分基礎
    addScoreBonus(official, 100, 'official');
    expect(computeScore(official)).toBe(100);

    const rare = createInitialState('rush', 'normal');
    rare.handled = 10;
    addScoreBonus(rare, 100, 'ai');
    expect(computeScore(rare)).toBe(120);

    const community = createInitialState('rush', 'normal');
    community.handled = 10;
    addScoreBonus(community, 100, 'community');
    expect(computeScore(community)).toBe(112);
  });

  it('非正分（<=0）不套加成', () => {
    const s = createInitialState('rush', 'normal');
    addScoreBonus(s, 0, 'ai');
    addScoreBonus(s, -5, 'ai');
    expect(s.bonusScore).toBe(0);
  });
});
