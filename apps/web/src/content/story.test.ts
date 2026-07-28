import { describe, expect, it } from 'vitest';
import { storyPool } from './pool';
import { advanceStorySave, buildDayRoster, emptyStorySave, type StorySave } from './story';

/**
 * 這裡只測純函式（buildDayRoster、advanceStorySave）。
 * loadStorySave／persistStorySave 碰 localStorage，vitest 預設是 node 環境沒有這個全域物件，
 * 兩者都已經包了 try/catch（跟 authStore.ts 的 guest 存檔同一套風格），不會噴錯，但也測不出東西，
 * 所以持久化那層留給人工在瀏覽器裡驗證（見 README 的驗證方式段落）。
 */

const fixedRandom = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe('故事願望池', () => {
  it('每一則都有 followUp 就要指向池子裡真的存在的 id', () => {
    for (const w of storyPool) {
      if (!w.followUp) continue;
      expect(storyPool.some((x) => x.id === w.followUp), `${w.id} -> ${w.followUp}`).toBe(true);
    }
  });

  it('數量夠排一天 5–8 人的名單，不用馬上重複', () => {
    expect(storyPool.length).toBeGreaterThanOrEqual(8);
  });
});

describe('排今天的名單', () => {
  it('回訪的人一定會被排進去，而且排在最前面', () => {
    const save: StorySave = { day: 2, pendingFollowUps: ['story-01b'], metCharacters: ['story-01'] };
    const roster = buildDayRoster(save, 5);
    expect(roster[0]).toBe('story-01b');
    expect(roster).toHaveLength(5);
  });

  it('沒有回訪的人時，全部從池子裡隨機挑，不重複', () => {
    const save = emptyStorySave();
    const roster = buildDayRoster(save, 6, storyPool, fixedRandom([0, 0.2, 0.4, 0.6, 0.8, 0.1]));
    expect(roster).toHaveLength(6);
    expect(new Set(roster).size).toBe(roster.length);
  });

  it('已經遇過的角色，名額還夠的話會優先避開', () => {
    const save: StorySave = {
      day: 3,
      pendingFollowUps: [],
      metCharacters: storyPool.slice(0, storyPool.length - 2).map((w) => w.id),
    };
    const roster = buildDayRoster(save, 2, storyPool, fixedRandom([0]));
    for (const id of roster) {
      expect(save.metCharacters).not.toContain(id);
    }
  });

  it('角色都遇過了，寧可重複也要把名額排滿', () => {
    const save: StorySave = {
      day: 10,
      pendingFollowUps: [],
      metCharacters: storyPool.map((w) => w.id),
    };
    const roster = buildDayRoster(save, 3, storyPool, fixedRandom([0]));
    expect(roster).toHaveLength(3);
  });
});

describe('收工結算', () => {
  it('有回應而且有下集的願望，會排進明天的回訪佇列；沒聽到的不會', () => {
    const save = emptyStorySave();
    const next = advanceStorySave(save, [
      { wishId: 'story-01', action: 'approve' },
      { wishId: 'story-06', action: 'reject' }, // story-06 沒有 followUp
      { wishId: 'story-02', action: 'ignored' }, // 有 followUp 但沒聽到，不算
    ]);

    expect(next.day).toBe(save.day + 1);
    expect(next.pendingFollowUps).toEqual(['story-01b']);
    expect(next.metCharacters).toEqual(
      expect.arrayContaining(['story-01', 'story-06', 'story-02']),
    );
  });

  it('已經遇過的角色會累積，不會被下一天的結算蓋掉', () => {
    const save: StorySave = { day: 1, pendingFollowUps: [], metCharacters: ['story-08'] };
    const next = advanceStorySave(save, [{ wishId: 'story-07', action: 'approve' }]);
    expect(next.metCharacters).toEqual(expect.arrayContaining(['story-07', 'story-08']));
  });
});
