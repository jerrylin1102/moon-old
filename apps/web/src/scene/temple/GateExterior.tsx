import type { TempleMaterials } from '../materials';
import { useCourtyardTexture, useDuskSkyTexture } from '../textures';
import { DOOR_WIDTH, DOOR_Z, HALL_WIDTH } from '../layout';

/**
 * 大門外的場景：石埕、牌樓式門柱、石獅座，最後收在黃昏天空／遠山剪影上。
 * 原本門洞外只有一片會發光的純色平面，遠遠看就是一塊色塊——現在有真的縱深可看。
 *
 * 位置刻意都落在 z ≈ -16 以外：信眾離場最遠只會走到 DOOR_Z - 1.5（見 sim/worshipper.ts
 * 的 leaving 分支），门柱／石獅放在那之外，才不會被走出門的信眾穿模。石埕本身沒有高低差，
 * 純粹貼圖鋪面，信眾踩過去也不會有腳懸空或陷地的問題。
 */
export function GateExterior({ m }: { m: TempleMaterials }) {
  const courtyard = useCourtyardTexture();
  const sky = useDuskSkyTexture();

  const postX = DOOR_WIDTH / 2 + 0.3;
  const postZ = DOOR_Z - 5.5;
  const postHeight = 4.4;

  return (
    <group>
      {/* 廟埕：從門檻往外鋪到天幕，石磚貼圖 repeat 鋪滿，不是一片純色。純平面沒有高低差，
          信眾（entering/leaving）會直接走過這片地板 */}
      <mesh position={[0, 0, DOOR_Z - 14]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[HALL_WIDTH + 10, 26]} />
        <meshStandardMaterial map={courtyard} roughness={0.95} />
      </mesh>

      {/* 門檻：貼著門洞的一條矮平石條，高度只有 3cm，純粹視覺上的「跨出門檻」提示，
          不會讓信眾的腳看起來陷進去或浮起來 */}
      <mesh material={m.stone} position={[0, 0.015, DOOR_Z - 0.25]}>
        <boxGeometry args={[DOOR_WIDTH + 0.3, 0.03, 0.5]} />
      </mesh>

      {/* 牌樓式門柱：兩根朱漆柱 + 橫楣 + 攢尖小屋頂，撐出「這是一座門」的輪廓，
          不再只是牆上挖一個洞。放在信眾走位範圍之外，只當背景 */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * postX, 0, postZ]}>
          <mesh material={m.stone} position={[0, 0.14, 0]}>
            <boxGeometry args={[0.62, 0.28, 0.62]} />
          </mesh>
          <mesh material={m.lacquer} position={[0, postHeight / 2 + 0.28, 0]}>
            <boxGeometry args={[0.42, postHeight, 0.42]} />
          </mesh>
        </group>
      ))}
      <mesh material={m.lacquer} position={[0, postHeight + 0.28, postZ]}>
        <boxGeometry args={[postX * 2 + 0.7, 0.36, 0.5]} />
      </mesh>
      <mesh material={m.gold} position={[0, postHeight + 0.6, postZ]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[1.3, 0.14, 1.3]} />
      </mesh>

      {/* 石獅座：門柱腳邊一對簡化石獸，門口才不會空蕩蕩，一樣落在信眾走位範圍外 */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (postX + 1.3), 0, postZ - 0.6]}>
          <mesh material={m.stone} position={[0, 0.22, 0]}>
            <boxGeometry args={[0.7, 0.44, 0.7]} />
          </mesh>
          <mesh material={m.stone} position={[0, 0.62, 0]} scale={[1, 0.9, 1.15]}>
            <sphereGeometry args={[0.32, 10, 8]} />
          </mesh>
        </group>
      ))}

      {/* 遠景天幕：黃昏漸層＋一輪月（呼應月老）＋遠山剪影，收在霧效範圍內自然淡出 */}
      <mesh position={[0, 9, DOOR_Z - 30]}>
        <planeGeometry args={[50, 26]} />
        <meshBasicMaterial map={sky} toneMapped={false} fog={false} />
      </mesh>
    </group>
  );
}
