import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { useGame } from '../gameStore';
import { vignetteDarkness } from '../sim/fatigue';

/**
 * 後製：燭火與香頭發光靠 Bloom 撐起來。
 * 暗角平常很輕（開太重就回到壓迫感那個問題），但會隨疲勞加深——
 * 越累視野越窄，是玩家最先感覺到「該休息了」的訊號。
 */
export function Effects() {
  useGame((s) => s.version);
  const state = useGame.getState().state;
  const darkness = state ? vignetteDarkness(state) : 0.42;

  return (
    <EffectComposer>
      <Bloom intensity={0.75} luminanceThreshold={0.62} luminanceSmoothing={0.3} mipmapBlur />
      <Vignette offset={0.32} darkness={darkness} />
    </EffectComposer>
  );
}
