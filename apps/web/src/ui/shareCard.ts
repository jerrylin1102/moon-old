import type { Diary } from '../content/diary';

/**
 * 把日記畫成一張可以直接發出去的圖。
 * 純 canvas，沒有外部字型與素材——離線也能匯出。
 */
const W = 1080;
const H = 1350;
const MARGIN = 96;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  // 中文沒有空格可斷，逐字量寬度最準
  for (const ch of text) {
    const next = line + ch;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function drawShareCard(diary: Diary): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const serif = '"Noto Serif TC", "Songti TC", "PMingLiU", serif';
  const sans = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';

  // 背景：廟裡的暖暗色，中間帶一點香火的光
  ctx.fillStyle = '#140a0b';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.32, 0, W / 2, H * 0.32, W * 0.75);
  glow.addColorStop(0, 'rgba(217,164,65,0.20)');
  glow.addColorStop(1, 'rgba(20,10,11,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(217,164,65,0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(MARGIN / 2, MARGIN / 2, W - MARGIN, H - MARGIN);

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(242,226,196,0.55)';
  ctx.font = `28px ${sans}`;
  ctx.fillText('月　老　值　班　中', W / 2, MARGIN + 40);

  ctx.fillStyle = '#f0cd77';
  ctx.font = `bold 88px ${serif}`;
  ctx.fillText(diary.title, W / 2, MARGIN + 170);

  ctx.fillStyle = 'rgba(242,226,196,0.85)';
  ctx.font = `34px ${sans}`;
  let y = MARGIN + 250;
  for (const line of wrap(ctx, diary.verdict, W - MARGIN * 2.2)) {
    ctx.fillText(line, W / 2, y);
    y += 52;
  }

  // 統計：兩欄
  y += 40;
  ctx.textAlign = 'left';
  const colX = [MARGIN + 40, W / 2 + 40];
  diary.stats.forEach((s, i) => {
    const x = colX[i % 2] as number;
    const rowY = y + Math.floor(i / 2) * 92;
    ctx.fillStyle = 'rgba(242,226,196,0.45)';
    ctx.font = `26px ${sans}`;
    ctx.fillText(s.label, x, rowY);
    ctx.fillStyle = '#f2e2c4';
    ctx.font = `52px ${serif}`;
    ctx.fillText(s.value, x, rowY + 52);
  });
  y += Math.ceil(diary.stats.length / 2) * 92 + 30;

  // 今日最扯的願望
  if (diary.highlight) {
    ctx.strokeStyle = 'rgba(217,164,65,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(MARGIN + 40, y);
    ctx.lineTo(W - MARGIN - 40, y);
    ctx.stroke();
    y += 60;

    ctx.fillStyle = 'rgba(217,164,65,0.7)';
    ctx.font = `26px ${sans}`;
    ctx.fillText('今日最扯', MARGIN + 40, y);
    y += 56;

    ctx.fillStyle = '#f2e2c4';
    ctx.font = `38px ${serif}`;
    for (const line of wrap(ctx, `「${diary.highlight.text}」`, W - MARGIN * 2 - 80)) {
      ctx.fillText(line, MARGIN + 40, y);
      y += 56;
    }
    ctx.fillStyle = 'rgba(242,226,196,0.5)';
    ctx.font = `30px ${sans}`;
    ctx.fillText(diary.highlight.note, MARGIN + 40, y + 12);
    y += 70;
  }

  // 一則香客留言
  const review = diary.reviews[0];
  if (review) {
    ctx.fillStyle = review.stars === 5 ? 'rgba(127,174,109,0.9)' : 'rgba(201,65,75,0.9)';
    ctx.font = `30px ${sans}`;
    ctx.fillText('★'.repeat(review.stars), MARGIN + 40, y + 20);
    ctx.fillStyle = 'rgba(242,226,196,0.75)';
    ctx.font = `30px ${sans}`;
    let ry = y + 70;
    for (const line of wrap(ctx, review.text, W - MARGIN * 2 - 80)) {
      ctx.fillText(line, MARGIN + 40, ry);
      ry += 44;
    }
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(242,226,196,0.35)';
  ctx.font = `26px ${sans}`;
  ctx.fillText('換你來當一天月老', W / 2, H - MARGIN - 10);

  return canvas;
}

export function downloadShareCard(diary: Diary): void {
  const canvas = drawShareCard(diary);
  const link = document.createElement('a');
  link.download = `月老值班中-${diary.title}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
