import type { GameState } from '../sim/state';
import { DIFFICULTY_PRESETS } from '../sim/state';
import { findWish } from './pool';

/**
 * 月老日記：把一場班的數字翻譯成人話。
 *
 * 這裡是玩家唯一會截圖分享的畫面，所以文案要能自己站得住——
 * 看不懂遊戲的人光看日記也要覺得好笑。
 */

export interface Review {
  stars: 1 | 5;
  author: string;
  text: string;
}

export interface Diary {
  /** 今日稱號 */
  title: string;
  /** 一句總結 */
  verdict: string;
  stats: { label: string; value: string }[];
  /** 今天最扯的那個願望 */
  highlight?: { text: string; note: string };
  reviews: Review[];
}

const AUTHORS = ['匿名香客', '穿藍衣服的那位', '第三排那個', '帶橘子來的', '每年都來的', '第一次來'];

/** 用數字當種子挑一個，同一場結果不會每次重繪就跳掉 */
function pick<T>(list: readonly T[], seed: number): T {
  return list[Math.abs(Math.round(seed)) % list.length] as T;
}

function rank(state: GameState): { title: string; verdict: string } {
  const total = state.handled + state.ignored;
  const rate = total > 0 ? state.handled / total : 0;
  const cap = DIFFICULTY_PRESETS[state.difficulty].resentmentCap;
  const strain = state.resentment / cap;

  if (total === 0) {
    return { title: '香爐都涼了', verdict: '一個願望也沒處理。神像坐得很直，這點值得肯定。' };
  }
  if (state.snacks >= 5) {
    return {
      title: '供品清空大師',
      verdict: `偷吃了 ${state.snacks} 次。信眾擺什麼你吃什麼，願望倒是其次。`,
    };
  }
  if (state.matched >= 3) {
    return { title: '紅線牽到手抽筋', verdict: `成了 ${state.matched} 對。明年這時候會有人回來還願。` };
  }
  if (rate >= 0.8 && strain < 0.5) {
    return { title: '香火鼎盛的一天', verdict: '大部分人都等到了回應。你今天做得比很多凡人的主管好。' };
  }
  if (rate >= 0.5) {
    return { title: '勉強撐完的一班', verdict: '有人等到了，有人沒有。這就是服務業。' };
  }
  if (state.ignored >= 8) {
    return { title: '已讀不回之神', verdict: `${state.ignored} 個人跪到腳麻，最後自己站起來走了。` };
  }
  return { title: '建議轉行', verdict: '香火收了，願望沒動。信眾開始討論隔壁那間比較靈。' };
}

/** 今天最扯的願望：離譜類優先，其次挑最重的 */
function highlightOf(state: GameState): Diary['highlight'] {
  if (state.history.length === 0) return undefined;

  const seen = state.history.map((h) => ({ record: h, wish: findWish(h.wishId) }));
  const absurd = seen.find((s) => s.wish?.category === 'absurd' || s.wish?.domain === 'nobody');
  const heaviest = seen.reduce(
    (best, s) => ((s.wish?.intensity ?? 0) > (best?.wish?.intensity ?? 0) ? s : best),
    seen[0],
  );
  const chosen = absurd ?? heaviest;
  if (!chosen?.wish) return undefined;

  const NOTES: Record<string, string> = {
    approve: '你准了。',
    reject: '你駁了。',
    transfer: '你轉單了。',
    sheng: '聖筊。',
    xiao: '笑筊，他又問了一次。',
    yin: '陰筊。',
    thread: '你把線接上去了。',
    ignored: '你沒聽到。',
  };

  return { text: chosen.wish.text, note: NOTES[chosen.record.action] ?? '' };
}

const THANKS = [
  '本來以為不會有回應，結果隔天真的遇到了。謝謝月老。',
  '我照著籤詩說的做了，雖然沒成，但心情好很多。',
  '五星。廟很安靜，月老很有耐心。',
  '不知道是不是巧合，但我要說謝謝。',
  '我朋友說這間很靈，我原本不信。',
];

const COMPLAINTS = [
  '跪了二十分鐘，什麼都沒有。下次去隔壁那間。',
  '一星。問感情的事被轉單給文昌帝君，是在哈囉？',
  '供品放上去就不見了，是誰吃的？',
  '擲了三次都笑筊。到底要我問什麼啦。',
  '排隊排很久，前面的人講超久。廟方應該要管一下。',
  '香油錢照收，願望沒下文。',
];

function reviewsOf(state: GameState): Review[] {
  const out: Review[] = [];
  const seed = Math.round(state.elapsed + state.handled * 7 + state.ignored * 13);

  if (state.handled > 0) {
    out.push({ stars: 5, author: pick(AUTHORS, seed), text: pick(THANKS, seed) });
  }
  if (state.matched > 0) {
    out.push({
      stars: 5,
      author: pick(AUTHORS, seed + 3),
      text: `我們是在這裡遇到的。原本只是來各拜各的。`,
    });
  }
  if (state.ignored > 0) {
    out.push({ stars: 1, author: pick(AUTHORS, seed + 1), text: pick(COMPLAINTS, seed) });
  }
  if (state.ignored >= 4) {
    out.push({ stars: 1, author: pick(AUTHORS, seed + 5), text: pick(COMPLAINTS, seed + 2) });
  }
  if (state.snacks > 0) {
    out.push({
      stars: 1,
      author: pick(AUTHORS, seed + 2),
      text: `我明明擺了${state.snacks > 2 ? '一整袋' : '一顆'}橘子，回頭就不見了。`,
    });
  }
  if (out.length === 0) {
    out.push({ stars: 1, author: '路過的', text: '進去看了一下，神明好像在放空。' });
  }
  return out.slice(0, 4);
}

export function buildDiary(state: GameState): Diary {
  const { title, verdict } = rank(state);

  return {
    title,
    verdict,
    stats: [
      { label: '接了幾願', value: `${state.handled}` },
      { label: '沒聽到的', value: `${state.ignored}` },
      { label: '成功配對', value: `${state.matched}` },
      { label: '功德', value: `${Math.round(state.merit)}` },
      { label: '最累的時候', value: `${Math.round(state.peakFatigue)}` },
      { label: '偷吃供品', value: `${state.snacks} 次` },
    ],
    highlight: highlightOf(state),
    reviews: reviewsOf(state),
  };
}
