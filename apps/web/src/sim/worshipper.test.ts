import { describe, expect, it } from 'vitest';
import { createInitialState, DIFFICULTY_PRESETS, type GameState } from './state';
import { advance } from './tick';
import { LANE_X, createWorshipper, pickGender, updateWorshipper } from './worshipper';
import { DOOR_Z } from '../scene/layout';
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

  it('sorting 模式也會有人進門，但節奏比 rush 慢', () => {
    const s = createInitialState('sorting', 'normal');
    run(s, 20);
    expect(s.worshippers.length).toBeGreaterThan(0);

    const rush = createInitialState('rush', 'normal');
    const sorting = createInitialState('sorting', 'normal');
    const mean = (state: GameState) =>
      Array.from({ length: 200 }, () => spawnInterval(state)).reduce((a, b) => a + b, 0) / 200;
    expect(mean(sorting)).toBeGreaterThan(mean(rush));
  });

  it('story 模式一天只生成規定的人數，生完就不再放人進來', () => {
    const s = createInitialState('story', 'normal');
    run(s, 400);
    // nextId 從 1 開始累加，生成過的人數 = nextId - 1
    expect(s.nextId - 1).toBe(s.storyRosterToday);
  });

  it('story 模式沒有時限，但名額用完、人也走光了就會打烊', () => {
    const s = createInitialState('story', 'easy');
    run(s, 600);
    expect(s.status).toBe('closed');
    expect(s.worshippers).toHaveLength(0);
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

describe('性別平衡', () => {
  it('連續生成很多信眾後，男女數量大致平衡、不會單場全男或全女', () => {
    const s = createInitialState('rush', 'normal');
    for (let i = 0; i < 500; i++) {
      const gender = pickGender(s);
      if (gender === 'male') s.spawnedMale += 1;
      else s.spawnedFemale += 1;
    }
    expect(s.spawnedMale).toBeGreaterThan(0);
    expect(s.spawnedFemale).toBeGreaterThan(0);
    // 平衡機制是機率性修正，不保證每一刻都貼在 0，但長期下來差距要遠小於總數
    expect(Math.abs(s.spawnedMale - s.spawnedFemale)).toBeLessThanOrEqual(8);
  });

  it('某一邊生成得明顯多之後，下一位有高機率補少的那邊', () => {
    const s = createInitialState('rush', 'normal');
    s.spawnedMale = 10;
    s.spawnedFemale = 0;
    let femaleCount = 0;
    for (let i = 0; i < 100; i++) {
      if (pickGender(s) === 'female') femaleCount += 1;
    }
    expect(femaleCount).toBeGreaterThan(60);
  });
});

describe('路徑多樣化', () => {
  it('進門時，同一走道不同 seed 的信眾落點會不同，不會每次都走同一條線', () => {
    const s = createInitialState('rush', 'normal');
    const a = createWorshipper(s, 'love-001', 0, 10, 'male');
    const b = createWorshipper(s, 'love-001', 0, 10, 'male');
    a.seed = 0.11;
    b.seed = 0.87;

    updateWorshipper(s, a, 0.1, () => 2);
    updateWorshipper(s, b, 0.1, () => 2);

    expect(a.position[0]).not.toBeCloseTo(b.position[0], 5);
  });

  it('一般離場（沒有配對）過了彎繞時間後，目標會收斂回自己走道，即使起點被推偏了也會往回走', () => {
    const s = createInitialState('rush', 'normal');
    const w = createWorshipper(s, 'love-001', 2, 10, 'male');
    w.phase = 'leaving';
    w.phaseTime = 10; // 遠超過彎繞時間，目標應該已經完全收斂到走道本身
    const laneX = LANE_X[2] ?? 0;
    const startX = laneX + 2; // 模擬起點被彎繞或碰撞推離了走道
    w.position = [startX, DOOR_Z - 1.5 - 3];

    updateWorshipper(s, w, 0.1, () => 2);
    // 目標已收斂到 laneX，人應該往 laneX 的方向移動（x 變小），不是繼續往外飄
    expect(w.position[0]).toBeLessThan(startX);
  });

  it('紅線配對成功離場的兩人，目標收斂到共同的走道中點，不會額外彎繞', () => {
    const s = createInitialState('rush', 'normal');
    const w = createWorshipper(s, 'love-001', 0, 10, 'male');
    w.phase = 'leaving';
    w.phaseTime = 0;
    w.exitX = 1.23;
    w.position = [LANE_X[0] ?? 0, DOOR_Z - 1.5 - 3];

    updateWorshipper(s, w, 0.1, () => 2);
    expect(w.position[0]).toBeGreaterThan(LANE_X[0] ?? 0); // 往 exitX（正值）方向移動，而不是停在原走道
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
