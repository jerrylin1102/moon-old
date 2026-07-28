import type { DeityDomain, Divination, Verdict, WishCategory } from '@moon/shared';
import {
  DIFFICULTY_PRESETS,
  type GameState,
  type HandledRecord,
  type Worshipper,
} from './state';
import { addFatigue, addMerit, addResentment, spendIncense } from './resources';
import { complaintFor } from './rulebook';

/**
 * 月老的回應。全部是純函式，只改動傳進來的 state——
 * 願望本身的資料（強度、該歸誰管、後果文字）由呼叫端從願望池取來當參數，
 * 模擬層不認識願望池。
 */
export interface WishInfo {
  intensity: number;
  category: WishCategory;
  domain: DeityDomain;
  resolutions: Record<Verdict, string>;
}

/** 施展神通要花的香火 */
export const BLESSING_COST = 12;
/** 神通替所有等待中的信眾補回多少比例的耐心 */
const BLESSING_PATIENCE_RATIO = 0.45;
/** 同時最多顯示幾則後果 */
const MAX_OUTCOMES = 4;
const OUTCOME_TTL = 5;

function pushOutcome(state: GameState, text: string, tone: 'good' | 'bad' | 'neutral'): void {
  state.outcomes.push({ id: state.nextOutcomeId++, text, tone, ttl: OUTCOME_TTL });
  if (state.outcomes.length > MAX_OUTCOMES) state.outcomes.shift();
}

/** 這件事本來就該月老管嗎 */
function isMyDepartment(wish: WishInfo): boolean {
  return wish.domain === 'yuelao';
}

function dismiss(w: Worshipper): void {
  w.phase = 'leaving';
  w.phaseTime = 0;
}

function record(state: GameState, w: Worshipper, action: HandledRecord['action']): void {
  state.history.push({ wishId: w.wishId, action, at: state.elapsed });
}

/** 准 / 駁 / 轉單 */
export function resolveVerdict(
  state: GameState,
  w: Worshipper,
  verdict: Verdict,
  wish: WishInfo,
): void {
  state.handled += 1;
  const mine = isMyDepartment(wish);

  switch (verdict) {
    case 'approve':
      addFatigue(state, wish.intensity * 3);
      if (mine) {
        addMerit(state, wish.intensity * 2);
      } else {
        // 越權辦事：功德照拿，但累得多，而且別的神明會有意見
        addMerit(state, 1);
        addFatigue(state, 2);
        addResentment(state, 1);
      }
      break;

    case 'reject':
      addFatigue(state, wish.intensity * 1.5);
      // 駁回本身不算錯，但信眾當然不會開心
      addResentment(state, wish.intensity);
      break;

    case 'transfer':
      addFatigue(state, 1);
      if (mine) {
        // 自己的業務往外推，這才是真的踢皮球
        addResentment(state, wish.intensity * 3);
      } else {
        addMerit(state, 2);
      }
      break;
  }

  const tone: 'good' | 'bad' | 'neutral' =
    verdict === 'approve' ? 'good' : verdict === 'transfer' ? (mine ? 'bad' : 'good') : 'neutral';
  pushOutcome(state, wish.resolutions[verdict], tone);

  // 模式 C 專屬：業務範圍判斷錯了，讓真正該管的神明出面抱怨一句
  if (state.mode === 'sorting') {
    if (verdict === 'approve' && !mine) {
      pushOutcome(state, complaintFor(wish.domain, true), 'bad');
    } else if (verdict === 'transfer' && mine) {
      pushOutcome(state, complaintFor(wish.domain, false), 'bad');
    }
  }

  record(state, w, verdict);
  dismiss(w);
}

/**
 * 擲筊回應。笑筊不算結案——信眾會重新問一次，
 * 這是三種筊裡唯一會讓你更累的選項。
 */
export function castDivination(
  state: GameState,
  w: Worshipper,
  result: Divination,
  wish: WishInfo,
): void {
  switch (result) {
    case 'sheng':
      state.handled += 1;
      addMerit(state, wish.intensity);
      addFatigue(state, 2);
      pushOutcome(state, '聖筊。他磕了三個頭，走的時候是笑的。', 'good');
      record(state, w, 'sheng');
      dismiss(w);
      break;

    case 'yin':
      state.handled += 1;
      addFatigue(state, 1);
      addResentment(state, wish.intensity);
      pushOutcome(state, '陰筊。他在門口站了很久才走。', 'neutral');
      record(state, w, 'yin');
      dismiss(w);
      break;

    case 'xiao':
      addFatigue(state, 3);
      w.patience = DIFFICULTY_PRESETS[state.difficulty].patience * 0.8;
      w.phase = 'awaiting';
      w.phaseTime = 0;
      pushOutcome(state, '笑筊。問題沒問清楚，他又問了一次。', 'bad');
      record(state, w, 'xiao');
      break;
  }
}

/** 顯靈：香灰旋起、燭火跳動，所有等待中的信眾多給你一點時間 */
export function castBlessing(state: GameState): boolean {
  if (!spendIncense(state, BLESSING_COST)) {
    pushOutcome(state, '香火不夠，什麼也沒發生。', 'bad');
    return false;
  }

  const max = DIFFICULTY_PRESETS[state.difficulty].patience;
  let touched = 0;
  for (const w of state.worshippers) {
    if (w.phase !== 'awaiting' && w.phase !== 'wishing') continue;
    w.patience = Math.min(max, w.patience + max * BLESSING_PATIENCE_RATIO);
    touched += 1;
  }

  addFatigue(state, 4);
  pushOutcome(
    state,
    touched > 0 ? '香灰旋起，整間廟安靜了一下。' : '香灰旋起，可惜沒人在看。',
    touched > 0 ? 'good' : 'neutral',
  );
  return true;
}

/** 牽紅線：把兩個人接起來。只有兩邊都是感情事才算配對成功 */
export function tieRedThread(
  state: GameState,
  a: Worshipper,
  b: Worshipper,
  wishA: WishInfo,
  wishB: WishInfo,
): boolean {
  if (a.id === b.id) return false;

  const bothLove = wishA.category === 'love' && wishB.category === 'love';
  if (!bothLove) {
    addResentment(state, 2);
    addFatigue(state, 2);
    pushOutcome(state, '線接錯了。兩人尷尬地看了彼此一眼。', 'bad');
    return false;
  }

  state.handled += 2;
  state.matched += 1;
  addMerit(state, 6);
  addFatigue(state, 4);
  pushOutcome(state, '紅線接上了。他們在廟門口撞到彼此的傘。', 'good');
  record(state, a, 'thread');
  record(state, b, 'thread');
  dismiss(a);
  dismiss(b);
  return true;
}
