import { describe, expect, it } from 'vitest';
import { checkNickname, checkRules, shouldAutoReject } from './rules';

describe('投稿過濾規則', () => {
  it('放行正常的願望', () => {
    expect(checkRules('月老，我想跟隔壁桌那個穿藍衣服的人講話，可是我不敢。')).toEqual([]);
  });

  it.each([
    ['0912345678', 'phone'],
    ['0912-345-678', 'phone'],
    ['02 2345 6789', 'phone'],
    ['someone@example.com', 'email'],
    ['https://example.com', 'url'],
    ['我的 IG: abcdefg', 'social_handle'],
    ['A123456789', 'national_id'],
  ])('攔下含有聯絡方式或個資的內容：%s', (fragment, flag) => {
    const flags = checkRules(`月老幫我牽線，我的資訊是 ${fragment} 謝謝你`);
    expect(flags).toContain(flag);
    expect(shouldAutoReject(flags)).toBe(true);
  });

  it('髒話會被標記，但不自動退件——交給人工判斷', () => {
    const flags = checkRules('月老，我前任是智障，但我還是有點想他。');
    expect(flags).toContain('profanity');
    expect(shouldAutoReject(flags)).toBe(false);
  });

  it('抱怨前任不算辱罵', () => {
    expect(checkRules('月老，我前任真的很爛，但我沒有要他不好過。')).toEqual([]);
  });

  it('灌水與空內容擋下來', () => {
    expect(checkRules('啊啊啊啊啊啊啊啊啊啊')).toContain('repetition');
    expect(checkRules('。。。，，，！！！')).toContain('too_few_chars');
  });
});

describe('暱稱過濾', () => {
  it('短暱稱不算違規——那是給願望用的長度規則', () => {
    expect(checkNickname('值班月老')).toEqual([]);
    expect(checkNickname('阿明')).toEqual([]);
  });

  it('暱稱裡的廣告與辱罵還是要擋', () => {
    expect(checkNickname('買讚www.spam.com')).toContain('url');
    expect(checkNickname('智障玩家')).toContain('profanity');
  });
});
