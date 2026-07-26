import { useMemo, useState } from 'react';
import { useGame } from '../gameStore';
import { useInteraction } from '../interactionStore';
import { useSession } from '../store';
import { buildDiary } from '../content/diary';
import { downloadShareCard } from './shareCard';
import { computeScore } from '../sim/score';
import { postScore } from '../api';
import { useAuth } from '../authStore';
import { findWish } from '../content/pool';
import { CommentBox } from '../components/CommentBox';

/** 收班：月老日記 */
export function RunEnded() {
  useGame((s) => s.version);
  const state = useGame.getState().state;
  const { mode, difficulty } = useSession();
  const setPhase = useSession((s) => s.setPhase);
  const startGame = useGame((s) => s.start);
  const endGame = useGame((s) => s.end);
  const { me, guest } = useAuth();
  const [saved, setSaved] = useState(false);
  // 名字已經有了就直接帶入，不要再問一次
  const [nickname, setNickname] = useState(me?.displayName ?? guest.nickname ?? '');
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<boolean | null>(null);

  const ended = !!state && state.status !== 'running';
  // 日記只在收班那一刻算一次，之後不要每次重繪都換一組留言
  const diary = useMemo(() => (ended && state ? buildDiary(state) : null), [ended, state?.status]);

  if (!state || !diary) return null;
  const score = computeScore(state);

  // 今天處理過、而且真的有主人的願望（同一則只列一次）
  const communityHandled = [...new Set(state.history.map((h) => h.wishId))]
    .map((id) => findWish(id))
    .filter((w): w is NonNullable<typeof w> => !!w?.submissionId && w.source === 'community');

  const again = () => {
    useInteraction.getState().reset();
    setSaved(false);
    setUploaded(null);
    startGame(mode, difficulty);
  };

  const upload = async () => {
    setUploading(true);
    const ok = await postScore({
      nickname: nickname.trim(),
      mode,
      difficulty,
      score,
      wishesHandled: state.handled,
      ignored: state.ignored,
      matched: state.matched,
      peakFatigue: Math.round(state.peakFatigue),
      title: diary.title,
      // 登入者的身分以 cookie 為準，這個只有訪客會用到
      guestId: me ? undefined : guest.guestId,
    });
    setUploaded(ok);
    setUploading(false);
  };

  const back = () => {
    useInteraction.getState().reset();
    endGame();
    setPhase('prepare');
  };

  const share = () => {
    downloadShareCard(diary);
    setSaved(true);
  };

  return (
    <div className="absolute inset-0 overflow-y-auto bg-black/88 px-5 py-10 backdrop-blur-sm">
      <div className="mx-auto max-w-lg pb-10">
        <p className="font-serif text-xs tracking-[0.4em] text-temple-gold/60">
          {state.status === 'overwhelmed' ? '香客散了' : '打烊了'}　月老日記
        </p>
        <h2 className="mt-3 font-serif text-4xl tracking-widest text-incense">{diary.title}</h2>
        <p className="mt-4 text-sm leading-relaxed text-incense/75">{diary.verdict}</p>

        <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-3">
          {diary.stats.map((s) => (
            <div
              key={s.label}
              className="flex items-baseline justify-between border-b border-incense/10 pb-1"
            >
              <dt className="text-xs tracking-widest text-incense/50">{s.label}</dt>
              <dd className="font-serif text-lg text-incense">{s.value}</dd>
            </div>
          ))}
        </dl>

        {diary.highlight && (
          <div className="mt-8 border-l-2 border-temple-gold/50 pl-4">
            <p className="text-[11px] tracking-widest text-temple-gold/70">今日最扯</p>
            <p className="mt-2 font-serif text-base leading-relaxed text-incense">
              「{diary.highlight.text}」
            </p>
            <p className="mt-1 text-xs text-incense/45">{diary.highlight.note}</p>
          </div>
        )}

        {/* 今天遇到的社群願望背後都有一個真的人，可以補一句話給他們 */}
        {communityHandled.length > 0 && (
          <div className="mt-8">
            <p className="text-[11px] tracking-widest text-incense/45">
              今天遇到的真人願望（{communityHandled.length}）
            </p>
            <ul className="mt-3 space-y-3">
              {communityHandled.map((w) => (
                <li key={w.submissionId} className="rounded-lg border border-incense/12 bg-black/35 p-3">
                  <p className="text-[13px] leading-relaxed text-incense/85">{w.text}</p>
                  <div className="mt-2">
                    <CommentBox submissionId={w.submissionId!} compact />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8">
          <p className="text-[11px] tracking-widest text-incense/45">香客留言</p>
          <ul className="mt-3 space-y-3">
            {diary.reviews.map((r, i) => (
              <li key={i} className="rounded-lg bg-white/5 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={r.stars === 5 ? 'text-[#7fae6d]' : 'text-[#c9414b]'}>
                    {'★'.repeat(r.stars)}
                    <span className="text-incense/20">{'★'.repeat(5 - r.stars)}</span>
                  </span>
                  <span className="text-[11px] text-incense/40">{r.author}</span>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-incense/80">{r.text}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-incense/10 pt-6">
          <span className="text-[11px] tracking-widest text-incense/45">
            上排行榜（{score} 分）
          </span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 16))}
            placeholder="留個名號"
            disabled={uploaded !== null}
            className="w-32 rounded-md border border-incense/20 bg-black/50 px-2 py-1.5 text-sm text-incense outline-none placeholder:text-incense/25 focus:border-temple-gold/50 disabled:opacity-50"
          />
          <button
            type="button"
            disabled={nickname.trim().length === 0 || uploading || uploaded !== null}
            onClick={upload}
            className="rounded-full border border-incense/30 px-4 py-1.5 text-xs text-incense/85 transition hover:border-incense/60 disabled:opacity-30"
          >
            {uploading ? '上傳中…' : uploaded === true ? '已上傳' : '上傳'}
          </button>
          {uploaded === false && (
            <span className="text-[11px] text-[#d98a8a]">上傳失敗，可能是沒接後端或暱稱不能用。</span>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={again}
            className="rounded-full border border-temple-gold/60 bg-temple-red/50 px-7 py-3 font-serif tracking-widest text-incense transition hover:bg-temple-red/75 active:scale-95"
          >
            再值一班
          </button>
          <button
            type="button"
            onClick={share}
            className="rounded-full border border-incense/30 px-6 py-3 text-sm text-incense/85 transition hover:border-incense/60 active:scale-95"
          >
            {saved ? '已存成圖片' : '存成分享圖'}
          </button>
          <button
            type="button"
            onClick={back}
            className="text-sm text-incense/60 underline-offset-4 hover:underline"
          >
            回廟門
          </button>
        </div>
      </div>
    </div>
  );
}
