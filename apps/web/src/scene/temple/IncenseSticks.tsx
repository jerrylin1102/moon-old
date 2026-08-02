import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Object3D, type InstancedMesh } from 'three';
import type { TempleMaterials } from '../materials';
import { useGame } from '../../gameStore';
import { MAX_CENSER_STICKS } from '../../sim/worshipper';
import { censerStickSlot } from '../layout';

/**
 * 插在爐裡的香，頂端是燒紅的點。
 * 走 instanced 且數量隨信眾上香即時增加：每有人完成上香動作，
 * state.censerSticks 就加一，這裡照數量把對應根數的香「變出來」（其餘縮到 0）。
 */
export function IncenseSticks({ m }: { m: TempleMaterials }) {
  const sticks = useRef<InstancedMesh>(null);
  const embers = useRef<InstancedMesh>(null);

  // 每一根香的擺放位置與長短固定用索引算出來（censerStickSlot），這樣新香出現時舊香不會跳位置，
  // 且信眾上香時手上那支香飛過去的終點也是算同一條公式，兩邊在動畫結尾會完全對上
  const slots = useMemo(
    () => Array.from({ length: MAX_CENSER_STICKS }, (_, i) => censerStickSlot(i, MAX_CENSER_STICKS)),
    [],
  );

  const dummy = useMemo(() => new Object3D(), []);

  useFrame(() => {
    const stickMesh = sticks.current;
    const emberMesh = embers.current;
    if (!stickMesh || !emberMesh) return;

    const count = useGame.getState().state?.censerSticks ?? 0;

    for (let i = 0; i < MAX_CENSER_STICKS; i++) {
      const slot = slots[i];
      if (i >= count || !slot) {
        dummy.position.set(0, -10, 0);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        stickMesh.setMatrixAt(i, dummy.matrix);
        emberMesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      // 香身的幾何體高度固定 1，用 scale 撐出長短不一
      dummy.position.set(slot.x, 1.5 + slot.h / 2, slot.z);
      dummy.scale.set(1, slot.h, 1);
      dummy.rotation.set(0, 0, slot.tilt);
      dummy.updateMatrix();
      stickMesh.setMatrixAt(i, dummy.matrix);

      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(slot.x, 1.5 + slot.h, slot.z);
      dummy.updateMatrix();
      emberMesh.setMatrixAt(i, dummy.matrix);
    }

    stickMesh.instanceMatrix.needsUpdate = true;
    emberMesh.instanceMatrix.needsUpdate = true;
    stickMesh.boundingSphere = null;
    emberMesh.boundingSphere = null;
  });

  return (
    <group>
      <instancedMesh ref={sticks} material={m.wood} args={[undefined, undefined, MAX_CENSER_STICKS]}>
        <cylinderGeometry args={[0.012, 0.012, 1, 4]} />
      </instancedMesh>
      <instancedMesh ref={embers} material={m.ember} args={[undefined, undefined, MAX_CENSER_STICKS]}>
        <sphereGeometry args={[0.028, 6, 6]} />
      </instancedMesh>
    </group>
  );
}
