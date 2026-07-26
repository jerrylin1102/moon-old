import { useState } from 'react';
import type { WishCategory } from '@moon/shared';
import { useGame } from '../gameStore';
import { useInteraction } from '../interactionStore';
import { findWish } from '../content/pool';
import { applyDivination, applyVerdict } from '../actions';
import { isWaiting } from '../sim/worshipper';
import { onCooldown } from '../sim/fatigue';
import { CommentBox } from '../components/CommentBox';

const CATEGORY_LABEL: Record<WishCategory, string> = {
  love: '感情',
  money: '財運',
  exam: '考試',
  ticket: '搶票',
  health: '健康',
  revenge: '報復',
  absurd: '離譜',
};

/** 選中一位信眾後出現的批示條 */
export function VerdictBar() {
  const focusedId = useInteraction((s) => s.focusedId);
  useGame((s) => s.version);
  const [castingJiao, setCastingJiao] = useState(false);
  const [commenting, setCommenting] = useState(false);

  // 打字的時候暫停值班——不然其他信眾的耐心照跑，等於在懲罰願意留言的人
  const startCommenting = () => {
    const state = useGame.getState().state;
    if (state) state.paused = true;
    setCommenting(true);
  };

  const stopCommenting = () => {
    const state = useGame.getState().state;
    if (state) state.paused = false;
    setCommenting(false);
  };

  const state = useGame.getState().state;
  const w = focusedId ? state?.worshippers.find((x) => x.id === focusedId) : undefined;
  const wish = w ? findWish(w.wishId) : undefined;

  if (!state || !w || !wish || !isWaiting(w)) return null;
  const cooling = onCooldown(state);

  const verdictButtons = [
    { label: '准', hint: '1', onClick: () => applyVerdict(w.id, 'approve') },
    { label: '駁', hint: '2', onClick: () => applyVerdict(w.id, 'reject') },
    { label: '轉單', hint: '3', onClick: () => applyVerdict(w.id, 'transfer') },
  ];

  const jiaoButtons = [
    { label: '聖筊', hint: '4', onClick: () => applyDivination(w.id, 'sheng') },
    { label: '笑筊', hint: '5', onClick: () => applyDivination(w.id, 'xiao') },
    { label: '陰筊', hint: '6', onClick: () => applyDivination(w.id, 'yin') },
  ];

  const buttons = castingJiao ? jiaoButtons : verdictButtons;

  return (
    <div className="absolute inset-x-0 bottom-28 flex justify-center px-4 sm:bottom-10">
      <div className="w-full max-w-xl rounded-xl border border-temple-gold/40 bg-black/80 p-4 backdrop-blur-sm">
        <div className="flex items-baseline justify-between text-[11px] tracking-widest text-incense/55">
          <span>{CATEGORY_LABEL[wish.category]}</span>
          <span>耐心 {Math.max(0, Math.ceil(w.patience))} 秒</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-incense">{wish.text}</p>

        <div className="mt-4 flex gap-2">
          {buttons.map((b) => (
            <button
              key={b.label}
              type="button"
              disabled={cooling}
              onClick={() => {
                b.onClick();
                setCastingJiao(false);
              }}
              className={`flex-1 rounded-lg border py-2.5 font-serif text-base transition active:scale-95 ${
                cooling
                  ? 'border-incense/10 bg-black/30 text-incense/25'
                  : 'border-incense/25 bg-temple-red/30 text-incense hover:bg-temple-red/60'
              }`}
            >
              {b.label}
              <span className="ml-1 hidden text-[10px] text-incense/45 sm:inline">{b.hint}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCastingJiao((v) => !v)}
            className="rounded-lg border border-temple-gold/40 px-3 py-2.5 font-serif text-sm text-temple-gold transition hover:bg-temple-gold/15 active:scale-95"
          >
            {castingJiao ? '返回' : '擲筊'}
          </button>
        </div>

        {/* 社群願望背後有一個真的人，可以直接留話給他 */}
        {wish.source === 'community' && wish.submissionId && (
          <div className="mt-3 border-t border-incense/10 pt-3">
            {commenting ? (
              <CommentBox submissionId={wish.submissionId} compact onClose={stopCommenting} />
            ) : (
              <button
                type="button"
                onClick={startCommenting}
                className="text-[11px] text-temple-gold/70 underline-offset-4 transition hover:underline"
              >
                這是別人投稿的願望——留一句話給他（會暫停值班）
              </button>
            )}
          </div>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-incense/40">
          {cooling
            ? '手還沒回過神……（太累了，動作變慢）'
            : castingJiao
              ? '笑筊不算回答——他會重新問一次，而你會更累。'
              : '牽紅線：從一位信眾拖到另一位。兩邊都是感情事才算配對。'}
        </p>
      </div>
    </div>
  );
}
