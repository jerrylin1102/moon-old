import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Stage } from './scene/Stage';
import { DebugOverlay } from './ui/DebugOverlay';
import { Home } from './pages/Home';
import { PlayPage } from './pages/PlayPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { WishesPage } from './pages/WishesPage';
import { AdminPage } from './pages/AdminPage';
import { fetchApprovedWishes, fetchAuthConfig, fetchMe } from './api';
import { mergeExtraWishes } from './content/pool';
import { useAuth } from './authStore';

export default function App() {
  useEffect(() => {
    // 開場問三件事：我是誰、這台開不開放登入、有沒有社群願望。
    // 三件都失敗也沒關係——官方願望池已經在 bundle 裡，遊戲照玩
    void fetchMe()
      .then((me) => useAuth.getState().setMe(me))
      .finally(() => useAuth.getState().setLoading(false));

    void fetchAuthConfig().then(({ googleClientId }) =>
      useAuth.getState().setGoogleClientId(googleClientId),
    );

    void fetchApprovedWishes().then((wishes) => {
      if (wishes.length > 0) mergeExtraWishes(wishes);
    });
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* 廟一直在背景，換頁只是換上面那層 */}
      <Stage />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/play" element={<PlayPage />} />
        <Route path="/wishes" element={<WishesPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {import.meta.env.DEV && <DebugOverlay />}
    </div>
  );
}
