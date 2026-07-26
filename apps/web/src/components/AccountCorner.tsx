import { useState } from 'react';
import { useAuth } from '../authStore';
import { logout, updateMe } from '../api';
import { GoogleLoginButton } from './GoogleLoginButton';
import { Modal } from './Modal';

/** 首頁右上角：未登入是登入按鈕，登入後是頭像 → 設定 */
export function AccountCorner() {
  const { me, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (loading) return null;

  if (!me) {
    return (
      <div className="absolute right-4 top-4 z-30">
        <GoogleLoginButton />
      </div>
    );
  }

  return (
    <div className="absolute right-4 top-4 z-30">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-incense/20 bg-black/50 py-1 pl-1 pr-3 transition hover:border-incense/50"
      >
        {me.avatarUrl ? (
          <img src={me.avatarUrl} alt="" className="h-8 w-8 rounded-full" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-temple-red/50 font-serif text-sm text-incense">
            {me.displayName.slice(0, 1)}
          </span>
        )}
        <span className="text-sm text-incense/85">{me.displayName}</span>
      </button>

      {menuOpen && (
        <div className="mt-2 w-32 overflow-hidden rounded-lg border border-incense/20 bg-[#160c0d]">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setSettingsOpen(true);
            }}
            className="w-full px-3 py-2 text-left text-sm text-incense/85 transition hover:bg-white/5"
          >
            設定
          </button>
        </div>
      )}

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {me.blocked && (
        <p className="mt-2 max-w-[14rem] rounded bg-[#4a1418] px-2 py-1 text-[11px] text-[#f0b8b8]">
          你的帳號目前被停用許願功能。
        </p>
      )}
    </div>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const { me, setMe } = useAuth();
  const [name, setName] = useState(me?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!me) return null;

  const saveName = async () => {
    setSaving(true);
    setError(null);
    const updated = await updateMe({ displayName: name.trim() });
    if (updated) setMe(updated);
    else setError('這個暱稱不能用，換一個吧。');
    setSaving(false);
  };

  const toggleMail = async () => {
    const updated = await updateMe({ emailOptIn: !me.emailOptIn });
    if (updated) setMe(updated);
  };

  const signOut = async () => {
    await logout();
    setMe(null);
    onClose();
  };

  return (
    <Modal title="設定" onClose={onClose}>
      <label className="block text-xs tracking-widest text-incense/50">暱稱</label>
      <div className="mt-2 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 16))}
          className="flex-1 rounded-md border border-incense/20 bg-black/50 px-3 py-2 text-sm text-incense outline-none focus:border-temple-gold/50"
        />
        <button
          type="button"
          disabled={saving || name.trim().length === 0 || name === me.displayName}
          onClick={saveName}
          className="rounded-md border border-temple-gold/50 px-4 text-sm text-incense transition hover:bg-temple-red/40 disabled:opacity-30"
        >
          {saving ? '存…' : '儲存'}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-incense/35">
        暱稱可以跟別人重複，排行榜會用 #{me.code} 區分。
      </p>
      {error && <p className="mt-1 text-xs text-[#d98a8a]">{error}</p>}

      <label className="mt-5 flex items-center gap-2 text-sm text-incense/80">
        <input
          type="checkbox"
          checked={me.emailOptIn}
          onChange={toggleMail}
          className="h-4 w-4 accent-[var(--color-temple-gold)]"
        />
        願望被互動時寄 email 通知我
      </label>
      <p className="mt-1 text-[11px] text-incense/35">
        第一次互動會即時寄一封，之後每天彙總一封，不會一直吵你。
      </p>

      <button
        type="button"
        onClick={signOut}
        className="mt-6 w-full rounded-full border border-incense/25 py-2 text-sm text-incense/70 transition hover:border-incense/50"
      >
        登出
      </button>
    </Modal>
  );
}
