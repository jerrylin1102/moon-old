import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, type Points } from 'three';

const COUNT = 90;
const RADIUS = 0.66;

/**
 * 香爐裡的香灰：一層細點，偶爾被熱氣掀起一點點。
 * 純粹是細節，但少了它爐子看起來像個空鍋。
 */
export function AshBed({ position }: { position: [number, number, number] }) {
  const points = useRef<Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * RADIUS;
      arr[i * 3] = Math.cos(angle) * r;
      arr[i * 3 + 1] = Math.random() * 0.05;
      arr[i * 3 + 2] = Math.sin(angle) * r;
    }
    return arr;
  }, []);

  useFrame((state) => {
    const geo = points.current?.geometry;
    if (!geo) return;
    const attr = geo.getAttribute('position') as BufferAttribute;
    const arr = attr.array as Float32Array;
    const t = state.clock.elapsedTime;

    // 只讓少數幾顆灰在飄，其他躺著就好
    for (let i = 0; i < COUNT; i += 7) {
      arr[i * 3 + 1] = 0.02 + Math.abs(Math.sin(t * 0.7 + i)) * 0.12;
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={points} position={position}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.035} sizeAttenuation color="#b6a795" transparent opacity={0.85} />
    </points>
  );
}
