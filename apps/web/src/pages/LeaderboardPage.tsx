import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameMode } from '@moon/shared';
import { fetchScores, type ScoreRow } from '../api';

const MODES: { value: GameMode; label: string }[] = [
  { value: 'rush', label: '初一十五' },
  { value: 'sorting', label: '神明轉單' },
  { value: 'story', label: '凡人故事' },
];

/** 排行榜獨立頁。不需要登入就能看 */
export function LeaderboardPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<GameMode>('rush');
  const [rows, setRows] = useState<ScoreRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    setRows(null);
    void fetchScores(mode).then((r) => alive && setRows(r));
    return () => {
      alive = false;
    };
  }, [mode]);

  return (
    <div className="absolute inset-0 overflow-y-auto bg-black/85 px-5 py-10 backdrop-blur-sm">
      <div className="mx-auto max-w-lg">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm text-incense/50 transition hover:text-incense/85"
        >
          ← 回廟門
        </button>

        <h1 className="mt-4 font-serif text-3xl tracking-widest text-temple-gold">值班排行</h1>
        <p className="mt-2 text-xs text-incense/45">
          分數看的是把人聽完，不是把單子清光：配對加最多，沒聽到的會扣。
        </p>

        <div className="mt-5 flex gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                mode === m.value
                  ? 'border-temple-gold bg-temple-red/40 text-incense'
                  : 'border-incense/20 text-incense/60 hover:border-incense/45'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {rows === null && <p className="mt-8 text-sm text-incense/40">讀取中…</p>}

        {rows !== null && rows.length === 0 && (
          <p className="mt-8 text-sm leading-relaxed text-incense/45">
            這個模式還沒有人上榜。也可能是這台沒有接後端。
          </p>
        )}

        {rows !== null && rows.length > 0 && (
          <ol className="mt-6 space-y-2">
            {rows.map((r, i) => (
              <li
                key={`${r.nickname}-${r.code}-${i}`}
                className="flex items-baseline gap-3 border-b border-incense/10 pb-2"
              >
                <span className="w-6 text-right font-serif text-lg text-incense/40">{i + 1}</span>
                <span className="flex-1 truncate">
                  <span className="text-incense">{r.nickname}</span>
                  <span className="ml-1 text-[11px] text-incense/30">#{r.code}</span>
                  {r.title && <span className="ml-2 text-[11px] text-temple-gold/60">{r.title}</span>}
                </span>
                <span className="text-[11px] text-incense/40">
                  接 {r.wishesHandled}　配對 {r.matched}
                </span>
                <span className="w-14 text-right font-serif text-lg text-incense">{r.score}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
