import { useLayoutEffect, useMemo, useRef } from 'react';
import { Object3D, type InstancedMesh } from 'three';
import type { TempleMaterials } from '../materials';
import { PILLAR_RADIUS, PILLAR_X, PILLAR_Z, WALL_HEIGHT } from '../layout';

/**
 * 紅漆柱 + 金色柱頭。六根柱子共用幾何體走 InstancedMesh：
 * 一根一根擺會吃掉 18 個 draw call，而預算要留給信眾。
 */
export function Pillars({ m }: { m: TempleMaterials }) {
  const body = useRef<InstancedMesh>(null);
  const capital = useRef<InstancedMesh>(null);
  const base = useRef<InstancedMesh>(null);

  const spots = useMemo(
    () => PILLAR_Z.flatMap((z) => [-1, 1].map((side) => [side * PILLAR_X, z] as const)),
    [],
  );

  useLayoutEffect(() => {
    const dummy = new Object3D();
    const place = (mesh: InstancedMesh | null, i: number, x: number, y: number, z: number) => {
      if (!mesh) return;
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    };

    spots.forEach(([x, z], i) => {
      place(body.current, i, x, WALL_HEIGHT / 2, z);
      place(capital.current, i, x, WALL_HEIGHT - 0.25, z);
      place(base.current, i, x, 0.12, z);
    });

    for (const ref of [body, capital, base]) {
      if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
    }
  }, [spots]);

  return (
    <group>
      <instancedMesh ref={body} material={m.lacquer} args={[undefined, undefined, spots.length]}>
        <cylinderGeometry args={[PILLAR_RADIUS, PILLAR_RADIUS * 1.08, WALL_HEIGHT, 12]} />
      </instancedMesh>
      <instancedMesh ref={capital} material={m.gold} args={[undefined, undefined, spots.length]}>
        <cylinderGeometry args={[PILLAR_RADIUS * 1.35, PILLAR_RADIUS * 1.2, 0.5, 12]} />
      </instancedMesh>
      <instancedMesh ref={base} material={m.wood} args={[undefined, undefined, spots.length]}>
        <cylinderGeometry args={[PILLAR_RADIUS * 1.5, PILLAR_RADIUS * 1.6, 0.24, 12]} />
      </instancedMesh>
    </group>
  );
}
