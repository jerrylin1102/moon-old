import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { concludeStoryDay, prepareStoryDay } from '../content/story';

/** 收班：月老日記 */
export function RunEnded() {
  useGame((s) => s.version);
  const state = useGame.getState().state;
  const { mode, difficulty } = useSession();
  const setPhase = useSession((s) => s.setPhase);
  const startGame = useGame((s) => s.start);
  const endGame = useGame((s) => s.end);
  const navigate = useNavigate();
  const { me, guest } = useAuth();
  const [saved, setSaved] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'done' | 'failed'>(
    'idle',
  );
  const uploadedRef = useRef(false);
  const storyConcludedRef = useRef(false);
  const [nextStoryDay, setNextStoryDay] = useState<number | null>(null);

  const ended = !!state && state.status !== 'running';
  // 日記只在收班那一刻算一次，之後不要每次重繪都換一組留言
  const diary = useMemo(() => (ended && state ? buildDiary(state) : null), [ended, state?.status]);

  // 模式 B 收班就把今天的決定存起來：有下一集的願望排進明天的回訪佇列
  useEffect(() => {
    if (!ended || !state || state.mode !== 'story' || storyConcludedRef.current) return;
    storyConcludedRef.current = true;
    setNextStoryDay(concludeStoryDay(state.history));
  }, [ended, state]);

  // 收班就直接上榜，玩家不用手動按上傳——名字在進遊戲前就已經問過了
  useEffect(() => {
    if (!ended || !state || !diary || uploadedRef.current) return;
    uploadedRef.current = true;
    setUploadStatus('uploading');

    void postScore({
      nickname: me?.displayName ?? guest.nickname ?? '匿名香客',
      mode,
      difficulty,
      score: computeScore(state),
      wishesHandled: state.handled,
      ignored: state.ignored,
      matched: state.matched,
      peakFatigue: Math.round(state.peakFatigue),
      title: diary.title,
      // 登入者的身分以 cookie 為準，這個只有訪客會用到
      guestId: me ? undefined : guest.guestId,
    }).then((ok) => setUploadStatus(ok ? 'done' : 'failed'));
  }, [ended, state, diary, me, guest, mode, difficulty]);

  if (!state || !diary) return null;
  const score = computeScore(state);

  // 今天處理過、而且真的有主人的願望（同一則只列一次）
  const communityHandled = [...new Set(state.history.map((h) => h.wishId))]
    .map((id) => findWish(id))
    .filter((w): w is NonNullable<typeof w> => !!w?.submissionId && w.source === 'community');

  const again = () => {
    useInteraction.getState().reset();
    setSaved(false);
    setUploadStatus('idle');
    uploadedRef.current = false;
    storyConcludedRef.current = false;
    setNextStoryDay(null);
    startGame(mode, difficulty);
    if (mode === 'story') {
      const roster = useGame.getState().state?.storyRosterToday ?? 5;
      prepareStoryDay(roster);
    }
  };

  const back = () => {
    useInteraction.getState().reset();
    endGame();
    setPhase('prepare');
    navigate('/');
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

        {mode === 'story' && nextStoryDay !== null && (
          <p className="mt-3 text-xs text-incense/50">
            今天有回應的人，第 {nextStoryDay} 天可能會回來找你。
          </p>
        )}

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

        <div className="mt-8 flex items-center gap-2 border-t border-incense/10 pt-6 text-[11px] tracking-widest text-incense/45">
          <span>{score} 分</span>
          {uploadStatus === 'uploading' && <span className="text-incense/30">上榜中…</span>}
          {uploadStatus === 'done' && <span className="text-[#9ac47f]">已上排行榜</span>}
          {uploadStatus === 'failed' && (
            <span className="text-incense/30">沒接後端，這場不會上排行榜</span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={again}
            className="rounded-full border border-temple-gold/60 bg-temple-red/50 px-7 py-3 font-serif tracking-widest text-incense transition hover:bg-temple-red/75 active:scale-95"
          >
            {mode === 'story' ? `進入第 ${nextStoryDay ?? '下'} 天` : '再值一班'}
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
