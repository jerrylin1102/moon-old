import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { PointLight } from 'three';
import type { TempleMaterials } from '../materials';

export function Candle({
  m,
  position,
  seed,
}: {
  m: TempleMaterials;
  position: [number, number, number];
  seed: number;
}) {
  const light = useRef<PointLight>(null);

  useFrame((state) => {
    if (!light.current) return;
    const t = state.clock.elapsedTime;
    // 幾個不同頻率疊起來，燭火才不會像規律呼吸燈
    const flicker =
      Math.sin(t * 9.3 + seed) * 0.06 + Math.sin(t * 21.7 + seed * 2) * 0.035 + Math.sin(t * 3.1) * 0.05;
    light.current.intensity = 14 + flicker * 12;
  });

  return (
    <group position={position}>
      <mesh material={m.bronze}>
        <cylinderGeometry args={[0.16, 0.2, 0.12, 10]} />
      </mesh>
      <mesh material={m.cloth} position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.09, 0.1, 0.8, 10]} />
      </mesh>
      <mesh material={m.flame} position={[0, 0.86, 0]} scale={[1, 1.9, 1]}>
        <sphereGeometry args={[0.042, 8, 8]} />
      </mesh>
      <pointLight
        ref={light}
        position={[0, 0.95, 0]}
        color="#ffc078"
        intensity={14}
        distance={22}
        decay={2}
      />
    </group>
  );
}
