import { AdditiveBlending } from 'three';
import { HALL_WIDTH, WALL_HEIGHT } from './layout';

/**
 * 天井灑下來的光柱。用半透明 additive 圓錐假裝體積光——
 * 便宜、不用 volumetric shader，而且讓廟裡有「上方有出口」的空氣感，
 * 是解決壓迫感最有效的一招。
 */
const SHAFTS: { x: number; z: number; radius: number }[] = [
  { x: -HALL_WIDTH / 4, z: -4.5, radius: 1.5 },
  { x: HALL_WIDTH / 4, z: 0.5, radius: 1.7 },
  { x: -1, z: -8, radius: 1.3 },
];

export function LightShafts() {
  return (
    <group>
      {SHAFTS.map((s) => (
        <group key={`${s.x}-${s.z}`} position={[s.x, 0, s.z]}>
          <mesh position={[0, WALL_HEIGHT / 2, 0]}>
            {/* 上窄下寬，開口朝下 */}
            <coneGeometry args={[s.radius, WALL_HEIGHT, 16, 1, true]} />
            <meshBasicMaterial
              color="#ffdca8"
              transparent
              opacity={0.045}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
          {/* 光柱落在地上的亮斑 */}
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[s.radius, 16]} />
            <meshBasicMaterial
              color="#ffd9a0"
              transparent
              opacity={0.07}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
