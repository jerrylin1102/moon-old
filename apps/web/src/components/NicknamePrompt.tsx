import { useState } from 'react';
import { useAuth } from '../authStore';
import { Modal } from './Modal';
import { GoogleLoginButton } from './GoogleLoginButton';

/**
 * 未登入時先問暱稱——沒有名字就上不了排行榜。
 * 存在本機，下次不用再輸入一次。
 */
export function NicknamePrompt({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const { guest, setGuestNickname } = useAuth();
  const [name, setName] = useState(guest.nickname ?? '');

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    setGuestNickname(trimmed);
    onDone();
  };

  return (
    <Modal title="請輸入你的暱稱" onClose={onClose}>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, 16))}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="值班的月老怎麼稱呼"
        className="w-full rounded-md border border-incense/20 bg-black/50 px-3 py-2.5 text-sm text-incense outline-none placeholder:text-incense/25 focus:border-temple-gold/50"
      />
      <p className="mt-2 text-[11px] leading-relaxed text-incense/40">
        暱稱可以跟別人重複，排行榜會自動加一組識別碼區分。這個名字存在你的瀏覽器裡，下次不用再輸入。
      </p>

      <button
        type="button"
        disabled={name.trim().length === 0}
        onClick={submit}
        className="mt-4 w-full rounded-full border border-temple-gold/60 bg-temple-red/45 py-2.5 font-serif tracking-widest text-incense transition hover:bg-temple-red/70 disabled:opacity-30"
      >
        進廟
      </button>

      <div className="mt-5 border-t border-incense/10 pt-4">
        <p className="text-[11px] text-incense/40">
          想要許願、留言、保留遊玩紀錄的話，也可以直接登入：
        </p>
        <div className="mt-2">
          <GoogleLoginButton onDone={onDone} />
        </div>
      </div>
    </Modal>
  );
}
