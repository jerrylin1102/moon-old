import { useState } from 'react';
import { useAuth } from '../authStore';
import { postComment } from '../api';

/**
 * 給某則社群願望留言。值班中與日終結算共用同一個元件。
 *
 * 值班中會暫停模擬（由呼叫端負責），所以這裡只管輸入與送出。
 */
export function CommentBox({
  submissionId,
  onClose,
  compact = false,
}: {
  submissionId: string;
  onClose?: () => void;
  compact?: boolean;
}) {
  const me = useAuth((s) => s.me);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (!me) {
    return (
      <p className="text-[11px] leading-relaxed text-incense/45">
        留言要先登入。回廟門用 Google 登入之後，你的話就會出現在願望主人的信箱裡。
      </p>
    );
  }

  const send = async () => {
    setSending(true);
    const res = await postComment(submissionId, body.trim());
    if (res.ok) {
      setBody('');
      setResult({ ok: true, message: '留言送出了，願望的主人會收到通知。' });
    } else {
      setResult({ ok: false, message: res.message });
    }
    setSending(false);
  };

  return (
    <div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 300))}
        rows={compact ? 2 : 3}
        placeholder="想對這位信眾說什麼？"
        className="w-full resize-none rounded-md border border-incense/20 bg-black/50 px-3 py-2 text-sm text-incense outline-none placeholder:text-incense/25 focus:border-temple-gold/50"
      />
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[11px] text-incense/30">{body.trim().length}/300</span>
        <button
          type="button"
          disabled={body.trim().length < 2 || sending}
          onClick={send}
          className="ml-auto rounded-full border border-temple-gold/50 bg-temple-red/35 px-4 py-1.5 text-xs text-incense transition hover:bg-temple-red/60 disabled:opacity-30"
        >
          {sending ? '送出中…' : '留言'}
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-incense/45 transition hover:text-incense/80"
          >
            關閉
          </button>
        )}
      </div>
      {result && (
        <p className={`mt-1 text-[11px] ${result.ok ? 'text-[#9ac47f]' : 'text-[#d98a8a]'}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
