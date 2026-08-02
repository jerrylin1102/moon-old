import type { TempleMaterials } from '../materials';
import { HALL_WIDTH, WALL_HEIGHT } from '../layout';

/** 天花板垂下來的宮燈，對應 Stage 裡那三盞天井光的位置 */
export function HangingLamps({ m }: { m: TempleMaterials }) {
  const spots: [number, number][] = [
    [-HALL_WIDTH / 4, -4.5],
    [HALL_WIDTH / 4, 0.5],
    [-1, -8],
  ];

  return (
    <group>
      {spots.map(([x, z]) => (
        <group key={`${x}-${z}`} position={[x, 0, z]}>
          <mesh material={m.wood} position={[0, WALL_HEIGHT - 0.5, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 1, 4]} />
          </mesh>
          <mesh material={m.gold} position={[0, WALL_HEIGHT - 1.1, 0]}>
            <cylinderGeometry args={[0.34, 0.26, 0.5, 10]} />
          </mesh>
          <mesh material={m.flame} position={[0, WALL_HEIGHT - 1.3, 0]}>
            <sphereGeometry args={[0.12, 8, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
