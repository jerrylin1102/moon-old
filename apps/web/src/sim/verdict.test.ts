import { describe, expect, it } from 'vitest';
import { createInitialState, DIFFICULTY_PRESETS, type GameState, type Worshipper } from './state';
import {
  BLESSING_COST,
  castBlessing,
  castDivination,
  resolveVerdict,
  tieRedThread,
  type WishInfo,
} from './verdict';

const loveWish: WishInfo = {
  intensity: 2,
  category: 'love',
  domain: 'yuelao',
  resolutions: { approve: '成了', reject: '沒成', transfer: '轉走了' },
};

const ticketWish: WishInfo = {
  intensity: 2,
  category: 'ticket',
  domain: 'nobody',
  resolutions: { approve: '搶到了', reject: '沒搶到', transfer: '轉給售票之神' },
};

function waiting(state: GameState, lane = 0): Worshipper {
  const w: Worshipper = {
    id: `w${lane}`,
    wishId: 'love-001',
    phase: 'awaiting',
    phaseTime: 0,
    position: [0, 1],
    patience: 10,
    hasOffering: false,
    lane,
    speed: 1,
    facing: 0,
    seed: 0.5,
  };
  state.worshippers.push(w);
  return w;
}

describe('批示', () => {
  it('准了自己的業務：功德入袋，信眾離場', () => {
    const s = createInitialState('rush', 'normal');
    const w = waiting(s);
    resolveVerdict(s, w, 'approve', loveWish);

    expect(s.handled).toBe(1);
    expect(s.merit).toBe(4);
    expect(w.phase).toBe('leaving');
    expect(s.outcomes.at(-1)?.text).toBe('成了');
  });

  it('准了不屬於自己的業務：越權辦事，功德少、還更累', () => {
    const s = createInitialState('rush', 'normal');
    const own = waiting(s, 0);
    const other = waiting(s, 1);

    resolveVerdict(s, own, 'approve', loveWish);
    const meritOwn = s.merit;
    const fatigueOwn = s.fatigue;

    const s2 = createInitialState('rush', 'normal');
    resolveVerdict(s2, other, 'approve', ticketWish);

    expect(s2.merit).toBeLessThan(meritOwn);
    expect(s2.fatigue).toBeGreaterThan(fatigueOwn);
    expect(s2.resentment).toBeGreaterThan(0);
  });

  it('把自己該管的事轉單出去：怨氣重罰', () => {
    const s = createInitialState('rush', 'normal');
    resolveVerdict(s, waiting(s), 'transfer', loveWish);
    expect(s.resentment).toBe(6);
    expect(s.merit).toBe(0);
  });

  it('把不屬於自己的事轉單出去：正確處置', () => {
    const s = createInitialState('rush', 'normal');
    resolveVerdict(s, waiting(s), 'transfer', ticketWish);
    expect(s.merit).toBe(2);
    expect(s.resentment).toBe(0);
  });
});

describe('擲筊', () => {
  it('聖筊算結案', () => {
    const s = createInitialState('rush', 'normal');
    const w = waiting(s);
    castDivination(s, w, 'sheng', loveWish);
    expect(s.handled).toBe(1);
    expect(w.phase).toBe('leaving');
  });

  it('陰筊算結案，但留下怨氣', () => {
    const s = createInitialState('rush', 'normal');
    const w = waiting(s);
    castDivination(s, w, 'yin', loveWish);
    expect(s.handled).toBe(1);
    expect(s.resentment).toBe(2);
    expect(w.phase).toBe('leaving');
  });

  it('笑筊不算結案：信眾重新問，耐心回補、月老更累', () => {
    const s = createInitialState('rush', 'normal');
    const w = waiting(s);
    w.patience = 1;
    castDivination(s, w, 'xiao', loveWish);

    expect(s.handled).toBe(0);
    expect(w.phase).toBe('awaiting');
    expect(w.patience).toBeCloseTo(DIFFICULTY_PRESETS.normal.patience * 0.8);
    expect(s.fatigue).toBe(3);
  });
});

describe('神通', () => {
  it('香火不足就失敗，而且不扣款', () => {
    const s = createInitialState('rush', 'normal');
    s.incense = BLESSING_COST - 1;
    expect(castBlessing(s)).toBe(false);
    expect(s.incense).toBe(BLESSING_COST - 1);
  });

  it('成功時扣香火並補回等待者的耐心', () => {
    const s = createInitialState('rush', 'normal');
    s.incense = 50;
    const w = waiting(s);
    w.patience = 2;

    expect(castBlessing(s)).toBe(true);
    expect(s.incense).toBe(50 - BLESSING_COST);
    expect(w.patience).toBeGreaterThan(2);
    expect(s.fatigue).toBe(4);
  });
});

describe('牽紅線', () => {
  it('兩邊都是感情事才算配對', () => {
    const s = createInitialState('rush', 'normal');
    const a = waiting(s, 0);
    const b = waiting(s, 1);

    expect(tieRedThread(s, a, b, loveWish, loveWish)).toBe(true);
    expect(s.matched).toBe(1);
    expect(s.handled).toBe(2);
    expect(a.phase).toBe('leaving');
    expect(b.phase).toBe('leaving');
  });

  it('接錯線：不配對，還累積怨氣', () => {
    const s = createInitialState('rush', 'normal');
    const a = waiting(s, 0);
    const b = waiting(s, 1);

    expect(tieRedThread(s, a, b, loveWish, ticketWish)).toBe(false);
    expect(s.matched).toBe(0);
    expect(s.resentment).toBe(2);
    expect(a.phase).toBe('awaiting');
  });

  it('不能自己接自己', () => {
    const s = createInitialState('rush', 'normal');
    const a = waiting(s, 0);
    expect(tieRedThread(s, a, a, loveWish, loveWish)).toBe(false);
  });
});
