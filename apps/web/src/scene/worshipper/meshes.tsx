import type { RefObject } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { InstancedMesh } from 'three';
import { BOW_COLOR, SLOTS } from './constants';

export interface WorshipperMeshRefs {
  robes: RefObject<InstancedMesh | null>;
  heads: RefObject<InstancedMesh | null>;
  armL: RefObject<InstancedMesh | null>;
  armR: RefObject<InstancedMesh | null>;
  legL: RefObject<InstancedMesh | null>;
  legR: RefObject<InstancedMesh | null>;
  handStick: RefObject<InstancedMesh | null>;
  handEmber: RefObject<InstancedMesh | null>;
  carryOffering: RefObject<InstancedMesh | null>;
  /** 女性信眾頭上的蝴蝶結：結心＋兩片翅膀，男性信眾這三個 mesh 一律縮放成 0 */
  bowKnot: RefObject<InstancedMesh | null>;
  bowWingL: RefObject<InstancedMesh | null>;
  bowWingR: RefObject<InstancedMesh | null>;
  /** 看不見的命中盒：跪姿的輪廓很窄，直接點衣袍幾乎點不到，手機更慘 */
  hitBoxes: RefObject<InstancedMesh | null>;
}

interface WorshipperMeshesProps {
  refs: WorshipperMeshRefs;
  onDown: (e: ThreeEvent<PointerEvent>) => void;
  onUp: (e: ThreeEvent<PointerEvent>) => void;
  onMove: (e: ThreeEvent<PointerEvent>) => void;
  onOut: () => void;
}

/** Minecraft 式方塊人偶：軀幹／頭／四肢全走直角箱體，不再用圓錐圓球 */
export function WorshipperMeshes({ refs, onDown, onUp, onMove, onOut }: WorshipperMeshesProps) {
  return (
    <group>
      <instancedMesh ref={refs.robes} args={[undefined, undefined, SLOTS]}>
        <boxGeometry args={[0.52, 1, 0.3]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={refs.heads} args={[undefined, undefined, SLOTS]}>
        <boxGeometry args={[0.32, 0.32, 0.32]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={refs.armL} args={[undefined, undefined, SLOTS]}>
        <boxGeometry args={[0.17, 1, 0.17]} />
        <meshStandardMaterial roughness={0.75} />
      </instancedMesh>
      <instancedMesh ref={refs.armR} args={[undefined, undefined, SLOTS]}>
        <boxGeometry args={[0.17, 1, 0.17]} />
        <meshStandardMaterial roughness={0.75} />
      </instancedMesh>
      <instancedMesh ref={refs.legL} args={[undefined, undefined, SLOTS]}>
        <boxGeometry args={[0.2, 1, 0.2]} />
        <meshStandardMaterial roughness={0.75} />
      </instancedMesh>
      <instancedMesh ref={refs.legR} args={[undefined, undefined, SLOTS]}>
        <boxGeometry args={[0.2, 1, 0.2]} />
        <meshStandardMaterial roughness={0.75} />
      </instancedMesh>

      {/* 上香中：一炷會飄到香爐裡的香 */}
      <instancedMesh ref={refs.handStick} args={[undefined, undefined, SLOTS]}>
        <cylinderGeometry args={[0.012, 0.012, 1, 4]} />
        <meshStandardMaterial color="#8a6a3f" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={refs.handEmber} args={[undefined, undefined, SLOTS]}>
        <sphereGeometry args={[0.026, 6, 6]} />
        <meshStandardMaterial color="#ff7a3c" emissive="#ff7a3c" emissiveIntensity={1.4} />
      </instancedMesh>

      {/* 擺供品中：一路送上桌的供品 */}
      <instancedMesh ref={refs.carryOffering} args={[undefined, undefined, SLOTS]}>
        <icosahedronGeometry args={[0.13, 1]} />
        <meshStandardMaterial roughness={0.55} />
      </instancedMesh>

      {/* 女性信眾頭上的蝴蝶結：男性信眾這三個 mesh 每帧都縮放成 0，不會多佔畫面 */}
      <instancedMesh ref={refs.bowKnot} args={[undefined, undefined, SLOTS]}>
        <boxGeometry args={[0.045, 0.045, 0.045]} />
        <meshStandardMaterial color={BOW_COLOR} roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={refs.bowWingL} args={[undefined, undefined, SLOTS]}>
        <boxGeometry args={[0.1, 0.06, 0.02]} />
        <meshStandardMaterial color={BOW_COLOR} roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={refs.bowWingR} args={[undefined, undefined, SLOTS]}>
        <boxGeometry args={[0.1, 0.06, 0.02]} />
        <meshStandardMaterial color={BOW_COLOR} roughness={0.6} />
      </instancedMesh>

      {/* 命中盒只負責接指標事件：不寫入顏色與深度，畫面上完全看不到 */}
      <instancedMesh
        ref={refs.hitBoxes}
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
