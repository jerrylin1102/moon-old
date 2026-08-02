import { useMemo } from 'react';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

function makeCanvas(size: number) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

/** 柔邊圓點：香煙粒子用，免得粒子看起來像方形碎紙 */
export function useSoftDotTexture() {
  return useMemo(() => {
    const size = 64;
    const canvas = makeCanvas(size);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.28)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
    return new CanvasTexture(canvas);
  }, []);
}

/** 紅線配對成功的愛心粒子貼圖：兩個圓疊一個倒三角，純 canvas 2D path 畫出愛心輪廓 */
export function useHeartTexture() {
  return useMemo(() => {
    const size = 64;
    const canvas = makeCanvas(size);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const s = size;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(s * 0.5, s * 0.82);
      ctx.bezierCurveTo(s * 0.1, s * 0.55, s * 0.08, s * 0.18, s * 0.5, s * 0.32);
      ctx.bezierCurveTo(s * 0.92, s * 0.18, s * 0.9, s * 0.55, s * 0.5, s * 0.82);
      ctx.closePath();
      ctx.fill();
    }
    return new CanvasTexture(canvas);
  }, []);
}

/**
 * 門外天光：中央亮、邊緣散掉的橢圓光暈。
 * 用純色平面會像一塊投影布，加上漸層才像光灑進門。
 */
export function useDoorGlowTexture() {
  return useMemo(() => {
    const size = 256;
    const canvas = makeCanvas(size);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(size / 2, size * 0.58, 0, size / 2, size * 0.58, size / 2);
      g.addColorStop(0, 'rgba(255,240,214,1)');
      g.addColorStop(0.45, 'rgba(240,208,158,0.72)');
      g.addColorStop(0.8, 'rgba(190,150,110,0.18)');
      g.addColorStop(1, 'rgba(120,90,70,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, []);
}

/**
 * 廟埕石磚：灰石底色 + 深色縫線格紋，repeat 鋪滿整片廣場地板，
 * 才不會跟殿內木地板一樣是同一塊純色，看起來像室外的石板地。
 */
export function useCourtyardTexture() {
  return useMemo(() => {
    const size = 128;
    const canvas = makeCanvas(size);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#5f5b57';
      ctx.fillRect(0, 0, size, size);
      // 不規則深淺塊面，模擬石板風化痕跡
      for (let i = 0; i < 22; i++) {
        const shade = 20 + ((i * 37) % 30);
        ctx.fillStyle = `rgba(${shade},${shade - 4},${shade - 8},0.35)`;
        const w = 14 + ((i * 17) % 20);
        const h = 10 + ((i * 23) % 16);
        ctx.fillRect((i * 53) % size, (i * 31) % size, w, h);
      }
      ctx.strokeStyle = 'rgba(20,16,14,0.55)';
      ctx.lineWidth = 2;
      const cell = size / 4;
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cell, 0);
        ctx.lineTo(i * cell, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cell);
        ctx.lineTo(size, i * cell);
        ctx.stroke();
      }
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(6, 4);
    return texture;
  }, []);
}

/**
 * 大門外的遠景：黃昏天空漸層 + 一輪月（呼應月老）+ 遠山剪影。
 * 用一張畫布貼圖取代原本純平面色塊，門洞外才有「真的有場景」的縱深感。
 */
export function useDuskSkyTexture() {
  return useMemo(() => {
    const w = 512;
    const h = 320;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#241533');
      sky.addColorStop(0.45, '#5a3049');
      sky.addColorStop(0.75, '#c8683f');
      sky.addColorStop(1, '#f2a24f');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // 月亮：暈光 + 實體圓
      const moonX = w * 0.68;
      const moonY = h * 0.32;
      const glow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 90);
      glow.addColorStop(0, 'rgba(255,244,214,0.55)');
      glow.addColorStop(1, 'rgba(255,244,214,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff6e0';
      ctx.beginPath();
      ctx.arc(moonX, moonY, 30, 0, Math.PI * 2);
      ctx.fill();

      // 遠山剪影，深淺兩層拉出景深
      const ridge = (baseY: number, amp: number, color: string) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(0, baseY);
        for (let x = 0; x <= w; x += 32) {
          const y = baseY - Math.sin(x * 0.008 + baseY) * amp - ((x * 53) % 17);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
      };
      ridge(h * 0.78, 22, 'rgba(40,24,34,0.55)');
      ridge(h * 0.88, 16, 'rgba(20,12,18,0.85)');
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, []);
}
