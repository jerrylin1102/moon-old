import type { TempleMaterials } from '../materials';
import { THRONE_PLATFORM_HEIGHT } from '../layout';
import { ThronePlaque } from './ThronePlaque';

/** 神座台：月老坐的地方（相機就在這上面），含匾額與椅背 */
export function ThroneDais({ m }: { m: TempleMaterials }) {
  return (
    <group position={[0, 0, 7]}>
      <mesh material={m.wood} position={[0, THRONE_PLATFORM_HEIGHT / 2, 0]}>
        <boxGeometry args={[5, THRONE_PLATFORM_HEIGHT, 3]} />
      </mesh>
      <mesh material={m.cloth} position={[0, THRONE_PLATFORM_HEIGHT + 0.12, 0]}>
        <boxGeometry args={[4.6, 0.24, 2.7]} />
      </mesh>
      {/* 椅背在相機後面，玩家轉頭到極限時剛好會瞄到 */}
      <mesh material={m.lacquer} position={[0, 2.6, 1.4]}>
        <boxGeometry args={[3.4, 3, 0.25]} />
      </mesh>
      <ThronePlaque m={m} />
    </group>
  );
}
