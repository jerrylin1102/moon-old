import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Color, Object3D, type InstancedMesh } from 'three';
import { useGame } from '../gameStore';
import { isWaiting, LANE_X } from '../sim/worshipper';
import type { Worshipper } from '../sim/state';
import { useInteraction } from '../interactionStore';
import { applyThread } from '../actions';

/**
 * 信眾。全部共用兩個 InstancedMesh（衣袍 + 頭），所以不管來幾個人都只有 2 個 draw call。
 *
 * 實例索引直接用走道編號：走道在同一時間是唯一的，
 * 用它當索引就不會因為有人離場、陣列重排而讓大家「突然換衣服」。
 */
const SLOTS = LANE_X.length;

/** 衣色刻意偏亮：廟裡光線暖而不強，太深的顏色會整個沉進地板 */
const ROBE_COLORS = [
  '#5b86a8',
  '#a85b86',
  '#6f9a52',
  '#a8804f',
  '#8073ab',
  '#a85c5c',
  '#4f9a9a',
  '#9a9463',
];
const SKIN_COLORS = ['#d8ab82', '#c69670', '#eec5a0', '#b5875c'];

/** 這個階段是不是跪著 */
function isKneeling(w: Worshipper): boolean {
  return w.phase === 'kneeling' || w.phase === 'wishing' || w.phase === 'awaiting';
}

/** 這個階段有沒有在走路（走路才需要上下擺動） */
function isWalking(w: Worshipper): boolean {
  return (
    w.phase === 'entering' || w.phase === 'toCenser' || w.phase === 'toAltar' || w.phase === 'leaving'
  );
}

export function Worshippers() {
  const robes = useRef<InstancedMesh>(null);
  const heads = useRef<InstancedMesh>(null);
  /** 看不見的命中盒：跪姿的輪廓很窄，直接點衣袍幾乎點不到，手機更慘 */
  const hitBoxes = useRef<InstancedMesh>(null);

  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);

  /** 實例索引就是走道編號，反查現在站在那條走道上的是誰 */
  const worshipperAt = useCallback((slot: number | undefined): Worshipper | undefined => {
    if (slot === undefined) return undefined;
    return useGame.getState().state?.worshippers.find((w) => w.lane === slot);
  }, []);

  const onDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (useGame.getState().state?.status !== 'running') return;
      const w = worshipperAt(e.instanceId);
      if (!w || !isWaiting(w)) return;
      e.stopPropagation();
      // 按下就先選中；如果接著拖到別人身上，就變成牽紅線
      useInteraction.getState().startThread(w.id);
    },
    [worshipperAt],
  );

  const onUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const w = worshipperAt(e.instanceId);
      const { threadFrom, endThread, focus } = useInteraction.getState();
      if (!w || !threadFrom) return;
      e.stopPropagation();

      if (w.id !== threadFrom) {
        applyThread(threadFrom, w.id);
      } else {
        focus(w.id);
      }
      endThread();
    },
    [worshipperAt],
  );

  const onMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const w = worshipperAt(e.instanceId);
      useInteraction.getState().hover(w && isWaiting(w) ? w.id : null);
    },
    [worshipperAt],
  );

  const onOut = useCallback(() => useInteraction.getState().hover(null), []);

  // 手指或滑鼠放在廟裡任何地方鬆開，都要結束拖曳中的紅線
  useEffect(() => {
    const end = () => useInteraction.getState().endThread();
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, []);

  useFrame((frame) => {
    const robeMesh = robes.current;
    const headMesh = heads.current;
    const hitMesh = hitBoxes.current;
    if (!robeMesh || !headMesh || !hitMesh) return;

    const state = useGame.getState().state;
    const byLane = new Map<number, Worshipper>();
    for (const w of state?.worshippers ?? []) byLane.set(w.lane, w);

    const { focusedId, hoveredId, threadFrom } = useInteraction.getState();
    const t = frame.clock.elapsedTime;

    for (let slot = 0; slot < SLOTS; slot++) {
      const w = byLane.get(slot);

      if (!w) {
        // 沒人就把這個實例縮到看不見，並且塞到地板底下
        dummy.position.set(0, -100, 0);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        robeMesh.setMatrixAt(slot, dummy.matrix);
        headMesh.setMatrixAt(slot, dummy.matrix);
        hitMesh.setMatrixAt(slot, dummy.matrix);
        continue;
      }

      const height = 1.5 + w.seed * 0.3;
      const kneel = isKneeling(w);
      // 走路時上下擺一點，站著或跪著就穩住
      const bob = isWalking(w) ? Math.sin(t * w.speed * 7 + w.seed * 10) * 0.028 : 0;
      const lean = kneel ? 0.42 : w.phase === 'offeringIncense' ? -0.08 : 0;
      const drop = kneel ? height * 0.3 : 0;

      // 衣袍幾何體高度是 1，用 scale.y 撐出每個人的身高差
      const robeHeight = height * 0.74;
      dummy.position.set(w.position[0], robeHeight / 2 + bob - drop, w.position[1]);
      dummy.rotation.set(lean, w.facing, 0);
      dummy.scale.set(0.92 + w.seed * 0.16, robeHeight, 0.92 + w.seed * 0.16);
      dummy.updateMatrix();
      robeMesh.setMatrixAt(slot, dummy.matrix);

      // 選中的人會發亮並輕微脈動，指到的人稍微提亮——沒有這個回饋根本不知道自己點到誰
      const selected = w.id === focusedId || w.id === threadFrom;
      const highlight = selected ? 1.55 + Math.sin(t * 4) * 0.12 : w.id === hoveredId ? 1.25 : 1;
      color.set(ROBE_COLORS[Math.floor(w.seed * ROBE_COLORS.length)] ?? '#5a4b7a');
      color.multiplyScalar(highlight);
      robeMesh.setColorAt(slot, color);

      // 頭跟著身體的前傾一起往前移，不然跪下去會像頭飛在半空
      const headY = height * 0.86 + bob - drop - Math.sin(lean) * 0.18;
      const headZ = w.position[1] + Math.sin(lean) * 0.5 * Math.cos(w.facing);
      const headX = w.position[0] + Math.sin(lean) * 0.5 * Math.sin(w.facing);
      dummy.position.set(headX, headY, headZ);
      dummy.rotation.set(0, w.facing, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      headMesh.setMatrixAt(slot, dummy.matrix);
      color.set(SKIN_COLORS[Math.floor(w.seed * 100) % SKIN_COLORS.length] ?? '#c9a07a');
      headMesh.setColorAt(slot, color);

      // 命中盒：整個人罩起來，不跟著前傾轉，點起來才穩
      dummy.position.set(w.position[0], height * 0.5 - drop * 0.5, w.position[1]);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(0.95, Math.max(0.8, height - drop * 0.5), 0.95);
      dummy.updateMatrix();
      hitMesh.setMatrixAt(slot, dummy.matrix);
    }

    robeMesh.instanceMatrix.needsUpdate = true;
    headMesh.instanceMatrix.needsUpdate = true;
    if (robeMesh.instanceColor) robeMesh.instanceColor.needsUpdate = true;
    if (headMesh.instanceColor) headMesh.instanceColor.needsUpdate = true;

    // InstancedMesh 的 boundingSphere 只算一次就快取。實例每帧都在動，
    // 不清掉的話視錐剔除與 raycast 都會拿第一帧的舊球去判斷——
    // 第一帧所有人都藏在地板下，結果整批人永遠被剔除、也永遠點不到。
    hitMesh.instanceMatrix.needsUpdate = true;
    robeMesh.boundingSphere = null;
    headMesh.boundingSphere = null;
    hitMesh.boundingSphere = null;
  });

  return (
    <group>
      <instancedMesh ref={robes} args={[undefined, undefined, SLOTS]}>
        <coneGeometry args={[0.3, 1, 8]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, SLOTS]}>
        <sphereGeometry args={[0.15, 10, 8]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>

      {/* 命中盒只負責接指標事件：不寫入顏色與深度，畫面上完全看不到 */}
      <instancedMesh
        ref={hitBoxes}
        args={[undefined, undefined, SLOTS]}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerMove={onMove}
        onPointerOut={onOut}
      >
        <boxGeometry args={[0.78, 1, 0.78]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}
