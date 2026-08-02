import { createRef, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { type Mesh, type MeshBasicMaterial, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import { useGame } from '../../gameStore';
import { findWish } from '../../content/pool';
import type { Worshipper } from '../../sim/state';
import { isWalking, kneelAmount } from './pose';
import { SLOTS } from './constants';

/** 貼圖依網址快取，不同 NPC 換人時同一個投稿者頭像不用重抓 */
const textureCache = new Map<string, Texture>();
const loader = new TextureLoader();
loader.setCrossOrigin('anonymous');

function loadTexture(url: string): Texture {
  const cached = textureCache.get(url);
  if (cached) return cached;
  const texture = loader.load(
    url,
    (tex) => {
      tex.colorSpace = SRGBColorSpace;
    },
    undefined,
    () => {
      // 頭像網址失敗（CORS／過期）就靜默放棄，NPC 臉上維持空白，不影響遊戲
    },
  );
  textureCache.set(url, texture);
  return texture;
}

/**
 * 頭部世界座標，跟 useWorshipperFrame.ts 的頭部計算公式一致
 * （身高／跪姿前傾／走路上下擺都會影響頭的位置）。這裡獨立算一份，
 * 是因為頭像徽章是非 instanced 的個別 mesh，無法共用同一份 dummy 矩陣。
 */
function headPosition(w: Worshipper, t: number): { x: number; y: number; z: number } {
  const height = 1.5 + w.seed * 0.3;
  const kneelAmt = kneelAmount(w);
  const walking = isWalking(w);
  const walkPhase = t * w.speed * 7 + w.seed * 10;
  const bob = walking ? Math.sin(walkPhase) * 0.028 : 0;
  const lean = kneelAmt > 0 ? 0.42 * kneelAmt : w.phase === 'offeringIncense' ? -0.08 : 0;
  const legHeightFull = height * 0.42;
  const torsoHeight = height * 0.4;
  const legLength = legHeightFull * (1 - kneelAmt * 0.85);

  const y = legLength + torsoHeight + 0.2 + bob - Math.sin(lean) * 0.18;
  const z = w.position[1] + Math.sin(lean) * 0.5 * Math.cos(w.facing);
  const x = w.position[0] + Math.sin(lean) * 0.5 * Math.sin(w.facing);
  return { x, y, z };
}

/**
 * 社群（玩家投稿）信眾臉上的投稿者頭像徽章。最多 SLOTS 個非 instanced 的小 plane，
 * 因為每個人的頭像圖片不同、無法共用同一張 InstancedMesh 材質；數量固定不隨玩家人數增長。
 */
export function NpcFaceBadges() {
  const refs = useMemo(() => Array.from({ length: SLOTS }, () => createRef<Mesh>()), []);
  const lastUrl = useRef<(string | undefined)[]>(Array.from({ length: SLOTS }, () => undefined));

  useFrame((frame) => {
    const state = useGame.getState().state;
    const byLane = new Map<number, Worshipper>();
    for (const w of state?.worshippers ?? []) byLane.set(w.lane, w);
    const t = frame.clock.elapsedTime;

    for (let slot = 0; slot < SLOTS; slot++) {
      const mesh = refs[slot]?.current;
      if (!mesh) continue;

      const w = byLane.get(slot);
      const wish = w ? findWish(w.wishId) : undefined;
      const avatarUrl = wish?.source === 'community' ? wish.avatarUrl : undefined;

      if (!w || !avatarUrl) {
        mesh.visible = false;
        continue;
      }

      if (lastUrl.current[slot] !== avatarUrl) {
        lastUrl.current[slot] = avatarUrl;
        const material = mesh.material as MeshBasicMaterial;
        material.map = loadTexture(avatarUrl);
        material.needsUpdate = true;
      }

      // 貼在臉部朝向玩家那一側（facing 方向），跟蝴蝶結對稱放在右上方，避免重疊
      const head = headPosition(w, t);
      const forwardX = Math.sin(w.facing);
      const forwardZ = Math.cos(w.facing);
      const rightX = Math.cos(w.facing);
      const rightZ = -Math.sin(w.facing);

      mesh.position.set(
        head.x + forwardX * 0.13 + rightX * 0.1,
        head.y + 0.12,
        head.z + forwardZ * 0.13 + rightZ * 0.1,
      );
      mesh.rotation.set(0, w.facing, 0);
      mesh.visible = true;
    }
  });

  return (
    <group>
      {refs.map((ref, i) => (
        <mesh ref={ref} key={i} visible={false}>
          <planeGeometry args={[0.2, 0.2]} />
          <meshBasicMaterial transparent toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
