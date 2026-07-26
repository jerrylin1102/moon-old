import type { Divination, Verdict } from '@moon/shared';
import { playClack, playNoiseBurst, playTone } from './synth';

/**
 * 具名音效。玩家每一個動作都該有聲音回饋，不然互動感覺是啞的。
 * 結果早就由 sim 算好了（擲筊機率、批示對錯），這裡只負責把結果播出來，
 * 不參與任何判斷——跟遊戲其餘部分「先算結果再播動畫」的原則一致。
 */

/** 擲筊落地。三種結果各自的節奏與音高不同，光聽聲音就分得出差別 */
export function sfxDivination(result: Divination): void {
  switch (result) {
    case 'sheng': // 聖筊：一正一反，音高不同，像是「有回應了」
      playClack({ pitch: 780 });
      setTimeout(() => playClack({ pitch: 520 }), 90);
      break;
    case 'yin': // 陰筊：兩個都低沉扁平
      playClack({ pitch: 480, gain: 0.36 });
      setTimeout(() => playClack({ pitch: 460, gain: 0.36 }), 100);
      break;
    case 'xiao': // 笑筊：兩個都高而脆，像在笑
      playClack({ pitch: 1100, duration: 0.05 });
      setTimeout(() => playClack({ pitch: 1150, duration: 0.05 }), 70);
      break;
  }
}

/** 准駁轉單的結果音 */
export function sfxVerdict(verdict: Verdict): void {
  switch (verdict) {
    case 'approve': // 溫暖的小鐘聲
      playTone({ freq: 660, type: 'sine', duration: 0.6, gain: 0.22, release: 0.4 });
      playTone({ freq: 990, type: 'sine', duration: 0.6, gain: 0.1, release: 0.4, detune: 4 });
      break;
    case 'reject': // 低沉短促，像敲了一下木魚表示駁回
      playTone({ freq: 180, type: 'sine', duration: 0.18, gain: 0.3, release: 0.12 });
      playNoiseBurst({ duration: 0.06, filterFreq: 300, gain: 0.15 });
      break;
    case 'transfer': // 公文轉出去的紙張刷過感
      playNoiseBurst({ duration: 0.35, filterFreq: 2500, filterType: 'highpass', q: 0.5, gain: 0.18 });
      break;
  }
}

/** 顯靈神通：清亮的上行琶音 */
export function sfxBlessing(): void {
  const base = 523.25; // C5
  [0, 4, 7, 12].forEach((semitone, i) => {
    setTimeout(
      () =>
        playTone({
          freq: base * 2 ** (semitone / 12),
          type: 'sine',
          duration: 0.9,
          gain: 0.12,
          release: 0.7,
        }),
      i * 60,
    );
  });
}

/** 紅線牽成：兩個音交疊的小確幸 */
export function sfxThreadTied(): void {
  playTone({ freq: 784, duration: 0.4, gain: 0.16, release: 0.3 });
  setTimeout(() => playTone({ freq: 988, duration: 0.5, gain: 0.14, release: 0.35 }), 120);
}

/** 偷吃供品：一口加銅錢碰撞，帶點滑稽感 */
export function sfxOfferingEaten(): void {
  playNoiseBurst({ duration: 0.1, filterFreq: 1800, q: 0.8, gain: 0.2 });
  setTimeout(() => playTone({ freq: 1200, type: 'square', duration: 0.08, gain: 0.08 }), 60);
}
