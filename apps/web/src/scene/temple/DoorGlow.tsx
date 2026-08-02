import { useDoorGlowTexture } from '../textures';
import { DOOR_HEIGHT, DOOR_WIDTH, DOOR_Z } from '../layout';

/** 門外灑進來的天光。信眾從這片亮處走進來 */
export function DoorGlow() {
  const texture = useDoorGlowTexture();

  return (
    <mesh position={[0, DOOR_HEIGHT / 2 - 0.1, DOOR_Z - 1.4]}>
      <planeGeometry args={[DOOR_WIDTH * 2.1, DOOR_HEIGHT * 1.5]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );
}
