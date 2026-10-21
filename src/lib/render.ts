import type { FrameDef } from "./frames";

export type Crop = { zoom: number; ox: number; oy: number };
export type Info = { name: string; born: string; died: string; age: string };
export type TextAdj = { scale: number; ox: number; oy: number };
export type RectBox = { x: number; y: number; w: number; h: number };
export type PhotoGeom = {
  rw: number;
  rh: number;
  dw: number;
  dh: number;
  photoBox: RectBox;
  textBox: RectBox;
};

const STRETCH: [number, number][] = [[400, 440], [840, 880]];

/** Maps base x (0..1280) to output x. Height scales uniformly; extra width goes into two plain strips. */
function mapper(W: number, H: number) {
  const s = H / 1920;
  const extra = W - 1280 * s;
  const X = (x: number) => {
    let v = x * s;
    for (const [a, b] of STRETCH) if (x > a) v += (Math.min(x - a, b - a) / (b - a)) * (extra / 2);
    return v;
  };
  return { s, X };
}

export function render(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  frame: FrameDef,
  frameImg: HTMLImageElement | null,
  photo: HTMLImageElement | null,
  crop: Crop,
  info: Info,
  showCrop = false,
  frameScale = 1,
  text: TextAdj = { scale: 1, ox: 0, oy: 0 },
): PhotoGeom | null {
  const { s, X } = mapper(W, H);
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  // frame scale applies ONLY to the frame artwork — photo and text stay locked
  const sx = (v: number) => W / 2 + (v - W / 2) * frameScale;
  const sy = (v: number) => H / 2 + (v - H / 2) * frameScale;
  const [x0, y0, x1, y1] = frame.photo;
  const rx = X(x0), ry = y0 * s, rw = X(x1) - X(x0), rh = (y1 - y0) * s;
  let draw: [number, number, number, number] | null = null;
  if (photo) {
    const c = Math.max(rw / photo.naturalWidth, rh / photo.naturalHeight) * crop.zoom;
    const dw = photo.naturalWidth * c, dh = photo.naturalHeight * c;
    // ox/oy shift the photo centre across the window — free movement at any zoom
    const dx = rx + rw / 2 - dw / 2 + crop.ox * (rw / 2);
    const dy = ry + rh / 2 - dh / 2 + crop.oy * (rh / 2);
    draw = [dx, dy, dw, dh];
    ctx.save();
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    ctx.clip();
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(photo, dx, dy, dw, dh);
    ctx.restore();
  }
  if (frameImg) {
    const cols = [0, 400, 440, 840, 880, 1280];
    for (let i = 0; i < cols.length - 1; i++) {
      const a = cols[i]!, b = cols[i + 1]!;
      ctx.drawImage(frameImg, a, 0, b - a, 1920, sx(X(a)), sy(0), (X(b) - X(a)) * frameScale + 0.5, H * frameScale);
    }
  }
  // Text — freely adjustable: scale multiplies all font sizes, ox/oy shift the whole block
  const [t0, t1] = frame.text;
  const ty = t0 * s + text.oy * H, th = (t1 - t0) * s, cx = W / 2 + text.ox * W;
  const ts = text.scale;
  const maxW = Math.max(10, rw * 0.92 * ts);
  ctx.fillStyle = "#1f1b16";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fit = (txt: string, size: number, weight: number) => {
    let f = size;
    ctx.font = `${weight} ${f}px Sarabun, sans-serif`;
    while (ctx.measureText(txt).width > maxW && f > 8) {
      f *= 0.95;
      ctx.font = `${weight} ${f}px Sarabun, sans-serif`;
    }
  };
  const hasAge = info.age.trim() !== "";
  // rows = [name, age, born, died] — age sits centred below the death line
  const rows: [number, number, number, number] = hasAge ? [0.15, 0.91, 0.6, 0.755] : [0.25, 0, 0.6, 0.85];
  if (info.name.trim()) {
    fit(info.name, th * 0.2 * ts, 700);
    ctx.fillText(info.name, cx, ty + th * rows[0]);
  }
  const fs = th * 0.11 * ts;
  const line = (label: string, val: string, y: number) => {
    ctx.font = `600 ${fs}px Sarabun, sans-serif`;
    ctx.textAlign = "left";
    const left = cx - fs * 5.2;
    ctx.fillText(label, left, y);
    ctx.fillText(":", cx - fs * 2.2, y);
    ctx.font = `700 ${fs}px Sarabun, sans-serif`;
    const vx = cx - fs * 1.4;
    ctx.fillText(val, vx, y);
    ctx.textAlign = "center";
    return { left, right: vx + ctx.measureText(val).width };
  };
  line("ชาตะ", info.born, ty + th * rows[2]);
  const diedBox = line("มรณะ", info.died, ty + th * rows[3]);
  const ageCx = (diedBox.left + diedBox.right) / 2;
  if (hasAge) {
    fit(`สิริอายุ ${info.age} ปี`, th * 0.11 * ts, 600);
    ctx.fillText(`สิริอายุ ${info.age} ปี`, ageCx, ty + th * rows[1]);
  }

  if (showCrop && photo && draw) {
    ctx.globalAlpha = 0.3;
    ctx.drawImage(photo, ...draw);
    ctx.globalAlpha = 1;
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#e11d48";
    ctx.strokeRect(rx, ry, rw, rh);
  }
  ctx.restore();

  const geom: PhotoGeom = {
    rw,
    rh,
    dw: draw ? draw[2] : rw,
    dh: draw ? draw[3] : rh,
    photoBox: { x: rx, y: ry, w: rw, h: rh },
    textBox: { x: cx - maxW / 2, y: ty, w: maxW, h: th },
  };
  return geom;
}

/** Writes 300 DPI into a canvas JPEG's JFIF header. */
export async function setJpegDpi(blob: Blob, dpi: number): Promise<Blob> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  if (buf[2] === 0xff && buf[3] === 0xe0 && buf[6] === 0x4a && buf[7] === 0x46) {
    buf[13] = 1;
    buf[14] = dpi >> 8; buf[15] = dpi & 255;
    buf[16] = dpi >> 8; buf[17] = dpi & 255;
  }
  return new Blob([buf], { type: "image/jpeg" });
}

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}
