/**
 * 音效引擎核心：一個 AudioContext、一個總音量 GainNode。
 *
 * 全部聲音都是程序生成（WebAudio 振盪器＋濾波噪音），零外部音檔、零授權風險。
 * 瀏覽器的自動播放政策要求 AudioContext 得在使用者手勢裡才能真正發聲，
 * 所以 ensureContext() 建立後還掛了一次性的手勢監聽保底 resume。
 */

const STORAGE_KEY = 'moon.audio';

export const audioSupported =
  typeof window !== 'undefined' &&
  (typeof window.AudioContext !== 'undefined' ||
    typeof (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext !==
      'undefined');

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

interface Prefs {
  muted: boolean;
  volume: number;
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Prefs>;
      return {
        muted: parsed.muted === true,
        volume: typeof parsed.volume === 'number' ? parsed.volume : 0.7,
      };
    }
  } catch {
    // localStorage 讀不到就用預設值，不影響遊戲
  }
  return { muted: false, volume: 0.7 };
}

function savePrefs(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // 存不進去就算了，下次重問一次
  }
}

const prefs = loadPrefs();

function applyGain(): void {
  if (!master || !ctx) return;
  const target = prefs.muted ? 0 : prefs.volume;
  master.gain.setTargetAtTime(target, ctx.currentTime, 0.05);
}

function ensureContext(): AudioContext | null {
  if (!audioSupported) return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
    master = ctx.createGain();
    applyGain();
    master.connect(ctx.destination);

    // 有些瀏覽器建立時就是 suspended，掛一次性手勢監聽保底喚醒
    const resume = () => {
      void ctx?.resume();
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
    };
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
  }
  void ctx.resume();
  return ctx;
}

/** 拿目前的 AudioContext，第一次呼叫時建立。不支援的環境回 null，呼叫端自己短路 */
export function getAudioContext(): AudioContext | null {
  return ensureContext();
}

/** 所有聲音都該接到這個節點，音量與靜音才能統一控制 */
export function getMasterGain(): GainNode | null {
  ensureContext();
  return master;
}

export function isMuted(): boolean {
  return prefs.muted;
}

export function setMuted(muted: boolean): void {
  prefs.muted = muted;
  savePrefs();
  applyGain();
}

export function toggleMuted(): boolean {
  setMuted(!prefs.muted);
  return prefs.muted;
}

export function getVolume(): number {
  return prefs.volume;
}

export function setVolume(volume: number): void {
  prefs.volume = Math.min(1, Math.max(0, volume));
  savePrefs();
  applyGain();
}
