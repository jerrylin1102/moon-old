import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  CatmullRomCurve3,
  MeshStandardMaterial,
  Plane,
  Raycaster,
  TubeGeometry,
  Vector3,
  type Mesh,
} from 'three';
import { useGame } from '../gameStore';
import { useInteraction } from '../interactionStore';

/** 紅線離地的高度：大約在信眾胸口 */
const THREAD_Y = 1.15;
/** 中段下垂幅度（相對於兩點距離） */
const SAG = 0.18;

function threadCurve(from: [number, number], to: [number, number]): CatmullRomCurve3 {
  const a = new Vector3(from[0], THREAD_Y, from[1]);
  const b = new Vector3(to[0], THREAD_Y, to[1]);
  const mid = a.clone().lerp(b, 0.5);
  mid.y -= a.distanceTo(b) * SAG;
  return new CatmullRomCurve3([a, mid, b]);
}

/**
 * 牽紅線。拖曳中的那條每帧重建 TubeGeometry——一次只有一條，
 * 這點開銷換來真正立體、會下垂的紅線，比 1px 的線段有說服力得多。
 */
export function RedThread() {
  const dragMesh = useRef<Mesh>(null);
  const camera = useThree((s) => s.camera);

  const material = useMemo(
    () => new MeshStandardMaterial({ color: '#d1332f', roughness: 0.6, emissive: '#5c0f0d' }),
    [],
  );
  const raycaster = useMemo(() => new Raycaster(), []);
  const floor = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), []);
  const hit = useMemo(() => new Vector3(), []);

  // 已完成的配對紅線，靠 store 變動觸發重繪（數量很少）
  const threads = useInteraction((s) => s.threads);

  useFrame((frame) => {
    const interaction = useInteraction.getState();
    interaction.pruneThreads();

    const mesh = dragMesh.current;
    if (!mesh) return;

    const fromId = interaction.threadFrom;
    const state = useGame.getState().state;
    const from = fromId ? state?.worshippers.find((w) => w.id === fromId) : undefined;

    if (!from) {
      mesh.visible = false;
      return;
    }

    // 線頭跟著指標：把指標投到地板平面上
    raycaster.setFromCamera(frame.pointer, camera);
    const landed = raycaster.ray.intersectPlane(floor, hit);
    const hovered = interaction.hoveredId
      ? state?.worshippers.find((w) => w.id === interaction.hoveredId)
      : undefined;

    const tip: [number, number] = hovered
      ? hovered.position
      : landed
        ? [hit.x, hit.z]
        : from.position;

    mesh.geometry.dispose();
    mesh.geometry = new TubeGeometry(threadCurve(from.position, tip), 16, 0.022, 5, false);
    mesh.visible = true;
  });

  return (
    <group>
      <mesh ref={dragMesh} material={material} visible={false} />
      {threads.map((t) => (
        <mesh
          key={t.id}
          material={material}
          geometry={new TubeGeometry(threadCurve(t.from, t.to), 16, 0.026, 5, false)}
        />
      ))}
    </group>
  );
}
