import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * 極簡審核後台。
 *
 * token 存在 sessionStorage：關掉分頁就要重輸入，不會像 localStorage 一樣留在機器上。
 * 這裡沒有任何「登入狀態」的概念——權杖就是權杖，每一支請求都自己帶。
 */
const TOKEN_KEY = 'moon.adminToken';

type Tab = 'pending' | 'reports' | 'blocked';

interface Submission {
  id: string;
  text: string;
  category: string;
  status: string;
  autoFlags: { rules: string[]; llm: unknown };
  createdAt: string;
}

interface Report {
  id: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  authorId: string;
  authorName: string;
  authorBlocked: boolean;
  createdAt: string;
}

interface BlockedUser {
  id: string;
  displayName: string;
  email: string;
  blockedAt: string | null;
  blockedReason: string | null;
  appeals: { id: string; message: string; status: string; createdAt: string }[];
}

export function AdminPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) ?? '');
  const [tab, setTab] = useState<Tab>('pending');
  const [pending, setPending] = useState<Submission[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(path, {
        ...init,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
          ...(init?.headers ?? {}),
        },
      });
      if (res.status === 401) {
        setError('權杖不對');
        return null;
      }
      setError(null);
      return res.json() as Promise<Record<string, unknown>>;
    },
    [token],
  );

  const load = useCallback(async () => {
    if (!token) return;
    if (tab === 'pending') {
      const data = await call('/admin/submissions?status=pending');
      setPending((data?.submissions as Submission[]) ?? []);
    } else if (tab === 'reports') {
      const data = await call('/admin/reports');
      setReports((data?.reports as Report[]) ?? []);
    } else {
      const data = await call('/admin/blocked');
      setBlocked((data?.users as BlockedUser[]) ?? []);
    }
  }, [call, tab, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (id: string, decision: 'approved' | 'rejected') => {
    await call('/admin/review', { method: 'POST', body: JSON.stringify({ id, decision }) });
    void load();
  };

  const unblock = async (userId: string) => {
    await call('/admin/unblock', { method: 'POST', body: JSON.stringify({ userId }) });
    void load();
  };

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#0d0708] px-5 py-10">
      <div className="mx-auto max-w-3xl pb-16">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm text-incense/50 transition hover:text-incense/85"
        >
          ← 回廟門
        </button>
        <h1 className="mt-4 font-serif text-3xl tracking-widest text-temple-gold">審核後台</h1>

        <div className="mt-4 flex gap-2">
          <input
            type="password"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              sessionStorage.setItem(TOKEN_KEY, e.target.value);
            }}
            placeholder="ADMIN_TOKEN"
            className="flex-1 rounded-md border border-incense/20 bg-black/50 px-3 py-2 text-sm text-incense outline-none focus:border-temple-gold/50"
          />
          <button
            type="button"
            onClick={load}
            className="rounded-md border border-temple-gold/50 px-4 text-sm text-incense transition hover:bg-temple-red/40"
          >
            讀取
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-[#d98a8a]">{error}</p>}

        <div className="mt-5 flex gap-2">
          {(
            [
              ['pending', '待審投稿'],
              ['reports', '檢舉'],
              ['blocked', '封鎖清單'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                tab === value
                  ? 'border-temple-gold bg-temple-red/40 text-incense'
                  : 'border-incense/20 text-incense/60 hover:border-incense/45'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'pending' && (
          <ul className="mt-5 space-y-3">
            {pending.length === 0 && <p className="text-sm text-incense/40">沒有待審的投稿。</p>}
            {pending.map((s) => (
              <li key={s.id} className="rounded-lg border border-incense/15 bg-black/40 p-4">
                <p className="text-sm leading-relaxed text-incense/90">{s.text}</p>
                <p className="mt-2 text-[11px] text-incense/40">
                  {s.category}　自動標記：{s.autoFlags?.rules?.join('、') || '無'}
                  {s.autoFlags?.llm === null && '　（LLM 未預審）'}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => review(s.id, 'approved')}
                    className="rounded-full border border-[#7fae6d]/50 px-4 py-1.5 text-xs text-[#9ac47f] transition hover:bg-[#7fae6d]/15"
                  >
                    核准
                  </button>
                  <button
                    type="button"
                    onClick={() => review(s.id, 'rejected')}
                    className="rounded-full border border-[#c9414b]/50 px-4 py-1.5 text-xs text-[#d98a8a] transition hover:bg-[#c9414b]/15"
                  >
                    退件
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {tab === 'reports' && (
          <ul className="mt-5 space-y-2">
            {reports.length === 0 && <p className="text-sm text-incense/40">沒有檢舉。</p>}
            {reports.map((r) => (
              <li
                key={r.id}
                className="flex items-baseline gap-3 rounded-lg border border-incense/12 bg-black/35 px-3 py-2 text-sm"
              >
                <span className="text-incense/50">{r.targetType === 'comment' ? '留言' : '願望'}</span>
                <span className="flex-1 truncate text-incense/85">
                  {r.authorName}
                  {r.authorBlocked && <span className="ml-2 text-[11px] text-[#d98a8a]">已封鎖</span>}
                </span>
                <span className="truncate text-[11px] text-incense/40">{r.reason ?? '未填理由'}</span>
              </li>
            ))}
          </ul>
        )}

        {tab === 'blocked' && (
          <ul className="mt-5 space-y-3">
            {blocked.length === 0 && <p className="text-sm text-incense/40">沒有被封鎖的帳號。</p>}
            {blocked.map((u) => (
              <li key={u.id} className="rounded-lg border border-incense/15 bg-black/40 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-incense">{u.displayName}</span>
                  <button
                    type="button"
                    onClick={() => unblock(u.id)}
                    className="rounded-full border border-incense/25 px-4 py-1 text-xs text-incense/75 transition hover:border-incense/55"
                  >
                    解除封鎖
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-incense/40">{u.blockedReason}</p>

                {u.appeals.length > 0 && (
                  <div className="mt-3 border-t border-incense/10 pt-3">
                    <p className="text-[11px] tracking-widest text-temple-gold/60">申訴</p>
                    {u.appeals.map((a) => (
                      <p key={a.id} className="mt-1 text-[13px] leading-relaxed text-incense/80">
                        {a.message}
                        <span className="ml-2 text-[11px] text-incense/35">{a.status}</span>
                      </p>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
