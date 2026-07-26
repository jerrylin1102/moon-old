import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../authStore';
import { SubmitWish } from '../ui/SubmitWish';
import { deleteWish, fetchMyWishes, type MyWish } from '../api';
import { CommentList } from '../components/CommentList';
import { AppealForm } from '../components/AppealForm';

const STATUS_LABEL = {
  pending: { text: '審核中', className: 'text-incense/45' },
  approved: { text: '已在廟裡', className: 'text-[#9ac47f]' },
  rejected: { text: '未通過', className: 'text-[#d98a8a]' },
} as const;

const ACTION_LABEL: Record<string, string> = {
  approve: '准',
  reject: '駁',
  transfer: '轉單',
  sheng: '聖筊',
  xiao: '笑筊',
  yin: '陰筊',
  thread: '牽紅線',
  ignored: '沒聽到',
};

/** 許願牆：投稿、我的願望、每則的互動統計 */
export function WishesPage() {
  const navigate = useNavigate();
  const { me, loading } = useAuth();
  const [data, setData] = useState<{ wishes: MyWish[]; used: number; limit: number } | null>(null);
  const [offline, setOffline] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetchMyWishes();
    if (res) setData(res);
    else setOffline(true);
  }, []);

  useEffect(() => {
    if (me) void reload();
  }, [me, reload]);

  useEffect(() => {
    if (!loading && !me) navigate('/', { replace: true });
  }, [loading, me, navigate]);

  if (loading || !me) return null;

  const remove = async (id: string) => {
    if (await deleteWish(id)) void reload();
  };

  return (
    <div className="absolute inset-0 overflow-y-auto bg-black/85 px-5 py-10 backdrop-blur-sm">
      <div className="mx-auto max-w-2xl pb-16">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm text-incense/50 transition hover:text-incense/85"
        >
          ← 回廟門
        </button>

        <h1 className="mt-4 font-serif text-3xl tracking-widest text-temple-gold">我的願望</h1>
        <p className="mt-2 text-xs leading-relaxed text-incense/45">
          審核通過後，別人值班時就會遇到你的願望。他們擲了什麼筊、留了什麼話，都會回報到這裡。
        </p>

        {me.blocked ? (
          <div className="mt-6 rounded-lg border border-[#7a2a2f] bg-[#2a1113] p-4">
            <h2 className="font-serif text-lg text-[#f0b8b8]">許願功能已停用</h2>
            <p className="mt-2 text-sm leading-relaxed text-incense/70">
              {me.blockedReason ?? '你的帳號因為累積檢舉被暫停使用許願與留言。'}
              遊戲本身照常可以玩。
            </p>
            <AppealForm />
          </div>
        ) : (
          <div className="mt-6">
            <SubmitWish
              onSubmitted={reload}
              quota={data ? { used: data.used, limit: data.limit } : undefined}
            />
          </div>
        )}

        <h2 className="mt-10 font-serif text-xl tracking-widest text-temple-gold">
          投過的願望
          {data && (
            <span className="ml-2 text-xs tracking-normal text-incense/40">
              {data.used} / {data.limit}
            </span>
          )}
        </h2>

        {offline && (
          <p className="mt-3 text-sm text-incense/45">連不上伺服器，暫時看不到你的願望。</p>
        )}

        {data && data.wishes.length === 0 && (
          <p className="mt-3 text-sm text-incense/45">還沒有投過願望。</p>
        )}

        <ul className="mt-4 space-y-3">
          {data?.wishes.map((w) => (
            <li key={w.id} className="rounded-lg border border-incense/15 bg-black/40 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className={`text-[11px] tracking-widest ${STATUS_LABEL[w.status].className}`}>
                  {STATUS_LABEL[w.status].text}
                </span>
                <button
                  type="button"
                  onClick={() => remove(w.id)}
                  className="text-[11px] text-incense/35 transition hover:text-[#d98a8a]"
                >
                  收回
                </button>
              </div>

              <p className="mt-2 text-sm leading-relaxed text-incense/90">{w.text}</p>

              {w.status === 'rejected' && w.moderationNote && (
                <p className="mt-2 text-[11px] text-[#d98a8a]">審核備註：{w.moderationNote}</p>
              )}

              {w.status === 'approved' && (
                <div className="mt-3 border-t border-incense/10 pt-3">
                  {Object.keys(w.interactions).length === 0 ? (
                    <p className="text-[11px] text-incense/35">還沒有人在遊戲裡遇到這則願望。</p>
                  ) : (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-incense/60">
                      {Object.entries(w.interactions).map(([action, count]) => (
                        <span key={action}>
                          {ACTION_LABEL[action] ?? action}
                          <span className="ml-1 font-serif text-sm text-incense">{count}</span>
                        </span>
                      ))}
                      <span className="text-incense/40">留言 {w.commentCount}</span>
                    </div>
                  )}
                  {w.commentCount > 0 && <CommentList submissionId={w.id} />}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
