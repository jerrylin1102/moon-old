import { useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';

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
