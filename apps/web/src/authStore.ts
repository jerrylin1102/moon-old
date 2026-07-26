import { create } from 'zustand';

/**
 * 帳號與訪客身分。
 *
 * 兩種身分並存：登入者的資料在後端，訪客的暱稱與已讀狀態存在本機。
 * 沒登入照樣能玩、能上排行榜——登入只解鎖許願與留言。
 */

export interface Me {
  id: string;
  displayName: string;
  /** 排行榜用的三碼識別碼，暱稱可重複時靠它分辨 */
  code: string;
  avatarUrl: string | null;
  email: string;
  emailOptIn: boolean;
  introSeen: boolean;
  blocked: boolean;
  blockedReason: string | null;
}

const GUEST_KEY = 'moon.guest';

interface GuestIdentity {
  guestId: string;
  nickname: string | null;
  introSeen: boolean;
}

function loadGuest(): GuestIdentity {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GuestIdentity>;
      if (typeof parsed.guestId === 'string') {
        return {
          guestId: parsed.guestId,
          nickname: typeof parsed.nickname === 'string' ? parsed.nickname : null,
          introSeen: parsed.introSeen === true,
        };
      }
    }
  } catch {
    // localStorage 可能被瀏覽器擋掉（無痕、隱私設定），那就每次都當新訪客
  }
  return { guestId: crypto.randomUUID(), nickname: null, introSeen: false };
}

function saveGuest(guest: GuestIdentity): void {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(guest));
  } catch {
    // 存不進去就算了，只是下次要重新輸入暱稱
  }
}

interface AuthStore {
  me: Me | null;
  /** 還沒問過後端「我是誰」之前是 true，避免畫面閃一下登入按鈕 */
  loading: boolean;
  googleClientId: string | null;
  guest: GuestIdentity;

  setMe: (me: Me | null) => void;
  setLoading: (loading: boolean) => void;
  setGoogleClientId: (id: string | null) => void;
  setGuestNickname: (nickname: string) => void;
  markIntroSeen: () => void;
}

export const useAuth = create<AuthStore>((set, get) => ({
  me: null,
  loading: true,
  googleClientId: null,
  guest: loadGuest(),

  setMe: (me) => set({ me }),
  setLoading: (loading) => set({ loading }),
  setGoogleClientId: (googleClientId) => set({ googleClientId }),

  setGuestNickname: (nickname) => {
    const guest = { ...get().guest, nickname };
    saveGuest(guest);
    set({ guest });
  },

  markIntroSeen: () => {
    const guest = { ...get().guest, introSeen: true };
    saveGuest(guest);
    set({ guest });
  },
}));

/** 現在該用哪個名字。登入者用帳號暱稱，訪客用本機暱稱 */
export function currentNickname(): string | null {
  const { me, guest } = useAuth.getState();
  return me?.displayName ?? guest.nickname;
}

/** 教學卡片看過了沒——登入看帳號，訪客看本機 */
export function hasSeenIntro(): boolean {
  const { me, guest } = useAuth.getState();
  return me ? me.introSeen : guest.introSeen;
}
