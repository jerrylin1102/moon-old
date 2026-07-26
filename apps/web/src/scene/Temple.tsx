import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Object3D, type InstancedMesh, type PointLight } from 'three';
import { useTempleMaterials, type TempleMaterials } from './materials';
import { Smoke } from './Smoke';
import { AshBed } from './AshBed';
import { usePlaqueTexture } from './plaque';
import { useDoorGlowTexture } from './textures';
import {
  ALTAR_DEPTH,
  ALTAR_HEIGHT,
  ALTAR_WIDTH,
  ALTAR_Z,
  CENSER_POSITION,
  DOOR_HEIGHT,
  DOOR_WIDTH,
  DOOR_Z,
  HALL_DEPTH,
  HALL_WIDTH,
  PILLAR_RADIUS,
  PILLAR_X,
  PILLAR_Z,
  THRONE_PLATFORM_HEIGHT,
  WALL_HEIGHT,
  WALL_THICKNESS,
} from './layout';

/** 整座廟：全部由 three.js 內建幾何體程序組成，零外部模型 */
export function Temple() {
  const m = useTempleMaterials();

  return (
    <group>
      <Shell m={m} />
      <Pillars m={m} />
      <Ceiling m={m} />
      <ThroneDais m={m} />
      <Altar m={m} />
      <Censer m={m} />
      <Smoke />
      <Lanterns m={m} />
      <HangingLamps m={m} />
      <DoorPlaque />
    </group>
  );
}

/**
 * 門楣上的匾額，字面朝神座——所以是唯一月老看得到的那塊。
 * 上班時整天盯著自己的 KPI。
 */
function DoorPlaque() {
  const texture = usePlaqueTexture('有求必應');

  return (
    <mesh position={[0, DOOR_HEIGHT + 0.85, DOOR_Z + 0.25]}>
      <planeGeometry args={[4.2, 1.15]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

/** 天花板垂下來的宮燈，對應 Stage 裡那三盞天井光的位置 */
function HangingLamps({ m }: { m: TempleMaterials }) {
  const spots: [number, number][] = [
    [-HALL_WIDTH / 4, -4.5],
    [HALL_WIDTH / 4, 0.5],
    [-1, -8],
  ];

  return (
    <group>
      {spots.map(([x, z]) => (
        <group key={`${x}-${z}`} position={[x, 0, z]}>
          <mesh material={m.wood} position={[0, WALL_HEIGHT - 0.5, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 1, 4]} />
          </mesh>
          <mesh material={m.gold} position={[0, WALL_HEIGHT - 1.1, 0]}>
            <cylinderGeometry args={[0.34, 0.26, 0.5, 10]} />
          </mesh>
          <mesh material={m.flame} position={[0, WALL_HEIGHT - 1.3, 0]}>
            <sphereGeometry args={[0.12, 8, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** 地板、四面牆（前牆留門洞）*/
function Shell({ m }: { m: TempleMaterials }) {
  const halfW = HALL_WIDTH / 2;
  const halfD = HALL_DEPTH / 2;
  // 門洞左右兩側的牆寬
  const sideWallWidth = (HALL_WIDTH - DOOR_WIDTH) / 2;
  const sideWallOffset = DOOR_WIDTH / 2 + sideWallWidth / 2;

  return (
    <group>
      <mesh material={m.floor} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[HALL_WIDTH, HALL_DEPTH]} />
      </mesh>

      {/* 後牆（神座背後）*/}
      <mesh material={m.wall} position={[0, WALL_HEIGHT / 2, halfD]}>
        <boxGeometry args={[HALL_WIDTH, WALL_HEIGHT, WALL_THICKNESS]} />
      </mesh>

      {/* 左右牆 */}
      {[-1, 1].map((side) => (
        <mesh key={side} material={m.wall} position={[side * halfW, WALL_HEIGHT / 2, 0]}>
          <boxGeometry args={[WALL_THICKNESS, WALL_HEIGHT, HALL_DEPTH]} />
        </mesh>
      ))}

      {/* 前牆：兩側牆體 + 門楣，中間留門洞 */}
      {[-1, 1].map((side) => (
        <mesh
          key={`front${side}`}
          material={m.wall}
          position={[side * sideWallOffset, WALL_HEIGHT / 2, DOOR_Z]}
        >
          <boxGeometry args={[sideWallWidth, WALL_HEIGHT, WALL_THICKNESS]} />
        </mesh>
      ))}
      <mesh
        material={m.lacquer}
        position={[0, DOOR_HEIGHT + (WALL_HEIGHT - DOOR_HEIGHT) / 2, DOOR_Z]}
      >
        <boxGeometry args={[DOOR_WIDTH, WALL_HEIGHT - DOOR_HEIGHT, WALL_THICKNESS]} />
      </mesh>

      <DoorGlow />
    </group>
  );
}

/**
 * 紅漆柱 + 金色柱頭。六根柱子共用幾何體走 InstancedMesh：
 * 一根一根擺會吃掉 18 個 draw call，而預算要留給 M2 的信眾。
 */
function Pillars({ m }: { m: TempleMaterials }) {
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

/** 天花板 + 橫樑 */
function Ceiling({ m }: { m: TempleMaterials }) {
  const beamCount = 6;
  const spacing = HALL_DEPTH / beamCount;

  return (
    <group>
      <mesh material={m.wood} position={[0, WALL_HEIGHT, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HALL_WIDTH, HALL_DEPTH]} />
      </mesh>
      {Array.from({ length: beamCount - 1 }, (_, i) => {
        const z = -HALL_DEPTH / 2 + spacing * (i + 1);
        return (
          <mesh key={z} material={m.lacquer} position={[0, WALL_HEIGHT - 0.3, z]}>
            <boxGeometry args={[HALL_WIDTH, 0.5, 0.35]} />
          </mesh>
        );
      })}
    </group>
  );
}

/** 神座台：月老坐的地方（相機就在這上面），含匾額與椅背 */
function ThroneDais({ m }: { m: TempleMaterials }) {
  return (
    <group position={[0, 0, 7]}>
      <mesh material={m.wood} position={[0, THRONE_PLATFORM_HEIGHT / 2, 0]}>
        <boxGeometry args={[5, THRONE_PLATFORM_HEIGHT, 3]} />
      </mesh>
      <mesh material={m.cloth} position={[0, THRONE_PLATFORM_HEIGHT + 0.12, 0]}>
        <boxGeometry args={[4.6, 0.24, 2.7]} />
      </mesh>
      {/* 椅背在相機後面，玩家轉頭到極限時剛好會瞄到 */}
      <mesh material={m.lacquer} position={[0, 2.6, 1.4]}>
        <boxGeometry args={[3.4, 3, 0.25]} />
      </mesh>
      <Plaque m={m} />
    </group>
  );
}

/** 門外灑進來的天光。信眾從這片亮處走進來 */
function DoorGlow() {
  const texture = useDoorGlowTexture();

  return (
    <mesh position={[0, DOOR_HEIGHT / 2 - 0.1, DOOR_Z - 1.4]}>
      <planeGeometry args={[DOOR_WIDTH * 2.1, DOOR_HEIGHT * 1.5]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

/** 神座上方的匾額。文字靠 canvas 貼圖，不打包中文字型 */
function Plaque({ m }: { m: TempleMaterials }) {
  const texture = usePlaqueTexture('月老');

  return (
    <group position={[0, 5.4, 1.9]}>
      <mesh material={m.gold}>
        <boxGeometry args={[3.6, 1.12, 0.16]} />
      </mesh>
      <mesh position={[0, 0, -0.09]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[3.36, 0.96]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** 神桌與供品桌面：燭台、供果位、桌圍 */
function Altar({ m }: { m: TempleMaterials }) {
  return (
    <group position={[0, 0, ALTAR_Z]}>
      <mesh material={m.wood} position={[0, ALTAR_HEIGHT, 0]}>
        <boxGeometry args={[ALTAR_WIDTH, 0.16, ALTAR_DEPTH]} />
      </mesh>
      {/* 桌圍（紅布），順便遮住桌腳 */}
      <mesh material={m.cloth} position={[0, ALTAR_HEIGHT / 2, -ALTAR_DEPTH / 2]}>
        <boxGeometry args={[ALTAR_WIDTH, ALTAR_HEIGHT, 0.06]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          material={m.wood}
          position={[side * (ALTAR_WIDTH / 2 - 0.3), ALTAR_HEIGHT / 2, 0.4]}
        >
          <boxGeometry args={[0.2, ALTAR_HEIGHT, 0.2]} />
        </mesh>
      ))}

      {/* 兩支蠟燭，是這座廟的主光源 */}
      {[-1, 1].map((side) => (
        <Candle key={side} m={m} position={[side * 1.95, ALTAR_HEIGHT + 0.08, 0]} seed={side} />
      ))}
    </group>
  );
}

function Candle({
  m,
  position,
  seed,
}: {
  m: TempleMaterials;
  position: [number, number, number];
  seed: number;
}) {
  const light = useRef<PointLight>(null);

  useFrame((state) => {
    if (!light.current) return;
    const t = state.clock.elapsedTime;
    // 幾個不同頻率疊起來，燭火才不會像規律呼吸燈
    const flicker =
      Math.sin(t * 9.3 + seed) * 0.06 + Math.sin(t * 21.7 + seed * 2) * 0.035 + Math.sin(t * 3.1) * 0.05;
    light.current.intensity = 14 + flicker * 12;
  });

  return (
    <group position={position}>
      <mesh material={m.bronze}>
        <cylinderGeometry args={[0.16, 0.2, 0.12, 10]} />
      </mesh>
      <mesh material={m.cloth} position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.09, 0.1, 0.8, 10]} />
      </mesh>
      <mesh material={m.flame} position={[0, 0.86, 0]} scale={[1, 1.9, 1]}>
        <sphereGeometry args={[0.042, 8, 8]} />
      </mesh>
      <pointLight
        ref={light}
        position={[0, 0.95, 0]}
        color="#ffc078"
        intensity={14}
        distance={22}
        decay={2}
      />
    </group>
  );
}

/** 香爐：信眾進廟第一站 */
function Censer({ m }: { m: TempleMaterials }) {
  const glow = useRef<PointLight>(null);

  useFrame((state) => {
    if (!glow.current) return;
    glow.current.intensity = 1.6 + Math.sin(state.clock.elapsedTime * 1.7) * 0.35;
  });

  return (
    <group position={[CENSER_POSITION[0], 0, CENSER_POSITION[2]]}>
      {/* 爐台 */}
      <mesh material={m.wood} position={[0, 0.45, 0]}>
        <boxGeometry args={[2.4, 0.9, 1.4]} />
      </mesh>
      {/* 爐身 */}
      <mesh material={m.bronze} position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.75, 0.6, 0.6, 16]} />
      </mesh>
      {/* 爐耳 */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          material={m.bronze}
          position={[side * 0.8, 1.3, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.22, 0.06, 8, 12]} />
        </mesh>
      ))}
      {/* 香灰：一層底 + 飄起來的細灰 */}
      <mesh material={m.ash} position={[0, 1.46, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.68, 16]} />
      </mesh>
      <AshBed position={[0, 1.47, 0]} />
      <IncenseSticks m={m} />
      <pointLight ref={glow} position={[0, 2.1, 0]} color="#ff8a4c" intensity={1.6} distance={5} decay={2} />
    </group>
  );
}

/**
 * 插在爐裡的香，頂端是燒紅的點。
 * 一樣走 instanced——M2 之後信眾每上一炷香就多一根，數量只會增加。
 */
const INCENSE_COUNT = 7;

function IncenseSticks({ m }: { m: TempleMaterials }) {
  const sticks = useRef<InstancedMesh>(null);
  const embers = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const dummy = new Object3D();
    for (let i = 0; i < INCENSE_COUNT; i++) {
      const angle = (i / INCENSE_COUNT) * Math.PI * 2;
      const r = 0.2 + (i % 3) * 0.12;
      const h = 0.7 + (i % 4) * 0.12;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      // 香身的幾何體高度固定 1，用 scale 撐出長短不一
      dummy.position.set(x, 1.5 + h / 2, z);
      dummy.scale.set(1, h, 1);
      dummy.rotation.set(0, 0, (i % 2 === 0 ? 1 : -1) * 0.03);
      dummy.updateMatrix();
      sticks.current?.setMatrixAt(i, dummy.matrix);

      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(x, 1.5 + h, z);
      dummy.updateMatrix();
      embers.current?.setMatrixAt(i, dummy.matrix);
    }
    for (const ref of [sticks, embers]) {
      if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
    }
  }, []);

  return (
    <group>
      <instancedMesh ref={sticks} material={m.wood} args={[undefined, undefined, INCENSE_COUNT]}>
        <cylinderGeometry args={[0.012, 0.012, 1, 4]} />
      </instancedMesh>
      <instancedMesh ref={embers} material={m.ember} args={[undefined, undefined, INCENSE_COUNT]}>
        <sphereGeometry args={[0.028, 6, 6]} />
      </instancedMesh>
    </group>
  );
}

/** 門口兩盞紅燈籠 */
function Lanterns({ m }: { m: TempleMaterials }) {
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 2.6, 4, DOOR_Z + 1.2]}>
          <mesh material={m.wood} position={[0, 0.9, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 1.8, 4]} />
          </mesh>
          <mesh material={m.cloth} scale={[1, 0.85, 1]}>
            <sphereGeometry args={[0.42, 12, 10]} />
          </mesh>
          <pointLight position={[0, 0, 0]} color="#ff6b52" intensity={2.2} distance={7} decay={2} />
        </group>
      ))}
    </group>
  );
}
