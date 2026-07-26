import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * 審核後台。標準帳號密碼登入，換一個 httpOnly session cookie——
 * 不是貼權杖到輸入框那種。前端這裡完全不碰密碼以外的任何憑證，
 * cookie 由瀏覽器自己帶，JS 讀不到也存不到。
 *
 * 願望現在預設一投稿就直接發佈，這裡的「待審投稿」分頁角色
 * 變成事後檢視／必要時下架，不是上線前的關卡。
 */
type Tab = 'submissions' | 'reports' | 'blocked';
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

interface Submission {
  id: string;
  text: string;
  category: string;
  status: string;
  authorId: string | null;
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

const STATUS_LABEL: Record<string, string> = {
  approved: '已發佈',
  pending: '待審',
  rejected: '已下架／已退件',
};

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
}

export function AdminPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<Tab>('submissions');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);

  const checkSession = useCallback(async () => {
    const res = await api('/admin/session');
    const body = (await res.json().catch(() => ({}))) as {
      enabled?: boolean;
      authenticated?: boolean;
    };
    setEnabled(body.enabled ?? false);
    setAuthenticated(body.authenticated ?? false);
    setChecking(false);
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const login = async () => {
    setLoggingIn(true);
    setLoginError(null);
    const res = await api('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      setAuthenticated(true);
      setPassword('');
    } else {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setLoginError(body.error === '帳號或密碼錯誤' ? '帳號或密碼錯誤' : '登入失敗，稍後再試');
    }
    setLoggingIn(false);
  };

  const logout = async () => {
    await api('/admin/logout', { method: 'POST' });
    setAuthenticated(false);
  };

  const load = useCallback(async () => {
    if (!authenticated) return;
    if (tab === 'submissions') {
      const res = await api(`/admin/submissions?status=${statusFilter}`);
      if (res.status === 401) return setAuthenticated(false);
      const data = (await res.json()) as { submissions: Submission[] };
      setSubmissions(data.submissions ?? []);
    } else if (tab === 'reports') {
      const res = await api('/admin/reports');
      if (res.status === 401) return setAuthenticated(false);
      const data = (await res.json()) as { reports: Report[] };
      setReports(data.reports ?? []);
    } else {
      const res = await api('/admin/blocked');
      if (res.status === 401) return setAuthenticated(false);
      const data = (await res.json()) as { users: BlockedUser[] };
      setBlocked(data.users ?? []);
    }
  }, [authenticated, tab, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (id: string, decision: 'approved' | 'rejected') => {
    await api('/admin/review', { method: 'POST', body: JSON.stringify({ id, decision }) });
    void load();
  };

  const unblock = async (userId: string) => {
    await api('/admin/unblock', { method: 'POST', body: JSON.stringify({ userId }) });
    void load();
  };

  if (checking) return null;

  if (!enabled) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#0d0708] px-5">
        <p className="text-sm text-incense/50">
          這台沒有設定 ADMIN_USERNAME / ADMIN_PASSWORD，後台不開放。
        </p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#0d0708] px-5">
        <div className="w-full max-w-xs">
          <h1 className="font-serif text-2xl tracking-widest text-temple-gold">審核後台</h1>
          <div className="mt-5 space-y-3">
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="帳號"
              className="w-full rounded-md border border-incense/20 bg-black/50 px-3 py-2 text-sm text-incense outline-none focus:border-temple-gold/50"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && login()}
              placeholder="密碼"
              className="w-full rounded-md border border-incense/20 bg-black/50 px-3 py-2 text-sm text-incense outline-none focus:border-temple-gold/50"
            />
            <button
              type="button"
              disabled={loggingIn || !username || !password}
              onClick={login}
              className="w-full rounded-md border border-temple-gold/50 py-2 text-sm text-incense transition hover:bg-temple-red/40 disabled:opacity-30"
            >
              {loggingIn ? '登入中…' : '登入'}
            </button>
            {loginError && <p className="text-xs text-[#d98a8a]">{loginError}</p>}
          </div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-6 text-sm text-incense/40 transition hover:text-incense/70"
          >
            ← 回廟門
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#0d0708] px-5 py-10">
      <div className="mx-auto max-w-3xl pb-16">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-sm text-incense/50 transition hover:text-incense/85"
          >
            ← 回廟門
          </button>
          <button
            type="button"
            onClick={logout}
            className="text-sm text-incense/50 transition hover:text-incense/85"
          >
            登出
          </button>
        </div>
        <h1 className="mt-4 font-serif text-3xl tracking-widest text-temple-gold">審核後台</h1>
        <p className="mt-2 text-xs text-incense/40">
          願望投稿後直接發佈，不需要在這裡核准。這裡是事後檢視與必要時下架的地方。
        </p>

        <div className="mt-5 flex gap-2">
          {(
            [
              ['submissions', '投稿'],
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

        {tab === 'submissions' && (
          <>
            <div className="mt-4 flex gap-2">
              {(['all', 'approved', 'pending', 'rejected'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    statusFilter === s
                      ? 'border-incense/60 text-incense'
                      : 'border-incense/15 text-incense/40 hover:border-incense/40'
                  }`}
                >
                  {s === 'all' ? '全部' : STATUS_LABEL[s]}
                </button>
              ))}
            </div>

            <ul className="mt-4 space-y-3">
              {submissions.length === 0 && <p className="text-sm text-incense/40">沒有符合的投稿。</p>}
              {submissions.map((s) => (
                <li key={s.id} className="rounded-lg border border-incense/15 bg-black/40 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[11px] tracking-widest text-temple-gold/70">
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                    <span className="text-[11px] text-incense/30">
                      {new Date(s.createdAt).toLocaleString('zh-TW')}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-incense/90">{s.text}</p>
                  <p className="mt-2 text-[11px] text-incense/40">
                    {s.category}　自動標記：{s.autoFlags?.rules?.join('、') || '無'}
                    {s.autoFlags?.llm === null && '　（LLM 未預審）'}
                  </p>
                  <div className="mt-3 flex gap-2">
                    {s.status !== 'approved' && (
                      <button
                        type="button"
                        onClick={() => review(s.id, 'approved')}
                        className="rounded-full border border-[#7fae6d]/50 px-4 py-1.5 text-xs text-[#9ac47f] transition hover:bg-[#7fae6d]/15"
                      >
                        發佈／重新上架
                      </button>
                    )}
                    {s.status !== 'rejected' && (
                      <button
                        type="button"
                        onClick={() => review(s.id, 'rejected')}
                        className="rounded-full border border-[#c9414b]/50 px-4 py-1.5 text-xs text-[#d98a8a] transition hover:bg-[#c9414b]/15"
                      >
                        下架
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
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
