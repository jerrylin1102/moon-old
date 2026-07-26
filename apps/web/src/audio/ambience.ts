import { audioSupported, getAudioContext, getMasterGain } from './engine';
import { getNoiseBuffer, playNoiseBurst, playTone } from './synth';

/**
 * 環境音層。廟裡不該是死寂的：香爐嗡鳴一直在，遠處偶爾一聲鐘或木魚，
 * 有人走動時偶爾聽見腳步。疲勞越高，底層噪音就越明顯——
 * 呼應畫面上「疲勞讓你聽不清楚」的視覺設計，這裡是聽覺版本。
 *
 * 這個模組自己管一個 setTimeout 排程器，不依賴 React 的重繪節奏，
 * 音效的時間感才不會被 UI 的 10Hz 節流卡住。
 */

let ambienceGain: GainNode | null = null;
let humOsc: OscillatorNode | null = null;
let humLfo: OscillatorNode | null = null;
let noiseSource: AudioBufferSourceNode | null = null;
let noiseLayerGain: GainNode | null = null;
let scheduler: ReturnType<typeof setTimeout> | null = null;
let running = false;

/** 外部餵進來的兩個訊號：疲勞程度（0-1）與現在有沒有人在走動 */
let fatigueStrain = 0;
let hasWalkers = false;

function playFootsteps(dest: AudioNode): void {
  const steps = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < steps; i++) {
    setTimeout(
      () =>
        playNoiseBurst({
          duration: 0.09,
          filterFreq: 220,
          filterType: 'lowpass',
          q: 0.7,
          gain: 0.05,
          destination: dest,
        }),
      i * 180,
    );
  }
}

function scheduleAmbientSound(): void {
  if (!running || !audioSupported || !ambienceGain) return;

  const roll = Math.random();
  if (hasWalkers && roll < 0.4) {
    playFootsteps(ambienceGain);
  } else if (roll < 0.65) {
    // 遠處一聲鐘
    playTone({ freq: 220, type: 'sine', duration: 1.6, gain: 0.05, release: 1.2, destination: ambienceGain });
    playTone({ freq: 440, type: 'sine', duration: 1.6, gain: 0.025, release: 1.2, destination: ambienceGain });
  } else {
    // 木魚
    playNoiseBurst({ duration: 0.12, filterFreq: 500, q: 4, gain: 0.09, destination: ambienceGain });
  }

  // 越累節奏越密，模擬心浮氣躁的感覺
  const base = 7000 - fatigueStrain * 3000;
  scheduler = setTimeout(scheduleAmbientSound, base + Math.random() * 5000);
}

export function startAmbience(): void {
  if (!audioSupported || running) return;
  const ctx = getAudioContext();
  const master = getMasterGain();
  if (!ctx || !master) return;

  running = true;
  ambienceGain = ctx.createGain();
  ambienceGain.gain.value = 0.6;
  ambienceGain.connect(master);

  // 香爐嗡鳴：低頻 drone，慢速顫動避免死板
  humOsc = ctx.createOscillator();
  humOsc.type = 'sine';
  humOsc.frequency.value = 92;
  const humGain = ctx.createGain();
  humGain.gain.value = 0.05;

  humLfo = ctx.createOscillator();
  humLfo.frequency.value = 0.15;
  const humLfoGain = ctx.createGain();
  humLfoGain.gain.value = 3;
  humLfo.connect(humLfoGain).connect(humOsc.frequency);

  humOsc.connect(humGain).connect(ambienceGain);
  humOsc.start();
  humLfo.start();

  // 疲勞噪音層：平常聽不太到，累的時候慢慢浮出來
  noiseSource = ctx.createBufferSource();
  noiseSource.buffer = getNoiseBuffer(ctx);
  noiseSource.loop = true;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.value = 600;
  noiseLayerGain = ctx.createGain();
  noiseLayerGain.gain.value = 0;
  noiseSource.connect(noiseFilter).connect(noiseLayerGain).connect(ambienceGain);
  noiseSource.start();

  scheduleAmbientSound();
}

export function stopAmbience(): void {
  running = false;
  if (scheduler) clearTimeout(scheduler);
  scheduler = null;

  try {
    humOsc?.stop();
    humLfo?.stop();
    noiseSource?.stop();
  } catch {
    // 已經停過或還沒 start 都可能丟例外，忽略即可
  }

  humOsc = null;
  humLfo = null;
  noiseSource = null;
  ambienceGain?.disconnect();
  ambienceGain = null;
  noiseLayerGain = null;
}

/** 每次值班的 tick 都可以呼叫，內部會自己節流成合理的 AudioParam 變化 */
export function updateAmbienceFatigue(strain: number): void {
  fatigueStrain = strain;
  if (!running || !noiseLayerGain) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  noiseLayerGain.gain.setTargetAtTime(strain * 0.12, ctx.currentTime, 0.8);
}

export function updateAmbienceActivity(walking: boolean): void {
  hasWalkers = walking;
}
