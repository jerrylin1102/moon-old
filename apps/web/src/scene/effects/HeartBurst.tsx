import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, Color, type Points } from 'three';
import { useInteraction } from '../../interactionStore';
import { useHeartTexture } from '../textures';

/** 同時最多顯示幾組配對的愛心噴發，超過的話最舊那組會被 pruneHeartBursts 先清掉 */
const MAX_BURSTS = 4;
/** 每組配對的粒子數：固定張數，不管觸發幾次配對都只吃這一份 draw call 預算 */
const PARTICLES_PER_BURST = 26;
const TOTAL = MAX_BURSTS * PARTICLES_PER_BURST;

/** 單顆愛心從出現到消失的時間（毫秒） */
const PARTICLE_LIFE_MS = 1500;
/** 愛心上升的高度 */
const RISE_HEIGHT = 1.6;
/** 兩人連線起始高度：大約胸口 */
const BASE_Y = 1.1;

const RED_TONES = ['#ff3d5c', '#ff5f7a', '#ff6b8f', '#e8395a'];

/**
 * 紅線配對成功的愛心粒子。男女配對用一般紅心，同性配對用彩虹色，
 * 固定總粒子數（MAX_BURSTS × PARTICLES_PER_BURST），沒有配對事件時全部藏到地板下。
 */
export function HeartBurst() {
  const points = useRef<Points>(null);
  const texture = useHeartTexture();

  const { lineT, jitterX, jitterZ, birthFrac, hueSeed, toneSeed } = useMemo(() => {
    const lineT = new Float32Array(TOTAL);
    const jitterX = new Float32Array(TOTAL);
    const jitterZ = new Float32Array(TOTAL);
    const birthFrac = new Float32Array(TOTAL);
    const hueSeed = new Float32Array(TOTAL);
    const toneSeed = new Uint8Array(TOTAL);

    for (let slot = 0; slot < MAX_BURSTS; slot++) {
      for (let i = 0; i < PARTICLES_PER_BURST; i++) {
        const idx = slot * PARTICLES_PER_BURST + i;
        lineT[idx] = 0.15 + Math.random() * 0.7;
        jitterX[idx] = (Math.random() - 0.5) * 0.6;
        jitterZ[idx] = (Math.random() - 0.5) * 0.6;
        birthFrac[idx] = i / PARTICLES_PER_BURST;
        hueSeed[idx] = Math.random();
        toneSeed[idx] = Math.floor(Math.random() * RED_TONES.length);
      }
    }
    return { lineT, jitterX, jitterZ, birthFrac, hueSeed, toneSeed };
  }, []);

  const positions = useMemo(() => new Float32Array(TOTAL * 3), []);
  const colors = useMemo(() => new Float32Array(TOTAL * 3), []);
  const color = useMemo(() => new Color(), []);

  useFrame((frame) => {
    const geo = points.current?.geometry;
    if (!geo) return;

    const interaction = useInteraction.getState();
    interaction.pruneHeartBursts();
    const bursts = interaction.heartBursts;

    const posAttr = geo.getAttribute('position') as BufferAttribute;
    const colorAttr = geo.getAttribute('color') as BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    const colorArr = colorAttr.array as Float32Array;
    const now = frame.clock.elapsedTime * 1000;

    for (let slot = 0; slot < MAX_BURSTS; slot++) {
      const burst = bursts[slot];

      for (let i = 0; i < PARTICLES_PER_BURST; i++) {
        const idx = slot * PARTICLES_PER_BURST + i;
        const pi = idx * 3;

        if (!burst) {
          posArr[pi] = 0;
          posArr[pi + 1] = -100;
          posArr[pi + 2] = 0;
          continue;
        }

        const elapsed = performance.now() - burst.startedAt;
        const duration = burst.until - burst.startedAt;
        const birth = (birthFrac[idx] ?? 0) * Math.max(0, duration - PARTICLE_LIFE_MS);
        const age = elapsed - birth;

        if (age < 0 || age > PARTICLE_LIFE_MS) {
          posArr[pi] = 0;
          posArr[pi + 1] = -100;
          posArr[pi + 2] = 0;
          continue;
        }

        const t = age / PARTICLE_LIFE_MS;
        const baseX = burst.from[0] + (burst.to[0] - burst.from[0]) * (lineT[idx] ?? 0.5);
        const baseZ = burst.from[1] + (burst.to[1] - burst.from[1]) * (lineT[idx] ?? 0.5);

        posArr[pi] = baseX + (jitterX[idx] ?? 0) * (0.4 + t);
        posArr[pi + 1] = BASE_Y + t * RISE_HEIGHT;
        posArr[pi + 2] = baseZ + (jitterZ[idx] ?? 0) * (0.4 + t);

        if (burst.rainbow) {
          const hue = ((hueSeed[idx] ?? 0) + now * 0.00015) % 1;
          color.setHSL(hue, 0.85, 0.6);
        } else {
          color.set(RED_TONES[toneSeed[idx] ?? 0] ?? RED_TONES[0]!);
        }
        colorArr[pi] = color.r;
        colorArr[pi + 1] = color.g;
        colorArr[pi + 2] = color.b;
      }
    }

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        size={0.16}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.92}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}
