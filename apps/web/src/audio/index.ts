import { useEffect } from 'react';
import { useGame } from '../gameStore';
import { strain } from '../sim/fatigue';
import { startAmbience, stopAmbience, updateAmbienceActivity, updateAmbienceFatigue } from './ambience';

export { getVolume, isMuted, setMuted, setVolume, toggleMuted } from './engine';
export { sfxBlessing, sfxDivination, sfxOfferingEaten, sfxThreadTied, sfxVerdict } from './sfx';

/** 走動中的階段：進門、往香爐、往神桌、離場都算 */
function isWalkingPhase(phase: string): boolean {
  return phase === 'entering' || phase === 'toCenser' || phase === 'toAltar' || phase === 'leaving';
}

/**
 * 掛在 Hud 上：值班開始時啟動環境音，收工或離開時停掉。
 * 疲勞與人流兩個訊號跟著 Hud 既有的 10Hz 重繪節奏一起更新，不另外開一個迴圈。
 */
export function useGameAudio(): void {
  useEffect(() => {
    startAmbience();
    return () => stopAmbience();
  }, []);

  useGame((s) => s.version);
  useEffect(() => {
    const state = useGame.getState().state;
    if (!state) return;
    updateAmbienceFatigue(strain(state));
    updateAmbienceActivity(state.worshippers.some((w) => isWalkingPhase(w.phase)));
  });
}
