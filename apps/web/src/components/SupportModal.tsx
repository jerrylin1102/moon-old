import { useState } from 'react';
import { useGame } from '../gameStore';
import { useInteraction } from '../interactionStore';
import { applyVerdict } from '../actions';
import { Modal } from './Modal';

const BANK_LINE = '（013）國泰世華銀行';
const ACCOUNT_NUMBER = '218700744219';

/**
 * 贊助作者的彩蛋視窗：點「准」之後跳出來，顯示轉帳 QR code 與帳號。
 * 關閉時才真正讓這位信眾收尾（視為准了，不套用稀有／社群加成，純彩蛋）。
 */
export function SupportModal() {
  const supportPromptId = useInteraction((s) => s.supportPromptId);
  const [copied, setCopied] = useState(false);

  if (!supportPromptId) return null;

  const close = () => {
    const state = useGame.getState().state;
    if (state) state.paused = false;
    applyVerdict(supportPromptId, 'approve');
    useInteraction.getState().closeSupportPrompt();
  };

  const copyAccount = async () => {
    try {
      await navigator.clipboard.writeText(ACCOUNT_NUMBER);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // 剪貼簿權限被擋掉就算了，帳號文字本來就顯示在畫面上，使用者自己選取複製
    }
  };

  return (
    <Modal title="小小贊助" onClose={close} closeIcon width="max-w-xs">
      <div className="flex flex-col items-center gap-3 text-center">
        <img
          src="/support-qr.png"
          alt="轉帳 QR Code"
          className="w-48 rounded-lg border border-incense/15 bg-white p-2"
        />
        <p className="text-sm text-incense/85">{BANK_LINE}</p>
        <div className="flex items-center gap-2">
          <p className="font-mono text-base tracking-wider text-incense">{ACCOUNT_NUMBER}</p>
          <button
            type="button"
            onClick={copyAccount}
            aria-label="複製帳號"
            className="rounded-md border border-incense/25 px-2 py-1 text-xs text-incense/70 transition hover:border-temple-gold/60 hover:text-temple-gold"
          >
            {copied ? '已複製' : '複製'}
          </button>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-incense/40">
          完全隨喜，不轉帳也不影響遊戲。關閉這個視窗就會繼續值班。
        </p>
      </div>
    </Modal>
  );
}
