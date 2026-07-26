import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Color, Object3D, Vector3, type InstancedMesh } from 'three';
import { useGame } from '../gameStore';
import {
  isWaiting,
  LANE_X,
  KNEEL_ANIM_DURATION,
  MAX_CENSER_STICKS,
  offeringSlotX,
  phaseDuration,
} from '../sim/worshipper';
import type { Worshipper } from '../sim/state';
import { useInteraction } from '../interactionStore';
import { applyThread } from '../actions';
import { ALTAR_HEIGHT, ALTAR_Z, censerStickSlot, CENSER_POSITION } from './layout';

/**
 * 信眾。身體共用幾個 InstancedMesh（衣袍＋頭＋雙手＋雙腳），
 * 所以不管來幾個人都只吃固定張數的 draw call。
 *
 * 實例索引直接用走道編號：走道在同一時間是唯一的，
 * 用它當索引就不會因為有人離場、陣列重排而讓大家「突然換衣服」。
 */
const SLOTS = LANE_X.length;

/** 衣色刻意用高飽和度撞色：跟廟裡暖紅金的場景配色拉開差距，人群才會在畫面裡跳出來 */
const ROBE_COLORS = [
  '#2f7dff',
  '#ff3d7f',
  '#33cc66',
  '#ffd23f',
  '#9b4dff',
  '#00d1d1',
  '#3ddc97',
  '#4d79ff',
];
const SKIN_COLORS = ['#d8ab82', '#c69670', '#eec5a0', '#b5875c'];

/** 0-1 平滑緩動，跪拜／起身都靠它避免瞬間卡一格的生硬感 */
function easeSmooth(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 跪拜程度 0-1：0 是站著，1 是完全跪下。
 * kneeling 階段從 0 緩緩爬到 1；wishing／awaiting／divining 全程維持 1；
 * leaving 階段再從 1 緩緩放回 0——起身動作跟下跪共用同一條緩動曲線。
 */
function kneelAmount(w: Worshipper): number {
  switch (w.phase) {
    case 'kneeling':
      return easeSmooth(w.phaseTime / KNEEL_ANIM_DURATION);
    case 'wishing':
    case 'awaiting':
    case 'divining':
      return 1;
    case 'leaving':
      return 1 - easeSmooth(w.phaseTime / KNEEL_ANIM_DURATION);
    default:
      return 0;
  }
}

/** 這個階段有沒有在走路（走路才需要上下擺動與手腳擺盪） */
function isWalking(w: Worshipper): boolean {
  return (
    w.phase === 'entering' || w.phase === 'toCenser' || w.phase === 'toAltar' || w.phase === 'leaving'
  );
}

const OFFERING_INCENSE_DURATION = phaseDuration('offeringIncense') ?? 2.2;
const PLACING_OFFERING_DURATION = phaseDuration('placingOffering') ?? 1.4;

export function Worshippers() {
  const robes = useRef<InstancedMesh>(null);
  const heads = useRef<InstancedMesh>(null);
  const armL = useRef<InstancedMesh>(null);
  const armR = useRef<InstancedMesh>(null);
  const legL = useRef<InstancedMesh>(null);
  const legR = useRef<InstancedMesh>(null);
  const handStick = useRef<InstancedMesh>(null);
  const handEmber = useRef<InstancedMesh>(null);
  const carryOffering = useRef<InstancedMesh>(null);
  /** 看不見的命中盒：跪姿的輪廓很窄，直接點衣袍幾乎點不到，手機更慘 */
  const hitBoxes = useRef<InstancedMesh>(null);

  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);
  const down = useMemo(() => new Vector3(), []);
  const pivot = useMemo(() => new Vector3(), []);

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
    const armLMesh = armL.current;
    const armRMesh = armR.current;
    const legLMesh = legL.current;
    const legRMesh = legR.current;
    const stickMesh = handStick.current;
    const emberMesh = handEmber.current;
    const carryMesh = carryOffering.current;
    const hitMesh = hitBoxes.current;
    if (
      !robeMesh ||
      !headMesh ||
      !armLMesh ||
      !armRMesh ||
      !legLMesh ||
      !legRMesh ||
      !stickMesh ||
      !emberMesh ||
      !carryMesh ||
      !hitMesh
    )
      return;

    const state = useGame.getState().state;
    const byLane = new Map<number, Worshipper>();
    for (const w of state?.worshippers ?? []) byLane.set(w.lane, w);

    const { focusedId, hoveredId, threadFrom } = useInteraction.getState();
    const t = frame.clock.elapsedTime;

    for (let slot = 0; slot < SLOTS; slot++) {
      const w = byLane.get(slot);

      if (!w) {
        // 沒人就把所有部位縮到看不見，並且塞到地板底下
        dummy.position.set(0, -100, 0);
        dummy.rotation.set(0, 0, 0, 'XYZ');
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        for (const m of [robeMesh, headMesh, armLMesh, armRMesh, legLMesh, legRMesh, stickMesh, emberMesh, carryMesh, hitMesh]) {
          m.setMatrixAt(slot, dummy.matrix);
        }
        continue;
      }

      const height = 1.5 + w.seed * 0.3;
      const bodyScaleXZ = 0.92 + w.seed * 0.16;
      const kneelAmt = kneelAmount(w);
      const walking = isWalking(w);
      // 走路時上下擺一點，站著或跪著就穩住
      const walkPhase = t * w.speed * 7 + w.seed * 10;
      const bob = walking ? Math.sin(walkPhase) * 0.028 : 0;
      const lean = kneelAmt > 0 ? 0.42 * kneelAmt : w.phase === 'offeringIncense' ? -0.08 : 0;

      const skinColor = SKIN_COLORS[Math.floor(w.seed * 100) % SKIN_COLORS.length] ?? '#c9a07a';

      // 身高分成腳／軀幹／頭三段，Minecraft 式方塊人才有真正的「腳」可以站，
      // 不是像舊版的袍子直接垂到地上把腳整個蓋住
      const legHeightFull = height * 0.42;
      const torsoHeight = height * 0.4;
      // 跪下時腳縮短、軀幹跟著沉下去坐到縮短後的腳上，兩段永遠無縫相接，不會浮空也不會陷地
      const legLength = legHeightFull * (1 - kneelAmt * 0.85);
      const drop = legHeightFull - legLength;

      // 軀幹：方塊，寬度用 scale 撐出每個人的身高差
      const torsoCenterY = legLength + torsoHeight / 2 + bob;
      dummy.position.set(w.position[0], torsoCenterY, w.position[1]);
      dummy.rotation.set(lean, w.facing, 0, 'XYZ');
      dummy.scale.set(bodyScaleXZ, torsoHeight, bodyScaleXZ);
      dummy.updateMatrix();
      robeMesh.setMatrixAt(slot, dummy.matrix);

      // 選中的人會發亮並輕微脈動，指到的人稍微提亮——沒有這個回饋根本不知道自己點到誰
      const selected = w.id === focusedId || w.id === threadFrom;
      const highlight = selected ? 1.55 + Math.sin(t * 4) * 0.12 : w.id === hoveredId ? 1.25 : 1;
      color.set(ROBE_COLORS[Math.floor(w.seed * ROBE_COLORS.length)] ?? '#5a4b7a');
      color.multiplyScalar(highlight);
      robeMesh.setColorAt(slot, color);

      // 頭跟著身體的前傾一起往前移，不然跪下去會像頭飛在半空
      const headY = legLength + torsoHeight + 0.2 + bob - Math.sin(lean) * 0.18;
      const headZ = w.position[1] + Math.sin(lean) * 0.5 * Math.cos(w.facing);
      const headX = w.position[0] + Math.sin(lean) * 0.5 * Math.sin(w.facing);
      dummy.position.set(headX, headY, headZ);
      dummy.rotation.set(0, w.facing, 0, 'XYZ');
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      headMesh.setMatrixAt(slot, dummy.matrix);
      color.set(skinColor);
      headMesh.setColorAt(slot, color);

      // === 手：肩膀掛下來的兩截，走路擺盪、上香時舉起插香、跪拜時合十 ===
      // 軀幹方塊半寬 0.26（boxGeometry 寬度 0.52 的一半），肩點要落在半寬之外，
      // 手才會貼在身體「側邊」，不會整條埋進軀幹方塊裡
      const TORSO_HALF_WIDTH = 0.26;
      const ARM_HALF_WIDTH = 0.085;
      const shoulderY = legLength + torsoHeight * 0.92 + bob;
      const shoulderOffset = (TORSO_HALF_WIDTH + ARM_HALF_WIDTH + 0.02) * bodyScaleXZ;
      const rightX = Math.cos(w.facing);
      const rightZ = -Math.sin(w.facing);
      const armLength = height * 0.34;
      const armSwing = walking ? Math.sin(walkPhase + Math.PI) * 0.32 : 0;

      const activeIsRight = w.seed > 0.5;
      // 雙手合十／捧供品時，肩寬的側向距離要收攏到接近身體中線，
      // 不然跪拜區站得再密一點，鄰居兩人的手臂會直接穿模打架
      const HANDS_TOGETHER_OFFSET = 0.075 * bodyScaleXZ;

      function armPose(isRightArm: boolean): { pitch: number; offset: number } {
        if (w!.phase === 'offeringIncense') {
          const isActive = isRightArm === activeIsRight;
          if (isActive) {
            const raise = easeSmooth(w!.phaseTime / (OFFERING_INCENSE_DURATION * 0.5));
            return { pitch: lerp(0, -2.05, raise), offset: shoulderOffset };
          }
          return { pitch: armSwing * 0.25, offset: shoulderOffset };
        }
        if (w!.phase === 'placingOffering') {
          const raise = easeSmooth(w!.phaseTime / (PLACING_OFFERING_DURATION * 0.35));
          return { pitch: lerp(0, -1.05, raise), offset: lerp(shoulderOffset, HANDS_TOGETHER_OFFSET, raise) };
        }
        if (kneelAmt > 0) {
          return {
            pitch: lerp(armSwing, -1.85, kneelAmt),
            offset: lerp(shoulderOffset, HANDS_TOGETHER_OFFSET, kneelAmt),
          };
        }
        return { pitch: isRightArm ? -armSwing : armSwing, offset: shoulderOffset };
      }

      for (const side of [-1, 1] as const) {
        const isRightArm = side === 1;
        const mesh = isRightArm ? armRMesh : armLMesh;
        const { pitch, offset } = armPose(isRightArm);

        pivot.set(
          w.position[0] + side * offset * rightX,
          shoulderY,
          w.position[1] + side * offset * rightZ,
        );
        dummy.rotation.set(pitch, w.facing, 0, 'YXZ');
        down.set(0, -1, 0).applyEuler(dummy.rotation);
        dummy.position.copy(pivot).addScaledVector(down, armLength / 2);
        dummy.scale.set(bodyScaleXZ, armLength, bodyScaleXZ);
        dummy.updateMatrix();
        mesh.setMatrixAt(slot, dummy.matrix);
        color.set(skinColor);
        mesh.setColorAt(slot, color);
      }

      // === 腳：兩截並排撐在軀幹正下方，跪下時縮短、露出的部分自然變短 ===
      const hipOffset = 0.13 * bodyScaleXZ;
      const legSwing = walking ? Math.sin(walkPhase) * 0.3 : 0;

      for (const side of [-1, 1] as const) {
        const isRightLeg = side === 1;
        const mesh = isRightLeg ? legRMesh : legLMesh;
        const pitch = walking ? (isRightLeg ? -legSwing : legSwing) : 0;

        // 跪下時腳縮短了，胯部（腳的頂端）要跟著往下移到縮短後的腳頂上，
        // 否則腳會用原本的長度懸在半空，看起來像斷開飄浮
        pivot.set(
          w.position[0] + side * hipOffset * rightX,
          legLength + bob,
          w.position[1] + side * hipOffset * rightZ,
        );
        dummy.rotation.set(pitch, w.facing, 0, 'YXZ');
        down.set(0, -1, 0).applyEuler(dummy.rotation);
        dummy.position.copy(pivot).addScaledVector(down, legLength / 2);
        dummy.scale.set(bodyScaleXZ, Math.max(legLength, 0.001), bodyScaleXZ);
        dummy.updateMatrix();
        mesh.setMatrixAt(slot, dummy.matrix);
        color.set(skinColor);
        mesh.setColorAt(slot, color);
      }

      // === 上香中的信眾：手上那炷香飛去的終點，直接算「插進去之後會是第幾支」的位置，
      // 跟 Temple.tsx 的靜態香枝共用同一條公式（censerStickSlot），
      // 這樣動畫走到終點跟真的插上去的那一支完全同位置同角度同長度，才不會看起來像插完又蹦出一支 ===
      if (w.phase === 'offeringIncense') {
        const forwardX = Math.sin(w.facing);
        const forwardZ = Math.cos(w.facing);
        const handX = w.position[0] + forwardX * 0.32;
        const handZ = w.position[1] + forwardZ * 0.32;
        const handY = shoulderY + 0.1;

        const stickIndex = useGame.getState().state?.censerSticks ?? 0;
        const finalSlot = censerStickSlot(stickIndex, MAX_CENSER_STICKS);
        const targetX = CENSER_POSITION[0] + finalSlot.x;
        const targetZ = CENSER_POSITION[2] + finalSlot.z;
        const targetY = 1.5 + finalSlot.h / 2;

        const progress = easeSmooth(w.phaseTime / (OFFERING_INCENSE_DURATION * 0.5));
        const sx = lerp(handX, targetX, progress);
        const sy = lerp(handY, targetY, progress);
        const sz = lerp(handZ, targetZ, progress);
        // 拿在手上時比較平，快插到底時角度轉正到跟最終插好的角度一致
        const tilt = lerp(0.55, finalSlot.tilt, progress);
        const stickHeight = lerp(0.4, finalSlot.h, progress);

        dummy.position.set(sx, sy, sz);
        dummy.rotation.set(0, 0, tilt, 'XYZ');
        dummy.scale.set(1, stickHeight, 1);
        dummy.updateMatrix();
        stickMesh.setMatrixAt(slot, dummy.matrix);

        dummy.position.set(sx, sy + stickHeight / 2, sz);
        dummy.rotation.set(0, 0, 0, 'XYZ');
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        emberMesh.setMatrixAt(slot, dummy.matrix);
      } else {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        stickMesh.setMatrixAt(slot, dummy.matrix);
        emberMesh.setMatrixAt(slot, dummy.matrix);
      }

      // === 擺供品中的信眾：供品跟著雙手一起從胸前送上桌，抵達瞬間變成桌上的靜態供品 ===
      if (w.phase === 'placingOffering') {
        const forwardX = Math.sin(w.facing);
        const forwardZ = Math.cos(w.facing);
        const startX = w.position[0] + forwardX * 0.4;
        const startZ = w.position[1] + forwardZ * 0.4;
        const startY = shoulderY - 0.05;
        const progress = easeSmooth(w.phaseTime / PLACING_OFFERING_DURATION);
        const arc = Math.sin(progress * Math.PI) * 0.35;

        const targetX = offeringSlotX(w.lane);
        const targetY = ALTAR_HEIGHT + 0.19;
        const targetZ = ALTAR_Z - 0.15;

        dummy.position.set(
          lerp(startX, targetX, progress),
          lerp(startY, targetY, progress) + arc,
          lerp(startZ, targetZ, progress),
        );
        dummy.rotation.set(0, w.seed * Math.PI * 2, 0, 'XYZ');
        dummy.scale.setScalar(0.9 + w.seed * 0.25);
        dummy.updateMatrix();
        carryMesh.setMatrixAt(slot, dummy.matrix);
        color.set(['#e08b3c', '#d9c05a', '#c9566b', '#8fae5a', '#d97b3c'][Math.floor(w.seed * 5)] ?? '#e08b3c');
        carryMesh.setColorAt(slot, color);
      } else {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        carryMesh.setMatrixAt(slot, dummy.matrix);
      }

      // 命中盒：整個人罩起來，不跟著前傾轉，點起來才穩
      dummy.position.set(w.position[0], height * 0.5 - drop * 0.5, w.position[1]);
      dummy.rotation.set(0, 0, 0, 'XYZ');
      dummy.scale.set(0.95, Math.max(0.8, height - drop * 0.5), 0.95);
      dummy.updateMatrix();
      hitMesh.setMatrixAt(slot, dummy.matrix);
    }

    for (const m of [robeMesh, headMesh, armLMesh, armRMesh, legLMesh, legRMesh, stickMesh, emberMesh, carryMesh, hitMesh]) {
      m.instanceMatrix.needsUpdate = true;
      // InstancedMesh 的 boundingSphere 只算一次就快取。實例每帧都在動，
      // 不清掉的話視錐剔除與 raycast 都會拿第一帧的舊球去判斷——
      // 第一帧所有人都藏在地板下，結果整批人永遠被剔除、也永遠點不到。
      m.boundingSphere = null;
    }
    for (const m of [robeMesh, headMesh, armLMesh, armRMesh, legLMesh, legRMesh, carryMesh]) {
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Minecraft 式方塊人偶：軀幹／頭／四肢全走直角箱體，不再用圓錐圓球 */}
      <instancedMesh ref={robes} args={[undefined, undefined, SLOTS]}>
        <boxGeometry args={[0.52, 1, 0.3]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, SLOTS]}>
        <boxGeometry args={[0.32, 0.32, 0.32]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={armL} args={[undefined, undefined, SLOTS]}>
        <boxGeometry args={[0.17, 1, 0.17]} />
        <meshStandardMaterial roughness={0.75} />
      </instancedMesh>
      <instancedMesh ref={armR} args={[undefined, undefined, SLOTS]}>
        <boxGeometry args={[0.17, 1, 0.17]} />
        <meshStandardMaterial roughness={0.75} />
      </instancedMesh>
      <instancedMesh ref={legL} args={[undefined, undefined, SLOTS]}>
        <boxGeometry args={[0.2, 1, 0.2]} />
        <meshStandardMaterial roughness={0.75} />
      </instancedMesh>
      <instancedMesh ref={legR} args={[undefined, undefined, SLOTS]}>
        <boxGeometry args={[0.2, 1, 0.2]} />
        <meshStandardMaterial roughness={0.75} />
      </instancedMesh>

      {/* 上香中：一炷會飄到香爐裡的香 */}
      <instancedMesh ref={handStick} args={[undefined, undefined, SLOTS]}>
        <cylinderGeometry args={[0.012, 0.012, 1, 4]} />
        <meshStandardMaterial color="#8a6a3f" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={handEmber} args={[undefined, undefined, SLOTS]}>
        <sphereGeometry args={[0.026, 6, 6]} />
        <meshStandardMaterial color="#ff7a3c" emissive="#ff7a3c" emissiveIntensity={1.4} />
      </instancedMesh>

      {/* 擺供品中：一路送上桌的供品 */}
      <instancedMesh ref={carryOffering} args={[undefined, undefined, SLOTS]}>
        <icosahedronGeometry args={[0.13, 1]} />
        <meshStandardMaterial roughness={0.55} />
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
