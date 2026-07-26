import { audioSupported, getAudioContext, getMasterGain } from './engine';

/**
 * 低階合成工具。所有具名音效（sfx.ts）與環境音（ambience.ts）都疊在這幾個原語上，
 * 不重複寫 AudioContext 的接線細節。
 */

let noiseBuffer: AudioBuffer | null = null;

/** 兩秒的白噪音緩衝，所有濾波噪音音效共用一份，不必每次重算 */
export function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

interface ToneOptions {
  freq: number;
  type?: OscillatorType;
  duration: number;
  attack?: number;
  release?: number;
  gain?: number;
  detune?: number;
  destination?: AudioNode;
}

/** 單音，帶淡入淡出包絡，避免喀一聲的數位截波感 */
export function playTone(opts: ToneOptions): void {
  if (!audioSupported) return;
  const ctx = getAudioContext();
  const master = getMasterGain();
  if (!ctx || !master) return;

  const dest = opts.destination ?? master;
  const osc = ctx.createOscillator();
  osc.type = opts.type ?? 'sine';
  osc.frequency.value = opts.freq;
  if (opts.detune) osc.detune.value = opts.detune;

  const gain = ctx.createGain();
  const now = ctx.currentTime;
  const peak = opts.gain ?? 0.25;
  const attack = opts.attack ?? 0.01;
  const release = opts.release ?? opts.duration * 0.6;

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + attack);
  gain.gain.setTargetAtTime(0, now + Math.max(attack, opts.duration - release), Math.max(release / 3, 0.03));

  osc.connect(gain).connect(dest);
  osc.start(now);
  osc.stop(now + opts.duration + release + 0.1);
}

interface NoiseOptions {
  duration: number;
  filterFreq?: number;
  filterType?: BiquadFilterType;
  q?: number;
  gain?: number;
  destination?: AudioNode;
}

/** 濾波過的噪音爆發：木頭撞擊、風聲、紙張翻動這類質地都靠它做 */
export function playNoiseBurst(opts: NoiseOptions): void {
  if (!audioSupported) return;
  const ctx = getAudioContext();
  const master = getMasterGain();
  if (!ctx || !master) return;

  const dest = opts.destination ?? master;
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  src.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = opts.filterType ?? 'bandpass';
  filter.frequency.value = opts.filterFreq ?? 1200;
  filter.Q.value = opts.q ?? 1;

  const gain = ctx.createGain();
  const now = ctx.currentTime;
  const peak = opts.gain ?? 0.2;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + 0.005);
  gain.gain.setTargetAtTime(0, now + opts.duration * 0.6, Math.max(opts.duration * 0.25, 0.02));

  src.connect(filter).connect(gain).connect(dest);
  src.start(now);
  src.stop(now + opts.duration + 0.2);
}

/** 筊杯落地的木頭撞擊感：噪音爆發 + 短促下滑音疊在一起 */
export function playClack(opts: { pitch?: number; duration?: number; gain?: number; destination?: AudioNode }): void {
  const pitch = opts.pitch ?? 900;
  const duration = opts.duration ?? 0.08;
  const gain = opts.gain ?? 0.32;
  playNoiseBurst({ duration, filterFreq: pitch, filterType: 'bandpass', q: 3, gain, destination: opts.destination });
  playTone({
    freq: pitch * 0.55,
    type: 'triangle',
    duration,
    attack: 0.001,
    release: 0.05,
    gain: gain * 0.5,
    destination: opts.destination,
  });
}
