import { Canvas } from '@react-three/fiber';
import { DeityCamera } from './DeityCamera';
import { Temple } from './Temple';
import { Worshippers } from './Worshippers';
import { Offerings } from './Offerings';
import { WishBubbles } from './WishBubbles';
import { RedThread } from './RedThread';
import { LightShafts } from './LightShafts';
import { Effects } from './Effects';
import { DevStats } from './DevStats';
import { SimLoop } from './SimLoop';

export function Stage() {
  return (
    <Canvas
      className="absolute inset-0"
      dpr={[1, 2]}
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        // dev 才開：讓自動化檢查能從 canvas 取樣像素驗證畫面，正式版不付這個代價
        preserveDrawingBuffer: import.meta.env.DEV,
      }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.08;
      }}
      camera={{ fov: 62, near: 0.1, far: 70 }}
    >
      <color attach="background" args={['#1b0f10']} />
      {/* 香火煙霧的空氣感。近平面拉遠、範圍加大，免得整間廟被霧糊成一片 */}
      <fog attach="fog" args={['#2a1616', 16, 52]} />

      {/* 亮度取捨：夠亮到看清木作與供品，但保留燭光和天井光的方向性，
          不要打成一片平光——第一版太暗有壓迫感，全打亮又變成一間紅色空房 */}
      <ambientLight intensity={0.32} color="#ffd8ae" />
      <hemisphereLight args={['#6b4038', '#241614', 0.42]} />
      {/* 廟門外的天光：讓信眾從亮處走進來 */}
      <directionalLight position={[0, 8, -18]} intensity={0.8} color="#ffe6bb" />
      {/* 天井灑下的主要環境光，對應 LightShafts 的三道光柱 */}
      <pointLight position={[-3.75, 6.6, -4.5]} intensity={7} distance={22} decay={2} color="#ffd9a8" />
      <pointLight position={[3.75, 6.6, 0.5]} intensity={7} distance={22} decay={2} color="#ffd9a8" />
      <pointLight position={[-1, 6.6, -8]} intensity={5} distance={18} decay={2} color="#ffd0a0" />
      {/* 專門照跪拜區的補光。少了它信眾整排隱形在暗地板上——神明看不到信眾就沒戲了 */}
      <pointLight position={[0, 3.4, 1.8]} intensity={9} distance={13} decay={2} color="#ffdcb4" />

      <DeityCamera />
      <Temple />
      <Worshippers />
      <Offerings />
      <WishBubbles />
      <RedThread />
      <LightShafts />
      <SimLoop />
      <Effects />
      {import.meta.env.DEV && <DevStats />}
    </Canvas>
  );
}
