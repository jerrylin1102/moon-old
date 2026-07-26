import { useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';

/**
 * 匾額文字用 canvas 2D 畫出來再貼上去。
 *
 * 為什麼不用 drei 的 <Text>：troika 需要一個真正的字型檔，
 * 而中文字型動輒 5–10MB，打包進 bundle 不值得。改用 canvas 借系統的中文字型，
 * 零資產、離線可用，代價只是文字不能在 3D 空間裡自由排版——匾額不需要。
 */
export function usePlaqueTexture(text: string) {
  return useMemo(() => {
    const width = 512;
    const height = 160;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#2b0d0c';
      ctx.fillRect(0, 0, width, height);

      // 金色邊框
      ctx.strokeStyle = '#e6b455';
      ctx.lineWidth = 8;
      ctx.strokeRect(10, 10, width - 20, height - 20);

      ctx.fillStyle = '#f0cd77';
      ctx.font = '700 96px "Noto Serif TC", "Songti TC", "PMingLiU", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, width / 2, height / 2 + 4);
    }

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, [text]);
}
