import { useCallback, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Color, Object3D, type InstancedMesh } from 'three';
import { useGame } from '../gameStore';
import { applyEatOffering } from '../actions';
import { ALTAR_HEIGHT, ALTAR_Z } from './layout';

/**
 * 神桌上的供品。點下去就是偷吃——回體力最快的辦法。
 * 全部共用一個 InstancedMesh，數量上限 7，只吃掉一個 draw call。
 */
const MAX = 7;
const COLORS = ['#e08b3c', '#d9c05a', '#c9566b', '#8fae5a', '#d97b3c'];

export function Offerings() {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);

  const onClick = useCallback((e: ThreeEvent<PointerEvent>) => {
    const index = e.instanceId;
    if (index === undefined) return;
    const offering = useGame.getState().state?.offerings[index];
    if (!offering) return;
    e.stopPropagation();
    applyEatOffering(offering.id);
  }, []);

  useFrame((frame) => {
    const m = mesh.current;
    if (!m) return;
    const offerings = useGame.getState().state?.offerings ?? [];
    const t = frame.clock.elapsedTime;

    for (let i = 0; i < MAX; i++) {
      const o = offerings[i];
      if (!o) {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        continue;
      }

      // 供品輕輕浮動一下，暗示它是可以點的
      const bob = Math.sin(t * 1.6 + o.seed * 9) * 0.012;
      dummy.position.set(o.x, ALTAR_HEIGHT + 0.19 + bob, ALTAR_Z - 0.15);
      dummy.rotation.set(0, o.seed * Math.PI * 2, 0);
      dummy.scale.setScalar(0.9 + o.seed * 0.25);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      color.set(COLORS[Math.floor(o.seed * COLORS.length)] ?? '#e08b3c');
      m.setColorAt(i, color);
    }

    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    // 供品每帧都在動，快取的包圍球一樣要清掉（同 Worshippers 的坑）
    m.boundingSphere = null;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX]} onPointerDown={onClick}>
      <icosahedronGeometry args={[0.13, 1]} />
      <meshStandardMaterial roughness={0.55} />
    </instancedMesh>
  );
}
