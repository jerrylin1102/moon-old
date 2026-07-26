import type { GameMode } from '@moon/shared';
import { useSession, type Difficulty } from '../store';
import { useState } from 'react';
import { useGame } from '../gameStore';
import { IntroCards } from '../components/IntroCards';

interface ModeCard {
  mode: GameMode;
  name: string;
  tempo: string;
  blurb: string;
  /** 尚未實作的模式先標明，不假裝可玩 */
  ready: boolean;
}

const MODES: ModeCard[] = [
  {
    mode: 'rush',
    name: '初一十五',
    tempo: '快',
    blurb: '信眾一波波湧入，越來越急。願望聽不完就會累積怨氣，撐到打烊為止。',
    ready: true,
  },
  {
    mode: 'sorting',
    name: '神明轉單',
    tempo: '中',
    blurb: '照著業務範圍規則書判斷：這願望到底該不該你管？轉錯單，別的神明會抱怨。',
    ready: false,
  },
  {
    mode: 'story',
    name: '凡人故事',
    tempo: '慢',
    blurb: '一天只來幾個人，但每個都有完整的故事。你的決定，隔天會回來找你。',
    ready: false,
  },
];

const DIFFICULTIES: { value: Difficulty; label: string; hint: string }[] = [
  { value: 'easy', label: '香火鼎盛', hint: '起始香火多、信眾有耐心' },
  { value: 'normal', label: '尋常香期', hint: '標準值班日' },
  { value: 'hard', label: '情人節前夕', hint: '香火少、信眾很急、怨氣容忍低' },
];

export function Prepare({ onLeave }: { onLeave: () => void }) {
  const { mode, difficulty, aiRareEnabled, setMode, setDifficulty, setAiRareEnabled, setPhase } =
    useSession();
  const startGame = useGame((s) => s.start);
  const [showRules, setShowRules] = useState(false);

  const begin = () => {
    startGame(mode, difficulty);
    setPhase('play');
  };

  return (
    <div className="absolute inset-0 overflow-y-auto bg-black/80 px-5 py-10 backdrop-blur-sm">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-serif text-3xl tracking-widest text-temple-gold">選擇今日的班別</h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {MODES.map((card) => {
            const active = mode === card.mode;
            return (
              <button
                key={card.mode}
                type="button"
                disabled={!card.ready}
                onClick={() => setMode(card.mode)}
                className={[
                  'rounded-lg border p-5 text-left transition',
                  active
                    ? 'border-temple-gold bg-temple-red/35'
                    : 'border-incense/20 bg-black/40 hover:border-incense/45',
                  card.ready ? '' : 'cursor-not-allowed opacity-40',
                ].join(' ')}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-serif text-2xl text-incense">{card.name}</span>
                  <span className="text-xs text-incense/60">節奏 {card.tempo}</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-incense/75">{card.blurb}</p>
                {!card.ready && <p className="mt-3 text-xs text-temple-gold/70">尚未開放</p>}
              </button>
            );
          })}
        </div>

        <h3 className="mt-10 font-serif text-xl tracking-widest text-temple-gold">今天的香期</h3>
        <div className="mt-4 flex flex-wrap gap-3">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => setDifficulty(d.value)}
              className={[
                'rounded-full border px-5 py-2 text-sm transition',
                difficulty === d.value
                  ? 'border-temple-gold bg-temple-red/40 text-incense'
                  : 'border-incense/20 text-incense/70 hover:border-incense/45',
              ].join(' ')}
            >
              {d.label}
              <span className="ml-2 text-xs text-incense/50">{d.hint}</span>
            </button>
          ))}
        </div>

        <label className="mt-8 flex items-center gap-3 text-sm text-incense/80">
          <input
            type="checkbox"
            checked={aiRareEnabled}
            onChange={(e) => setAiRareEnabled(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-temple-gold)]"
          />
          讓稀有信眾出現（願望由 AI 即時生成，需要連線；關閉則只用預寫願望池）
        </label>

        <div className="mt-10 flex items-center gap-4">
          <button
            type="button"
            onClick={begin}
            className="rounded-full border border-temple-gold/60 bg-temple-red/50 px-10 py-3 font-serif text-lg tracking-widest text-incense transition hover:bg-temple-red/75 active:scale-95"
          >
            上座
          </button>
          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="text-sm text-incense/60 underline-offset-4 hover:underline"
          >
            重看規則
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="text-sm text-incense/60 underline-offset-4 hover:underline"
          >
            回廟門
          </button>
        </div>

        {showRules && <IntroCards onDone={() => setShowRules(false)} />}
      </div>
    </div>
  );
}
