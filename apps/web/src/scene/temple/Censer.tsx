import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { PointLight } from 'three';
import type { TempleMaterials } from '../materials';
import { AshBed } from '../AshBed';
import { CENSER_FOOTPRINT_DEPTH, CENSER_FOOTPRINT_WIDTH, CENSER_POSITION } from '../layout';
import { IncenseSticks } from './IncenseSticks';

/** 香爐：信眾進廟第一站 */
export function Censer({ m }: { m: TempleMaterials }) {
  const glow = useRef<PointLight>(null);

  useFrame((state) => {
    if (!glow.current) return;
    glow.current.intensity = 1.6 + Math.sin(state.clock.elapsedTime * 1.7) * 0.35;
  });

  return (
    <group position={[CENSER_POSITION[0], 0, CENSER_POSITION[2]]}>
      {/* 爐台 */}
      <mesh material={m.wood} position={[0, 0.45, 0]}>
        <boxGeometry args={[CENSER_FOOTPRINT_WIDTH, 0.9, CENSER_FOOTPRINT_DEPTH]} />
      </mesh>
      {/* 爐身 */}
      <mesh material={m.bronze} position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.75, 0.6, 0.6, 16]} />
      </mesh>
      {/* 爐耳 */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          material={m.bronze}
          position={[side * 0.8, 1.3, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.22, 0.06, 8, 12]} />
        </mesh>
      ))}
      {/* 香灰：一層底 + 飄起來的細灰 */}
      <mesh material={m.ash} position={[0, 1.46, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.68, 16]} />
      </mesh>
      <AshBed position={[0, 1.47, 0]} />
      <IncenseSticks m={m} />
      <pointLight ref={glow} position={[0, 2.1, 0]} color="#ff8a4c" intensity={1.6} distance={5} decay={2} />
    </group>
  );
}
