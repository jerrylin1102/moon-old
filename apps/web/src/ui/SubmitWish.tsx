import { useState } from 'react';
import { WISH_CATEGORIES, type WishCategory } from '@moon/shared';
import { submitWish } from '../api';

const LABEL: Record<WishCategory, string> = {
  love: '感情',
  money: '財運',
  exam: '考試',
  ticket: '搶票',
  health: '健康',
  revenge: '報復',
  absurd: '離譜',
};

/** 投稿願望。所有投稿都要人工審核過才會出現在別人的廟裡 */
export function SubmitWish({
  onSubmitted,
  quota,
}: {
  onSubmitted?: () => void;
  quota?: { used: number; limit: number };
}) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState<WishCategory>('love');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const send = async () => {
    setSending(true);
    const res = await submitWish(text.trim(), category);
    setResult({ ok: res.ok, message: res.message });
    if (res.ok) {
      setText('');
      onSubmitted?.();
    }
    setSending(false);
  };

  const full = quota !== undefined && quota.used >= quota.limit;
  const tooShort = text.trim().length < 6 || full;

  return (
    <div className="rounded-lg border border-incense/15 bg-black/40 p-4">
      <h3 className="font-serif text-lg tracking-widest text-temple-gold">投一則願望進廟裡</h3>
      <p className="mt-1 text-xs leading-relaxed text-incense/50">
        寫下你想對月老說的話。通過人工審核後，別人值班時就會遇到這位信眾。
        請不要寫真實姓名或聯絡方式。
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 120))}
        rows={3}
        placeholder="月老，我想……"
        className="mt-3 w-full resize-none rounded-md border border-incense/20 bg-black/50 px-3 py-2 text-sm text-incense outline-none placeholder:text-incense/25 focus:border-temple-gold/50"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as WishCategory)}
          className="rounded-md border border-incense/20 bg-black/60 px-2 py-1.5 text-xs text-incense outline-none"
        >
          {WISH_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {LABEL[c]}
            </option>
          ))}
        </select>

        <span className="text-[11px] text-incense/35">{text.trim().length}/120</span>

        <button
          type="button"
          disabled={tooShort || sending}
          onClick={send}
          className={`ml-auto rounded-full px-5 py-1.5 text-sm transition ${
            tooShort || sending
              ? 'border border-incense/10 text-incense/25'
              : 'border border-temple-gold/50 bg-temple-red/40 text-incense hover:bg-temple-red/60 active:scale-95'
          }`}
        >
          {sending ? '送出中…' : '送到廟裡'}
        </button>
      </div>

      {full && (
        <p className="mt-2 text-xs text-[#d98a8a]">
          廟裡最多同時放 {quota?.limit} 則你的願望。收回幾則舊的就能再投。
        </p>
      )}

      {result && (
        <p className={`mt-2 text-xs ${result.ok ? 'text-[#9ac47f]' : 'text-[#d98a8a]'}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
