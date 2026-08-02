import type { TempleMaterials } from '../materials';
import { DOOR_Z } from '../layout';

/** 門口兩盞紅燈籠 */
export function Lanterns({ m }: { m: TempleMaterials }) {
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 2.6, 4, DOOR_Z + 1.2]}>
          <mesh material={m.wood} position={[0, 0.9, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 1.8, 4]} />
          </mesh>
          <mesh material={m.cloth} scale={[1, 0.85, 1]}>
            <sphereGeometry args={[0.42, 12, 10]} />
          </mesh>
          <pointLight position={[0, 0, 0]} color="#ff6b52" intensity={2.2} distance={7} decay={2} />
        </group>
      ))}
    </group>
  );
}
