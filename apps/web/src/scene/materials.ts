import { useMemo } from 'react';
import { MeshStandardMaterial } from 'three';

/**
 * 共用材質。整座廟只用這幾種材質，讓 draw call 維持在預算內
 * （目標 < 100，見計畫的效能預算）。
 */
export function useTempleMaterials() {
  return useMemo(() => {
    const make = (params: ConstructorParameters<typeof MeshStandardMaterial>[0]) =>
      new MeshStandardMaterial(params);

    return {
      // 底色比第一版整體提亮：暗到看不清細節時，氣氛就只剩壓迫
      floor: make({ color: '#42302c', roughness: 0.92, metalness: 0.05 }),
      wall: make({ color: '#5a3f37', roughness: 0.88 }),
      lacquer: make({ color: '#8f2721', roughness: 0.48, metalness: 0.1 }),
      wood: make({ color: '#6b4632', roughness: 0.82 }),
      gold: make({ color: '#e6b455', roughness: 0.26, metalness: 0.85 }),
      bronze: make({ color: '#8d6d43', roughness: 0.42, metalness: 0.7 }),
      ash: make({ color: '#9a8f83', roughness: 1 }),
      cloth: make({ color: '#bb3a33', roughness: 0.93 }),
      flame: make({
        color: '#ffbe63',
        emissive: '#ff8c2b',
        emissiveIntensity: 2.2,
        roughness: 1,
      }),
      ember: make({
        color: '#ff7a3c',
        emissive: '#ff5522',
        emissiveIntensity: 2.5,
        roughness: 1,
      }),
    };
  }, []);
}

export type TempleMaterials = ReturnType<typeof useTempleMaterials>;
