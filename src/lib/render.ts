import type { FrameDef } from "./frames";

export type Crop = { zoom: number; ox: number; oy: number };
export type Info = { name: string; born: string; died: string; age: string };
export type TextPartAdj = { scale: number; ox: number; oy: number };
export type TextAdj = {
  name: TextPartAdj;
  dates: TextPartAdj;
  age: TextPartAdj;
};
export type RectBox = { x: number; y: number; w: number; h: number };
export type PhotoGeom = {
  rw: number;
  rh: number;
  dw: number;
  dh: number;
  photoBox: RectBox;
  nameBox: RectBox;
  datesBox: RectBox;
  ageBox: RectBox;
  textBox: RectBox;
};

export const DEFAULT_TEXT_ADJ: TextAdj = {
  name: { scale: 1, ox: 0, oy: 0 },
  dates: { scale: 1, ox: 0, oy: 0 },
  age: { scale: 1, ox: 0, oy: 0 },
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
  text: TextAdj = DEFAULT_TEXT_ADJ,
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

  // Text — 3 independent parts: 1. Name (ชื่อ), 2. Dates (ชาตะ-มรณะ), 3. Age (อายุ)
  const [t0, t1] = frame.text;
  const baseTy = t0 * s;
  const th = (t1 - t0) * s;
  const baseCx = W / 2;
  const hasAge = info.age.trim() !== "";

  ctx.fillStyle = "#1f1b16";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // --- Part 1: ชื่อ (Name) ---
  const nameTs = text.name.scale;
  const nameCx = baseCx + text.name.ox * W;
  const nameY = baseTy + th * (hasAge ? 0.15 : 0.25) + text.name.oy * H;
  const nameMaxW = Math.max(10, rw * 0.92 * nameTs);

  const fitName = (txt: string, size: number, weight: number) => {
    let f = size;
    ctx.font = `${weight} ${f}px Sarabun, sans-serif`;
    while (ctx.measureText(txt).width > nameMaxW && f > 8) {
      f *= 0.95;
      ctx.font = `${weight} ${f}px Sarabun, sans-serif`;
    }
    return f;
  };

  let nameFs = th * 0.2 * nameTs;
  let measuredNameW = nameMaxW * 0.6;
  if (info.name.trim()) {
    nameFs = fitName(info.name, th * 0.2 * nameTs, 700);
    measuredNameW = Math.max(nameFs * 3, ctx.measureText(info.name).width);
    ctx.fillText(info.name, nameCx, nameY);
  }
  const nameBox: RectBox = {
    x: nameCx - measuredNameW / 2 - 12,
    y: nameY - nameFs * 0.8,
    w: measuredNameW + 24,
    h: nameFs * 1.6,
  };

  // --- Part 2: ชาตะ - มรณะ (Born - Died Dates) ---
  const datesTs = text.dates.scale;
  const datesCx = baseCx + text.dates.ox * W;
  const datesOy = text.dates.oy * H;
  const datesFs = th * 0.11 * datesTs;
  const bornY = baseTy + th * (hasAge ? 0.6 : 0.6) + datesOy;
  const diedY = baseTy + th * (hasAge ? 0.755 : 0.85) + datesOy;

  const line = (label: string, val: string, y: number, cx: number, fs: number) => {
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

  const bornBox = line("ชาตะ", info.born, bornY, datesCx, datesFs);
  const diedBox = line("มรณะ", info.died, diedY, datesCx, datesFs);
  const datesMinX = Math.min(bornBox.left, diedBox.left) - 10;
  const datesMaxX = Math.max(bornBox.right, diedBox.right) + 10;
  const datesBox: RectBox = {
    x: datesMinX,
    y: bornY - datesFs * 0.9,
    w: Math.max(datesFs * 8, datesMaxX - datesMinX),
    h: diedY - bornY + datesFs * 1.8,
  };

  // --- Part 3: สิริอายุ (Age) ---
  // Default centered under the death line, plus its own independent ox / oy
  const defaultAgeCx = (diedBox.left + diedBox.right) / 2;
  const ageCx = defaultAgeCx + text.age.ox * W;
  const ageY = baseTy + th * 0.91 + text.age.oy * H;
  const ageTs = text.age.scale;
  const ageFs = th * 0.11 * ageTs;
  const ageMaxW = Math.max(10, rw * 0.92 * ageTs);

  const fitAge = (txt: string, size: number, weight: number) => {
    let f = size;
    ctx.font = `${weight} ${f}px Sarabun, sans-serif`;
    while (ctx.measureText(txt).width > ageMaxW && f > 8) {
      f *= 0.95;
      ctx.font = `${weight} ${f}px Sarabun, sans-serif`;
    }
    return f;
  };

  let measuredAgeW = ageFs * 5;
  if (hasAge) {
    const ageTxt = `สิริอายุ ${info.age} ปี`;
    const actualAgeFs = fitAge(ageTxt, ageFs, 600);
    measuredAgeW = Math.max(actualAgeFs * 3, ctx.measureText(ageTxt).width);
    ctx.fillText(ageTxt, ageCx, ageY);
  }
  const ageBox: RectBox = {
    x: ageCx - measuredAgeW / 2 - 12,
    y: ageY - ageFs * 0.8,
    w: measuredAgeW + 24,
    h: ageFs * 1.6,
  };

  // Overall text bounding box
  const tMinX = Math.min(nameBox.x, datesBox.x, hasAge ? ageBox.x : Infinity);
  const tMaxX = Math.max(nameBox.x + nameBox.w, datesBox.x + datesBox.w, hasAge ? ageBox.x + ageBox.w : -Infinity);
  const tMinY = Math.min(nameBox.y, datesBox.y);
  const tMaxY = Math.max(datesBox.y + datesBox.h, hasAge ? ageBox.y + ageBox.h : datesBox.y + datesBox.h);
  const textBox: RectBox = {
    x: tMinX,
    y: tMinY,
    w: tMaxX - tMinX,
    h: tMaxY - tMinY,
  };

  if (showCrop && photo && draw) {
    ctx.globalAlpha = 0.3;
    ctx.drawImage(photo, ...draw);
    ctx.globalAlpha = 1;
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#e11d48";
    ctx.strokeRect(rx, ry, rw, rh);
  }

  if (showCrop) {
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;

    // Name outline (blue)
    ctx.strokeStyle = "#3b82f6";
    ctx.strokeRect(nameBox.x, nameBox.y, nameBox.w, nameBox.h);

    // Dates outline (emerald)
    ctx.strokeStyle = "#10b981";
    ctx.strokeRect(datesBox.x, datesBox.y, datesBox.w, datesBox.h);

    // Age outline (amber)
    if (hasAge) {
      ctx.strokeStyle = "#f59e0b";
      ctx.strokeRect(ageBox.x, ageBox.y, ageBox.w, ageBox.h);
    }
    ctx.restore();
  }
  ctx.restore();

  const geom: PhotoGeom = {
    rw,
    rh,
    dw: draw ? draw[2] : rw,
    dh: draw ? draw[3] : rh,
    photoBox: { x: rx, y: ry, w: rw, h: rh },
    nameBox,
    datesBox,
    ageBox,
    textBox,
  };
  return geom;
}

/** Writes 300 DPI into a canvas JPEG's JFIF header. Ensures APP0 segment is present even if omitted by browser. */
export async function setJpegDpi(blob: Blob, dpi: number): Promise<Blob> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return blob; // Not a JPEG

  // If already has APP0 JFIF header
  if (buf[2] === 0xff && buf[3] === 0xe0 && buf[6] === 0x4a && buf[7] === 0x46) {
    buf[13] = 1; // 1 = dots per inch (DPI)
    buf[14] = dpi >> 8; buf[15] = dpi & 255;
    buf[16] = dpi >> 8; buf[17] = dpi & 255;
    return new Blob([buf], { type: "image/jpeg" });
  }

  // If no APP0 JFIF segment, insert standard 18-byte JFIF APP0 segment right after SOI (FF D8)
  const jfif = new Uint8Array([
    0xff, 0xe0, // APP0 marker
    0x00, 0x10, // length = 16
    0x4a, 0x46, 0x49, 0x46, 0x00, // 'JFIF\0'
    0x01, 0x01, // version 1.1
    0x01,       // units: 1 = dots per inch
    dpi >> 8, dpi & 255, // X density
    dpi >> 8, dpi & 255, // Y density
    0x00, 0x00  // thumbnail width, height
  ]);

  const newBuf = new Uint8Array(buf.length + jfif.length);
  newBuf.set(buf.subarray(0, 2), 0); // FF D8
  newBuf.set(jfif, 2);               // JFIF segment
  newBuf.set(buf.subarray(2), 2 + jfif.length); // rest of JPEG stream
  return new Blob([newBuf], { type: "image/jpeg" });
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
