import type { TempleMaterials } from '../materials';
import { HALL_DEPTH, HALL_WIDTH, WALL_HEIGHT } from '../layout';

/** 天花板 + 橫樑 */
export function Ceiling({ m }: { m: TempleMaterials }) {
  const beamCount = 6;
  const spacing = HALL_DEPTH / beamCount;

  return (
    <group>
      <mesh material={m.wood} position={[0, WALL_HEIGHT, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HALL_WIDTH, HALL_DEPTH]} />
      </mesh>
      {Array.from({ length: beamCount - 1 }, (_, i) => {
        const z = -HALL_DEPTH / 2 + spacing * (i + 1);
        return (
          <mesh key={z} material={m.lacquer} position={[0, WALL_HEIGHT - 0.3, z]}>
            <boxGeometry args={[HALL_WIDTH, 0.5, 0.35]} />
          </mesh>
        );
      })}
    </group>
  );
}
