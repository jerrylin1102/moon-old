import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, PerspectiveCamera } from 'three';
import { THRONE_POSITION } from './layout';
import { useInteraction } from '../interactionStore';
import { useGame } from '../gameStore';
import { swayAmount } from '../sim/fatigue';

/** 你是神像。能轉頭，不能走動。 */
const MAX_YAW = MathUtils.degToRad(60);
const MAX_PITCH = MathUtils.degToRad(38);
/** 觸控拖移靈敏度：每 px 轉多少弧度 */
const TOUCH_SENSITIVITY = 0.0045;
/**
 * 鎖定「水平」視野角度。three 的 fov 是垂直的，直式手機一套用就把橫向視野砍半，
 * 跪在兩側的信眾會整排跑出畫面。所以改成固定水平 fov，垂直的由長寬比算回來。
 */
const HORIZONTAL_FOV = MathUtils.degToRad(82);
/** 垂直 fov 的上限，免得極端長條螢幕拉出魚眼 */
const MAX_VERTICAL_FOV = 95;
/** 轉頭阻尼，越大越跟手 */
const DAMPING = 7;
/**
 * 畫面中央的死區。滑鼠同時要負責環視與點信眾，
 * 沒有死區的話：游標往信眾移動 → 鏡頭跟著轉 → 信眾跑掉，永遠點不到。
 * 中央 34% 不轉頭，靠近邊緣才開始轉，而且是漸進的。
 */
const DEAD_ZONE = 0.34;

function deadZone(n: number): number {
  const magnitude = Math.abs(n);
  if (magnitude <= DEAD_ZONE) return 0;
  return Math.sign(n) * ((magnitude - DEAD_ZONE) / (1 - DEAD_ZONE));
}

export function DeityCamera() {
  const camera = useThree((s) => s.camera);
  const domElement = useThree((s) => s.gl.domElement);
  const size = useThree((s) => s.size);

  const look = useRef({ yaw: 0, pitch: 0, targetYaw: 0, targetPitch: 0 });
  const drag = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });

  useEffect(() => {
    camera.position.set(...THRONE_POSITION);
    camera.rotation.order = 'YXZ';
  }, [camera]);

  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const aspect = size.width / size.height;
    const vertical = 2 * Math.atan(Math.tan(HORIZONTAL_FOV / 2) / aspect);
    camera.fov = Math.min(MAX_VERTICAL_FOV, MathUtils.radToDeg(vertical));
    camera.updateProjectionMatrix();
  }, [camera, size]);

  // dev 專用：讓自動化驗證能把視線固定在指定方向，不受殘留的滑鼠位置影響
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __moonLook?: (yaw: number, pitch: number) => void };
    w.__moonLook = (yaw, pitch) => {
      look.current.targetYaw = MathUtils.clamp(yaw, -MAX_YAW, MAX_YAW);
      look.current.targetPitch = MathUtils.clamp(pitch, -MAX_PITCH, MAX_PITCH);
    };
    return () => {
      delete w.__moonLook;
    };
  }, []);

  useEffect(() => {
    const clampTargets = () => {
      look.current.targetYaw = MathUtils.clamp(look.current.targetYaw, -MAX_YAW, MAX_YAW);
      look.current.targetPitch = MathUtils.clamp(look.current.targetPitch, -MAX_PITCH, MAX_PITCH);
    };

    // 桌機：滑鼠位置直接對映視線方向
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        // 正在從信眾身上拉紅線時，這個拖曳屬於紅線，不是轉頭
        if (useInteraction.getState().threadFrom) return;
        if (!drag.current.active) return;
        look.current.targetYaw -= (e.clientX - drag.current.x) * TOUCH_SENSITIVITY;
        look.current.targetPitch -= (e.clientY - drag.current.y) * TOUCH_SENSITIVITY;
        drag.current.x = e.clientX;
        drag.current.y = e.clientY;
      } else {
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = (e.clientY / window.innerHeight) * 2 - 1;
        look.current.targetYaw = -deadZone(nx) * MAX_YAW;
        look.current.targetPitch = -deadZone(ny) * MAX_PITCH;
      }
      clampTargets();
    };

    // 手機：單指拖移轉頭
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      drag.current = { active: true, x: e.clientX, y: e.clientY };
    };
    const onPointerUp = () => {
      drag.current.active = false;
    };

    domElement.addEventListener('pointermove', onPointerMove);
    domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      domElement.removeEventListener('pointermove', onPointerMove);
      domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [domElement]);

  useFrame((state, dt) => {
    const l = look.current;
    l.yaw = MathUtils.damp(l.yaw, l.targetYaw, DAMPING, dt);
    l.pitch = MathUtils.damp(l.pitch, l.targetPitch, DAMPING, dt);

    // 神明的呼吸：極輕微的自動擺動，避免畫面像截圖一樣死。
    // 疲勞越高晃得越明顯——神明也會頭暈
    const t = state.clock.elapsedTime;
    const game = useGame.getState().state;
    const sway = game ? swayAmount(game) : 0.004;
    camera.rotation.y = l.yaw + Math.sin(t * 0.27) * sway;
    camera.rotation.x = l.pitch + Math.sin(t * 0.41) * sway * 0.75;
  });

  return null;
}
