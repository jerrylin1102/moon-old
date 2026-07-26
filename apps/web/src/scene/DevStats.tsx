import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useDebug } from '../debug';
import { useGame } from '../gameStore';

declare global {
  interface Window {
    /** dev 專用：讓自動化檢查能讀到場景、相機、renderer 與模擬狀態 */
    __moon?: { camera: unknown; gl: unknown; scene: unknown; state: () => unknown };
  }
}

/** 每 0.5 秒回報一次 fps 與 draw call，只在 dev 模式掛載 */
export function DevStats() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const acc = useRef(0);
  const frames = useRef(0);

  useEffect(() => {
    window.__moon = { camera, gl, scene, state: () => useGame.getState().state };
    // 後製每個 pass 都算一次 render，預設的 autoReset 會把計數清掉。
    // 關掉自動歸零、改成每帧自己 reset，統計才是「整帧總量」。
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = true;
      delete window.__moon;
    };
  }, [camera, gl, scene]);

  useFrame((_, dt) => {
    acc.current += dt;
    frames.current += 1;

    if (acc.current >= 0.5) {
      useDebug.getState().setStats({
        fps: Math.round(frames.current / acc.current),
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
      });
      acc.current = 0;
      frames.current = 0;
    }
    gl.info.reset();
  });

  return null;
}
