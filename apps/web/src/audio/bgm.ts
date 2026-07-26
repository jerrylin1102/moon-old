import { audioSupported, getAudioContext, getMasterGain } from './engine';

/**
 * 背景音樂：真人錄製的中國風配樂（Pixabay Content License，免費商用、免標註）。
 * 授權資訊見 assets/CREDITS.md。
 *
 * 走 HTMLAudioElement + MediaElementAudioSourceNode 接進跟音效共用的 master gain，
 * 這樣靜音鈕跟音量設定不用另外寫一套，跟 ambience／sfx 共用同一個開關。
 */
const BGM_URL = '/audio/bgm-temple.mp3';
/** 背景音樂音量比音效再低一點，不搶戲 */
const BGM_GAIN = 0.5;

let audioEl: HTMLAudioElement | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let gainNode: GainNode | null = null;

export function startBgm(): void {
  if (!audioSupported) return;
  const ctx = getAudioContext();
  const master = getMasterGain();
  if (!ctx || !master) return;

  if (!audioEl) {
    audioEl = new Audio(BGM_URL);
    audioEl.loop = true;
    audioEl.preload = 'auto';

    sourceNode = ctx.createMediaElementSource(audioEl);
    gainNode = ctx.createGain();
    gainNode.gain.value = BGM_GAIN;
    sourceNode.connect(gainNode).connect(master);
  }

  void audioEl.play().catch(() => {
    // 瀏覽器自動播放政策擋下也沒關係：使用者第一次點擊／按鍵時，
    // engine.ts 的手勢監聽會 resume AudioContext，屆時已經呼叫過 play() 的
    // audio element 會自然接著出聲，不用在這裡另外重試。
  });
}

export function stopBgm(): void {
  audioEl?.pause();
}
