import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { Group } from 'three';
import { useGame } from '../gameStore';
import { findWish } from '../content/pool';
import { DIFFICULTY_PRESETS } from '../sim/state';
import { isWaiting } from '../sim/worshipper';
import { wishBlurPx, wishNoiseRatio } from '../sim/fatigue';

/**
 * 願望氣泡。用 drei 的 <Html> 走 DOM，中文排版交給瀏覽器，
 * 不必為了 3D 文字打包中文字型。
 */
export function WishBubbles() {
  // version 每 0.1 秒跳一次，決定「現在有誰在說話」就夠用了
  useGame((s) => s.version);
  const state = useGame.getState().state;
  // 收班之後不再顯示願望，畫面留給結算
  if (!state || state.status !== 'running') return null;

  const waiting = state.worshippers.filter(isWaiting);
  return (
    <>
      {waiting.map((w) => (
        <Bubble key={w.id} id={w.id} wishId={w.wishId} />
      ))}
    </>
  );
}

/**
 * 疲勞越高，聽到的願望就越破碎。
 * 遮掉哪幾個字由字元位置決定，不是每帧亂跳——不然會像雜訊動畫而不是「聽不清楚」。
 */
function muffle(text: string, ratio: number): string {
  if (ratio <= 0.02) return text;
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? '';
    // 標點留著，句子的節奏還聽得出來
    const isPunctuation = '，。？！、「」…'.includes(ch);
    const noise = ((i * 2654435761) % 1000) / 1000;
    out += !isPunctuation && noise < ratio ? '⋯' : ch;
  }
  return out;
}

function Bubble({ id, wishId }: { id: string; wishId: string }) {
  const group = useRef<Group>(null);
  const bar = useRef<HTMLDivElement>(null);
  const wish = useMemo(() => findWish(wishId), [wishId]);

  // 每 0.1 秒重算一次就夠，數值也刻意分段，免得文字一直抖
  useGame((s) => s.version);
  const state = useGame.getState().state;
  const noise = state ? Math.round(wishNoiseRatio(state) * 20) / 20 : 0;
  const blur = state ? wishBlurPx(state) : 0;
  const muffled = useMemo(() => muffle(wish?.text ?? '', noise), [wish, noise]);

  useFrame(() => {
    const state = useGame.getState().state;
    const w = state?.worshippers.find((x) => x.id === id);
    if (!w || !state) return;

    // 氣泡跟著人走：位置每帧更新，但不觸發 React 重繪。
    // 相鄰走道錯開高度，人多的時候氣泡才不會疊成一團
    const stagger = (w.lane % 3) * 0.46;
    group.current?.position.set(w.position[0], 2.05 + stagger, w.position[1]);

    if (bar.current) {
      const max = DIFFICULTY_PRESETS[state.difficulty].patience;
      const ratio = Math.max(0, Math.min(1, w.patience / max));
      bar.current.style.width = `${ratio * 100}%`;
      // 快沒耐心了就轉紅
      bar.current.style.background = ratio > 0.5 ? '#d9a441' : ratio > 0.22 ? '#d97941' : '#c9414b';
    }
  });

  if (!wish) return null;

  return (
    <group ref={group}>
      <Html center distanceFactor={9} zIndexRange={[20, 0]}>
        <div className="pointer-events-none w-52 rounded-lg border border-temple-gold/40 bg-black/75 px-3 py-2 text-center sm:w-64">
          <p
            className="text-[12px] leading-snug text-incense sm:text-[13px]"
            style={{ filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined }}
          >
            {muffled}
          </p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/15">
            <div ref={bar} className="h-full" style={{ width: '100%', background: '#d9a441' }} />
          </div>
        </div>
      </Html>
    </group>
  );
}
