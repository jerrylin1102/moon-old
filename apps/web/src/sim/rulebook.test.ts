import { describe, expect, it } from 'vitest';
import { createInitialState } from './state';
import { advance } from './tick';
import { buildMemoSchedule, complaintFor, initialRulebook } from './rulebook';

describe('規則書初始值', () => {
  it('等於現實：感情／健康歸月老，其餘類別要轉單', () => {
    const book = initialRulebook();
    expect(book.love).toBe(true);
    expect(book.health).toBe(true);
    expect(book.money).toBe(false);
    expect(book.exam).toBe(false);
    expect(book.revenge).toBe(false);
    expect(book.ticket).toBe(false);
    expect(book.absurd).toBe(false);
  });
});

describe('公文腳本', () => {
  it('沒有一天長度就不排公文（story 模式）', () => {
    expect(buildMemoSchedule(0)).toHaveLength(0);
  });

  it('公文的發文時間都落在一天長度之內', () => {
    const memos = buildMemoSchedule(240);
    expect(memos.length).toBeGreaterThan(0);
    for (const m of memos) {
      expect(m.at).toBeGreaterThan(0);
      expect(m.at).toBeLessThan(240);
    }
  });
});

describe('公文套用', () => {
  it('sorting 模式一開局就排好了待發公文', () => {
    const s = createInitialState('sorting', 'normal');
    expect(s.pendingMemos.length).toBeGreaterThan(0);
    expect(s.rulebookLog).toHaveLength(0);
  });

  it('其他模式不排公文，規則書維持初始值不變', () => {
    const s = createInitialState('rush', 'normal');
    expect(s.pendingMemos).toHaveLength(0);
  });

  it('時間到了就套用公文：規則書更新、推播一則 outcome、記進 log', () => {
    const s = createInitialState('sorting', 'normal');
    const firstMemo = s.pendingMemos[0]!;
    s.elapsed = firstMemo.at;

    advance(s, 1 / 60, { pickWishId: () => 'love-001', intensityOf: () => 1 });

    expect(s.rulebook[firstMemo.category]).toBe(firstMemo.inScope);
    expect(s.rulebookLog.some((l) => l.text === firstMemo.headline)).toBe(true);
    expect(s.outcomes.some((o) => o.text === firstMemo.headline)).toBe(true);
    expect(s.pendingMemos).not.toContain(firstMemo);
  });
});

describe('抱怨文案', () => {
  it('沒人管的類別有自己的吐槽，不提神明名字', () => {
    expect(complaintFor('nobody', true)).toContain('沒人管');
  });

  it('其他神明的抱怨會提到祂的名字', () => {
    expect(complaintFor('caishen', true)).toContain('財神');
    expect(complaintFor('wenchang', false)).toContain('文昌帝君');
  });
});
