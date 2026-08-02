import type { TempleMaterials } from '../materials';
import { usePlaqueTexture } from '../plaque';

/** 神座上方的匾額。文字靠 canvas 貼圖，不打包中文字型 */
export function ThronePlaque({ m }: { m: TempleMaterials }) {
  const texture = usePlaqueTexture('月老');

  return (
    <group position={[0, 5.4, 1.9]}>
      <mesh material={m.gold}>
        <boxGeometry args={[3.6, 1.12, 0.16]} />
      </mesh>
      <mesh position={[0, 0, -0.09]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[3.36, 0.96]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}
