import type { TempleMaterials } from '../materials';
import { ALTAR_DEPTH, ALTAR_HEIGHT, ALTAR_WIDTH, ALTAR_Z } from '../layout';
import { Candle } from './Candle';

/** 神桌與供品桌面：燭台、供果位、桌圍 */
export function Altar({ m }: { m: TempleMaterials }) {
  return (
    <group position={[0, 0, ALTAR_Z]}>
      <mesh material={m.wood} position={[0, ALTAR_HEIGHT, 0]}>
        <boxGeometry args={[ALTAR_WIDTH, 0.16, ALTAR_DEPTH]} />
      </mesh>
      {/* 桌圍（紅布），順便遮住桌腳 */}
      <mesh material={m.cloth} position={[0, ALTAR_HEIGHT / 2, -ALTAR_DEPTH / 2]}>
        <boxGeometry args={[ALTAR_WIDTH, ALTAR_HEIGHT, 0.06]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          material={m.wood}
          position={[side * (ALTAR_WIDTH / 2 - 0.3), ALTAR_HEIGHT / 2, 0.4]}
        >
          <boxGeometry args={[0.2, ALTAR_HEIGHT, 0.2]} />
        </mesh>
      ))}

      {/* 兩支蠟燭，是這座廟的主光源 */}
      {[-1, 1].map((side) => (
        <Candle key={side} m={m} position={[side * 1.95, ALTAR_HEIGHT + 0.08, 0]} seed={side} />
      ))}
    </group>
  );
}
