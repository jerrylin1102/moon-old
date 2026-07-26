import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, type Points } from 'three';
import { CENSER_POSITION } from './layout';
import { useSoftDotTexture } from './textures';

const COUNT = 220;
const BASE_Y = 2.25;
/** 煙升多高就散掉 */
const LIFE_HEIGHT = 3.4;

/**
 * 香煙。用 Points 在 CPU 端更新位置——粒子數在預算內（< 2000），
 * 這樣不用寫 shader 也能調手感。
 */
export function Smoke() {
  const points = useRef<Points>(null);
  const texture = useSoftDotTexture();

  const { positions, speeds, drifts } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const speeds = new Float32Array(COUNT);
    const drifts = new Float32Array(COUNT * 2);

    for (let i = 0; i < COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.28;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = Math.random() * LIFE_HEIGHT;
      positions[i * 3 + 2] = Math.sin(angle) * r;
      speeds[i] = 0.22 + Math.random() * 0.35;
      drifts[i * 2] = (Math.random() - 0.5) * 0.5;
      drifts[i * 2 + 1] = (Math.random() - 0.5) * 0.5;
    }
    return { positions, speeds, drifts };
  }, []);

  useFrame((state, dt) => {
    const geo = points.current?.geometry;
    if (!geo) return;
    const attr = geo.getAttribute('position') as BufferAttribute;
    const arr = attr.array as Float32Array;
    const t = state.clock.elapsedTime;

    for (let i = 0; i < COUNT; i++) {
      const iy = i * 3 + 1;
      arr[iy] = (arr[iy] ?? 0) + (speeds[i] ?? 0.3) * dt;

      // 越高越飄，模擬香煙散開
      const h = arr[iy] ?? 0;
      const spread = h / LIFE_HEIGHT;
      arr[i * 3] =
        (arr[i * 3] ?? 0) + Math.sin(t * 0.6 + i) * (drifts[i * 2] ?? 0) * spread * dt;
      arr[i * 3 + 2] =
        (arr[i * 3 + 2] ?? 0) + Math.cos(t * 0.5 + i) * (drifts[i * 2 + 1] ?? 0) * spread * dt;

      if (h > LIFE_HEIGHT) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.28;
        arr[i * 3] = Math.cos(angle) * r;
        arr[iy] = 0;
        arr[i * 3 + 2] = Math.sin(angle) * r;
      }
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={points} position={[CENSER_POSITION[0], BASE_Y, CENSER_POSITION[2]]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        size={0.22}
        sizeAttenuation
        color="#c8b49a"
        transparent
        opacity={0.09}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

