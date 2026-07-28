import type { DeityDomain, WishCategory } from '@moon/shared';
import type { GameState } from './state';
import { addFatigue } from './resources';

/**
 * 模式 C「神明轉單」的核心資料。
 *
 * 批示對錯永遠只看每則願望自己的 `domain` 欄位（見 verdict.ts 的 isMyDepartment）——
 * 這裡的「規則書」只是玩家看得到、可能被公文改得跟現實不一樣的參考資料。
 * 玩家照規則書辦事，結果卻被現實打臉，就是這個模式的笑點與難度來源。
 */

/** 神明中文稱呼，規則書與抱怨文案共用 */
export const DEITY_LABEL: Record<DeityDomain, string> = {
  yuelao: '月老',
  caishen: '財神',
  wenchang: '文昌帝君',
  zhusheng: '註生娘娘',
  chenghuang: '城隍爺',
  nobody: '沒人管',
};

export const CATEGORY_LABEL: Record<WishCategory, string> = {
  love: '感情',
  money: '財運',
  exam: '考試',
  ticket: '搶票',
  health: '健康',
  revenge: '報復',
  absurd: '離譜',
};

/**
 * 現實中真正該管這件事的神明（願望池目前的分佈）。
 * 只當公文腳本與抱怨文案的參考表，不參與批示判定——判定永遠看願望自己的 domain。
 */
export const CATEGORY_TRUE_DOMAIN: Record<WishCategory, DeityDomain> = {
  love: 'yuelao',
  health: 'yuelao',
  money: 'caishen',
  exam: 'wenchang',
  revenge: 'chenghuang',
  ticket: 'nobody',
  absurd: 'nobody',
};

/** 規則書：每個類別目前是否算「月老親自受理」。初始值等於現實 */
export function initialRulebook(): Record<WishCategory, boolean> {
  const entries = Object.entries(CATEGORY_TRUE_DOMAIN) as [WishCategory, DeityDomain][];
  return Object.fromEntries(entries.map(([cat, domain]) => [cat, domain === 'yuelao'])) as Record<
    WishCategory,
    boolean
  >;
}

export interface RulebookMemo {
  /** 值班第幾秒發文 */
  at: number;
  category: WishCategory;
  inScope: boolean;
  /** 公文全文，直接當作 outcome 推播出去 */
  headline: string;
}

/**
 * 公文腳本：值班途中上級會發文「更新」規則書。
 * 有些跟現實同步，有些故意脫節——脫節的那份公文如果被照單全收，
 * 批示結果仍然照願望自己的 domain 算，玩家會因此被自己的規則書坑一次。
 */
export function buildMemoSchedule(dayLength: number): RulebookMemo[] {
  if (dayLength <= 0) return [];
  return [
    {
      at: dayLength * 0.28,
      category: 'health',
      inScope: false,
      headline: '公文：即日起「健康」類願望一律轉交城隍爺代管，月老不再受理。',
    },
    {
      at: dayLength * 0.55,
      category: 'ticket',
      inScope: true,
      headline: '公文：搶票類願望本季試辦劃歸月老兼管（附註：明年會再改回去）。',
    },
    {
      at: dayLength * 0.8,
      category: 'health',
      inScope: true,
      headline: '公文：上一份公文誤發，「健康」類即日起改回月老原管轄，造成不便請見諒。',
    },
  ];
}

/** 每帧檢查是否有公文到期，到期就套用並推播成一則 outcome */
export function updateRulebook(state: GameState): void {
  if (state.pendingMemos.length === 0) return;
  const due = state.pendingMemos.filter((m) => state.elapsed >= m.at);
  if (due.length === 0) return;

  state.pendingMemos = state.pendingMemos.filter((m) => state.elapsed < m.at);
  for (const memo of due) {
    state.rulebook[memo.category] = memo.inScope;
    state.rulebookLog.push({ at: state.elapsed, text: memo.headline });
    state.outcomes.push({
      id: state.nextOutcomeId++,
      text: memo.headline,
      tone: 'neutral',
      ttl: 7,
    });
    if (state.outcomes.length > 4) state.outcomes.shift();
    // 公文一到，多少要花時間消化
    addFatigue(state, 2);
  }
}

/** 錯誤批示時，依真正該管的神明客製化抱怨文案（只在模式 C 用） */
export function complaintFor(domain: DeityDomain, wasWronglyApproved: boolean): string {
  if (domain === 'nobody') {
    return '這件事本來就沒人管，你倒是挺敢自己辦的。';
  }
  const who = DEITY_LABEL[domain];
  return wasWronglyApproved
    ? `${who}託夢抗議：這件事你怎麼自己批了？`
    : `${who}又把單子退回來：這本來就是月老自己的事，別再踢過來。`;
}
