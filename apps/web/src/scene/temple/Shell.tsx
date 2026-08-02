import type { TempleMaterials } from '../materials';
import { DOOR_HEIGHT, DOOR_WIDTH, DOOR_Z, HALL_DEPTH, HALL_WIDTH, WALL_HEIGHT, WALL_THICKNESS } from '../layout';
import { DoorGlow } from './DoorGlow';

/** 地板、四面牆（前牆留門洞）*/
export function Shell({ m }: { m: TempleMaterials }) {
  const halfW = HALL_WIDTH / 2;
  const halfD = HALL_DEPTH / 2;
  // 門洞左右兩側的牆寬
  const sideWallWidth = (HALL_WIDTH - DOOR_WIDTH) / 2;
  const sideWallOffset = DOOR_WIDTH / 2 + sideWallWidth / 2;

  return (
    <group>
      <mesh material={m.floor} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[HALL_WIDTH, HALL_DEPTH]} />
      </mesh>

      {/* 後牆（神座背後）*/}
      <mesh material={m.wall} position={[0, WALL_HEIGHT / 2, halfD]}>
        <boxGeometry args={[HALL_WIDTH, WALL_HEIGHT, WALL_THICKNESS]} />
      </mesh>

      {/* 左右牆 */}
      {[-1, 1].map((side) => (
        <mesh key={side} material={m.wall} position={[side * halfW, WALL_HEIGHT / 2, 0]}>
          <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, HALL_DEPTH]} />
        </mesh>
      ))}

      {/* 前牆：兩側牆體 + 門楣，中間留門洞 */}
      {[-1, 1].map((side) => (
        <mesh
          key={`front${side}`}
          material={m.wall}
          position={[side * sideWallOffset, WALL_HEIGHT / 2, DOOR_Z]}
        >
          <boxGeometry args={[sideWallWidth, WALL_HEIGHT, WALL_THICKNESS]} />
        </mesh>
      ))}
      <mesh
        material={m.lacquer}
        position={[0, DOOR_HEIGHT + (WALL_HEIGHT - DOOR_HEIGHT) / 2, DOOR_Z]}
      >
        <boxGeometry args={[DOOR_WIDTH, WALL_HEIGHT - DOOR_HEIGHT, WALL_THICKNESS]} />
      </mesh>

      <DoorGlow />
    </group>
  );
}
