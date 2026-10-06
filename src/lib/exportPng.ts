/**
 * Premium: renders a statistics snapshot (title, summary numbers and both
 * series) onto a canvas and downloads it as a PNG. Drawn by hand so it works
 * on every platform without a DOM-screenshot dependency.
 */
export interface ExportPayload {
  title: string;
  periodLabel: string;
  summaries: { label: string; value: string }[];
  points: { label: string; a: number; b: number }[];
  seriesNames: [string, string];
}

export function exportStatsPng(payload: ExportPayload): void {
  const w = 1000;
  const h = 640;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#F49AC1");
  grad.addColorStop(0.55, "#F8D7E8");
  grad.addColorStop(1, "#FFF5FA");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  roundRect(ctx, 40, 40, w - 80, h - 80, 24);
  ctx.fill();

  ctx.fillStyle = "#3D1B2E";
  ctx.font = "600 34px -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText(payload.title, 80, 110);
  ctx.fillStyle = "#94637F";
  ctx.font = "400 22px -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText(payload.periodLabel, 80, 146);

  let x = 80;
  ctx.font = "600 20px -apple-system, 'Segoe UI', sans-serif";
  for (const s of payload.summaries) {
    const label = `${s.label}: ${s.value}`;
    const width = ctx.measureText(label).width + 32;
    ctx.fillStyle = "rgba(236,111,160,0.14)";
    roundRect(ctx, x, 170, width, 42, 21);
    ctx.fill();
    ctx.fillStyle = "#3D1B2E";
    ctx.fillText(label, x + 16, 197);
    x += width + 14;
  }

  const px = 80;
  const py = 250;
  const pw = w - 160;
  const ph = h - 380;
  const values = payload.points.flatMap((p) => [p.a, p.b]);
  const max = Math.max(1, ...values) * 1.15;
  const step = payload.points.length > 1 ? pw / (payload.points.length - 1) : pw;

  ctx.strokeStyle = "rgba(61,27,46,0.12)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const y = py + (ph / 4) * i;
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(px + pw, y);
    ctx.stroke();
  }

  const drawLine = (get: (p: ExportPayload["points"][number]) => number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    payload.points.forEach((p, i) => {
      const vx = px + step * i;
      const vy = py + ph - (get(p) / max) * ph;
      if (i === 0) ctx.moveTo(vx, vy);
      else ctx.lineTo(vx, vy);
    });
    ctx.stroke();
  };
  drawLine((p) => p.a, "#EC6FA0");
  drawLine((p) => p.b, "#96687E");

  ctx.font = "400 20px -apple-system, 'Segoe UI', sans-serif";
  ctx.fillStyle = "#EC6FA0";
  roundRect(ctx, px, py + ph + 26, 18, 18, 5);
  ctx.fill();
  ctx.fillStyle = "#3D1B2E";
  ctx.fillText(payload.seriesNames[0], px + 28, py + ph + 41);
  const off = px + 28 + ctx.measureText(payload.seriesNames[0]).width + 36;
  ctx.fillStyle = "#96687E";
  roundRect(ctx, off, py + ph + 26, 18, 18, 5);
  ctx.fill();
  ctx.fillStyle = "#3D1B2E";
  ctx.fillText(payload.seriesNames[1], off + 28, py + ph + 41);

  ctx.fillStyle = "#94637F";
  ctx.font = "400 18px -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText("Action & Quality", 80, h - 60);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "action-quality-stats.png";
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
