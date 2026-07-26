import { useState } from 'react';
import { useAuth } from '../authStore';
import { updateMe } from '../api';

/**
 * 首次遊玩的教學卡片。
 *
 * 刻意只有四張、每張兩三句——玩家是來玩的，不是來讀說明書的。
 * 看完或略過都會記住：登入者記在帳號，訪客記在本機。
 */
const CARDS = [
  {
    title: '你是月老',
    body: '坐在神座上，看著信眾一個個進來。你不能走動——神像本來就不會走。滑鼠或手指只能轉頭。',
  },
  {
    title: '聽願望，然後決定',
    body: '點信眾就能聽他說。准、駁、或轉單給別的神明。搶票、考試這種事本來就不歸月老管，轉出去才是對的。',
  },
  {
    title: '擲筊與紅線',
    body: '也可以擲筊回應：聖筊、笑筊、陰筊。笑筊代表沒問清楚，他會再問一次。兩個求姻緣的人，可以拖曳紅線把他們接起來。',
  },
  {
    title: '你會累',
    body: '處理得越多越累，累到聽不清楚、手也變慢。神桌上的供品可以偷吃回體力。沒人理的願望會累積怨氣，滿了今天就收攤。',
  },
];

export function IntroCards({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const { me, setMe, markIntroSeen } = useAuth();
  const card = CARDS[index];
  const last = index === CARDS.length - 1;

  const finish = () => {
    // 登入者記在帳號，訪客記在本機。兩邊都是「記住就好」，失敗也不擋玩家
    if (me) {
      void updateMe({ introSeen: true }).then((updated) => updated && setMe(updated));
    } else {
      markIntroSeen();
    }
    onDone();
  };

  if (!card) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-5 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-temple-gold/35 bg-[#160c0d] p-6">
        <div className="flex items-center justify-between">
          <span className="font-serif text-xs tracking-[0.3em] text-temple-gold/60">
            {index + 1} / {CARDS.length}
          </span>
          <button
            type="button"
            onClick={finish}
            className="text-xs text-incense/40 transition hover:text-incense/80"
          >
            略過
          </button>
        </div>

        <h2 className="mt-4 font-serif text-2xl tracking-widest text-incense">{card.title}</h2>
        <p className="mt-3 min-h-[5.5rem] text-sm leading-relaxed text-incense/80">{card.body}</p>

        <div className="mt-5 flex items-center gap-2">
          {CARDS.map((c, i) => (
            <span
              key={c.title}
              className={`h-1 flex-1 rounded-full ${i <= index ? 'bg-temple-gold/70' : 'bg-white/10'}`}
            />
          ))}
        </div>

        <div className="mt-5 flex justify-between">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="text-sm text-incense/50 transition hover:text-incense/85 disabled:opacity-25"
          >
            上一張
          </button>
          <button
            type="button"
            onClick={() => (last ? finish() : setIndex((i) => i + 1))}
            className="rounded-full border border-temple-gold/60 bg-temple-red/45 px-6 py-2 font-serif tracking-widest text-incense transition hover:bg-temple-red/70 active:scale-95"
          >
            {last ? '開始值班' : '下一張'}
          </button>
        </div>
      </div>
    </div>
  );
}
