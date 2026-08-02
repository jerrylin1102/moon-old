import { usePlaqueTexture } from '../plaque';
import { DOOR_HEIGHT, DOOR_Z } from '../layout';

/**
 * 門楣上的匾額，字面朝神座——所以是唯一月老看得到的那塊。
 * 上班時整天盯著自己的 KPI。
 */
export function DoorPlaque() {
  const texture = usePlaqueTexture('有求必應');

  return (
    <mesh position={[0, DOOR_HEIGHT + 0.85, DOOR_Z + 0.25]}>
      <planeGeometry args={[4.2, 1.15]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
