import { env } from '../env';

/**
 * 信件內容。
 *
 * 刻意寫得像廟方通知而不是系統郵件——這是一個關於月老的遊戲，
 * 信也該有點人味。但重點資訊（誰、做了什麼、去哪看）一定要在前三行。
 */

const footer = (): string =>
  [
    '',
    `到許願頁看完整互動：${env.APP_BASE_URL}/wishes`,
    '不想再收到這類通知，可以在網站右上角的設定裡關掉。',
    '',
    '— 月老值班中',
  ].join('\n');

const ACTION_TEXT: Record<string, string> = {
  approve: '准了你的願望',
  reject: '駁回了你的願望',
  transfer: '把你的願望轉給別的神明',
  sheng: '給了你一個聖筊',
  xiao: '給了你一個笑筊',
  yin: '給了你一個陰筊',
  thread: '幫你牽了紅線',
  ignored: '沒能聽完你的願望',
};

export function firstInteractionMail(
  wishText: string,
  event: { type: string; action?: string; excerpt?: string },
): { subject: string; text: string } {
  const what =
    event.type === 'comment'
      ? `有人留言給你：「${event.excerpt ?? ''}」`
      : `有人${ACTION_TEXT[event.action ?? ''] ?? '回應了你的願望'}。`;

  return {
    subject: '有人在廟裡遇到你的願望了',
    text: [`你的願望：「${wishText}」`, '', what, '', '這是第一個遇到它的人。', footer()].join('\n'),
  };
}

export function digestMail(summary: {
  wishes: number;
  interactions: number;
  comments: number;
  samples: string[];
}): { subject: string; text: string } {
  const lines = [
    `今天有 ${summary.interactions} 個人在廟裡遇到你的願望。`,
    summary.comments > 0 ? `其中 ${summary.comments} 個人留了話給你。` : '',
    '',
    ...summary.samples.map((s) => `・${s}`),
  ].filter(Boolean);

  return {
    subject: `今天你的願望被 ${summary.interactions} 個人遇到`,
    text: [...lines, footer()].join('\n'),
  };
}
