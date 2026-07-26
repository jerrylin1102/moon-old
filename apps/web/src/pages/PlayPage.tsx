import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../store';
import { useGame } from '../gameStore';
import { useInteraction } from '../interactionStore';
import { Prepare } from '../ui/Prepare';
import { Hud } from '../ui/Hud';

/**
 * 值班流程頁。準備 → 值班 → 月老日記都在這條路徑底下，
 * 用既有的 phase 機制切換，不另外開子路由——中途重新整理應該回到準備頁而不是半場遊戲。
 */
export function PlayPage() {
  const phase = useSession((s) => s.phase);
  const setPhase = useSession((s) => s.setPhase);
  const navigate = useNavigate();

  useEffect(() => {
    // 直接開 /play 或重新整理時，一律從準備頁開始
    if (phase === 'landing' || phase === 'summary') setPhase('prepare');
  }, [phase, setPhase]);

  // 離開這一頁時把遊戲收乾淨，免得回首頁後模擬還在背景跑
  useEffect(() => {
    return () => {
      useGame.getState().end();
      useInteraction.getState().reset();
      useSession.getState().setPhase('prepare');
    };
  }, []);

  if (phase === 'play') return <Hud />;
  return <Prepare onLeave={() => navigate('/')} />;
}
