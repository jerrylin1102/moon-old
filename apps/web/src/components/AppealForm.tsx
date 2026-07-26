import { useState } from 'react';
import { submitAppeal } from '../api';

/** 被封鎖的人唯一還能對系統說話的管道 */
export function AppealForm() {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const send = async () => {
    setSending(true);
    const res = await submitAppeal(message.trim());
    setResult(res);
    if (res.ok) setMessage('');
    setSending(false);
  };

  return (
    <div className="mt-4 border-t border-[#7a2a2f]/50 pt-4">
      <p className="text-xs tracking-widest text-[#f0b8b8]/70">申請解鎖</p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, 500))}
        rows={3}
        placeholder="說明你的情況，管理員會看過。"
        className="mt-2 w-full resize-none rounded-md border border-incense/20 bg-black/50 px-3 py-2 text-sm text-incense outline-none placeholder:text-incense/25 focus:border-temple-gold/50"
      />
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[11px] text-incense/30">{message.trim().length}/500</span>
        <button
          type="button"
          disabled={message.trim().length < 10 || sending}
          onClick={send}
          className="ml-auto rounded-full border border-incense/30 px-5 py-1.5 text-xs text-incense/85 transition hover:border-incense/60 disabled:opacity-30"
        >
          {sending ? '送出中…' : '送出申訴'}
        </button>
      </div>
      {result && (
        <p className={`mt-1 text-[11px] ${result.ok ? 'text-[#9ac47f]' : 'text-[#d98a8a]'}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
