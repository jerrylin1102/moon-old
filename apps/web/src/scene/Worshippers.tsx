import { useRef } from 'react';
import type { InstancedMesh } from 'three';
import { useWorshipperInteraction } from './worshipper/interaction';
import { useWorshipperFrame } from './worshipper/useWorshipperFrame';
import { WorshipperMeshes, type WorshipperMeshRefs } from './worshipper/meshes';
import { NpcFaceBadges } from './worshipper/NpcFaceBadges';

/**
 * 信眾場景元件。渲染邏輯拆進 scene/worshipper/：
 * - meshes.tsx：InstancedMesh 宣告
 * - interaction.ts：指標事件（點選／拖紅線／hover）
 * - useWorshipperFrame.ts：逐 slot 姿勢計算
 * 這裡只負責建立共用的 mesh refs 並把三者接起來，維持「固定張數 InstancedMesh」的效能設計。
 */
export function Worshippers() {
  const refs: WorshipperMeshRefs = {
    robes: useRef<InstancedMesh>(null),
    heads: useRef<InstancedMesh>(null),
    armL: useRef<InstancedMesh>(null),
    armR: useRef<InstancedMesh>(null),
    legL: useRef<InstancedMesh>(null),
    legR: useRef<InstancedMesh>(null),
    handStick: useRef<InstancedMesh>(null),
    handEmber: useRef<InstancedMesh>(null),
    carryOffering: useRef<InstancedMesh>(null),
    bowKnot: useRef<InstancedMesh>(null),
    bowWingL: useRef<InstancedMesh>(null),
    bowWingR: useRef<InstancedMesh>(null),
    hitBoxes: useRef<InstancedMesh>(null),
  };

  const { onDown, onUp, onMove, onOut } = useWorshipperInteraction();
  useWorshipperFrame(refs);

  return (
    <>
      <WorshipperMeshes refs={refs} onDown={onDown} onUp={onUp} onMove={onMove} onOut={onOut} />
      <NpcFaceBadges />
    </>
  );
}
