import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasSeenIntro, useAuth } from '../authStore';
import { AccountCorner } from '../components/AccountCorner';
import { NicknamePrompt } from '../components/NicknamePrompt';
import { IntroCards } from '../components/IntroCards';
import { Modal } from '../components/Modal';
import { GoogleLoginButton } from '../components/GoogleLoginButton';

/**
 * 首頁。三條路：值班、許願、排行榜。
 *
 * 值班的流程有兩道關卡：沒名字要先取名，第一次玩要先看四張卡片。
 * 兩道都過了才進 /play。
 */
export function Home() {
  const navigate = useNavigate();
  const { me } = useAuth();
  const [asking, setAsking] = useState<'nickname' | 'intro' | 'login' | null>(null);

  const startPlay = () => {
    const named = me !== null || useAuth.getState().guest.nickname !== null;
    if (!named) return setAsking('nickname');
    if (!hasSeenIntro()) return setAsking('intro');
    navigate('/play');
  };

  // 取完名字接著看教學；教學看完才真的進遊戲
  const afterNickname = () => (hasSeenIntro() ? navigate('/play') : setAsking('intro'));

  const openWishes = () => (me ? navigate('/wishes') : setAsking('login'));

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-black/85 via-black/70 to-black/90 px-6 text-center">
      <AccountCorner />

      <p className="font-serif text-sm tracking-[0.5em] text-temple-gold/70">月　老　廟</p>
      <h1 className="mt-4 font-serif text-5xl font-bold tracking-widest text-incense drop-shadow-[0_0_30px_rgba(217,164,65,0.35)] sm:text-6xl">
        月老值班中
      </h1>
      <p className="mt-6 max-w-md text-base leading-relaxed text-incense/80">
        有人求姻緣，有人求機運，有人求搶票。
        <br />
        今天輪到你坐上神座。
      </p>

      <button
        type="button"
        onClick={startPlay}
        className="mt-10 rounded-full border border-temple-gold/60 bg-temple-red/40 px-10 py-4 font-serif text-lg tracking-widest text-incense transition hover:bg-temple-red/70 active:scale-95"
      >
        今天輪到你值班
      </button>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={openWishes}
          className="rounded-full border border-incense/25 px-6 py-2.5 text-sm text-incense/85 transition hover:border-incense/55 active:scale-95"
        >
          我要許願
        </button>
        <button
          type="button"
          onClick={() => navigate('/leaderboard')}
          className="rounded-full border border-incense/25 px-6 py-2.5 text-sm text-incense/85 transition hover:border-incense/55 active:scale-95"
        >
          值班排行
        </button>
      </div>

      <p className="mt-12 max-w-sm text-xs leading-relaxed text-incense/45">
        本作為虛構娛樂創作，並非宗教儀式或教義的呈現。
      </p>

      {asking === 'nickname' && (
        <NicknamePrompt onDone={afterNickname} onClose={() => setAsking(null)} />
      )}
      {asking === 'intro' && <IntroCards onDone={() => navigate('/play')} />}
      {asking === 'login' && (
        <Modal title="許願要先登入" onClose={() => setAsking(null)}>
          <p className="text-sm leading-relaxed text-incense/75">
            許願之後，別人在遊戲裡遇到你的願望、擲了什麼筊、留了什麼話，都會回報給你。
            所以需要一個能通知你的帳號。
          </p>
          <div className="mt-4">
            <GoogleLoginButton onDone={() => navigate('/wishes')} />
          </div>
        </Modal>
      )}
    </div>
  );
}
