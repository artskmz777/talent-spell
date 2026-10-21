import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { FRAMES, SIZES, DPI, pixelSize } from "@/lib/frames";
import { render, loadImage, setJpegDpi, type Crop, type TextAdj, type PhotoGeom } from "@/lib/render";
import { Download, ImagePlus, RotateCcw, Lock, Unlock, AlignCenter, Move } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ทำภาพหน้างานศพ | กรอบรูปพร้อมพิมพ์ 300dpi" },
      { name: "description", content: "สร้างภาพหน้างานศพสำเร็จรูป เลือกกรอบ 10 แบบ ใส่ชื่อ ชาตะ มรณะ อายุ ส่งออกขนาด A4, 10x12, 10x15, 12x18 นิ้ว ความละเอียด 300dpi" },
      { property: "og:title", content: "ทำภาพหน้างานศพ พร้อมพิมพ์ 300dpi" },
      { property: "og:description", content: "เลือกกรอบ ใส่รูปและข้อมูล แล้วบันทึกไฟล์พร้อมพิมพ์" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function Index() {
  const [frameId, setFrameId] = useState(1);
  const [sizeId, setSizeId] = useState("a4");
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [frameImg, setFrameImg] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>({ zoom: 1, ox: 0, oy: 0 });
  const [frameScale, setFrameScale] = useState(1);
  const [textAdj, setTextAdj] = useState<TextAdj>({ scale: 1, ox: 0, oy: 0 });
  const [activeLayer, setActiveLayer] = useState<"photo" | "text">("photo");

  // ค่าเริ่มต้นล็อคตำแหน่งไว้กึ่งกลาง
  const [photoLocked, setPhotoLocked] = useState(true);
  const [textLocked, setTextLocked] = useState(true);
  const [photoLockCenter, setPhotoLockCenter] = useState(false);
  const [textLockCenter, setTextLockCenter] = useState(false);

  const [toast, setToast] = useState<{ text: string; actionText?: string | undefined; onAction?: (() => void) | undefined } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showCrop, setShowCrop] = useState(false);
  const [info, setInfo] = useState({ name: "", born: "", died: "", age: "" });
  const [fontReady, setFontReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scaleRef = useRef(1);
  const geomRef = useRef<PhotoGeom | null>(null);
  const photoRef = useRef<HTMLImageElement | null>(photo);
  photoRef.current = photo;
  const dragRef = useRef<{
    target: "photo" | "text";
    x: number;
    y: number;
    crop: Crop;
    text: TextAdj;
  } | null>(null);

  const cropRef = useRef(crop);
  cropRef.current = crop;
  const textAdjRef = useRef(textAdj);
  textAdjRef.current = textAdj;
  const activeLayerRef = useRef(activeLayer);
  activeLayerRef.current = activeLayer;
  const photoLockedRef = useRef(photoLocked);
  photoLockedRef.current = photoLocked;
  const textLockedRef = useRef(textLocked);
  textLockedRef.current = textLocked;
  const photoLockCenterRef = useRef(photoLockCenter);
  photoLockCenterRef.current = photoLockCenter;
  const textLockCenterRef = useRef(textLockCenter);
  textLockCenterRef.current = textLockCenter;

  const frame = FRAMES.find((f) => f.id === frameId)!;
  const size = SIZES.find((s) => s.id === sizeId)!;
  const px = pixelSize(size);

  const showToast = (text: string, actionText?: string, onAction?: () => void) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ text, actionText, onAction });
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    document.fonts.load("700 40px Sarabun").then(() => document.fonts.load("600 40px Sarabun")).finally(() => setFontReady(true));
  }, []);

  useEffect(() => {
    let live = true;
    setFrameImg(null);
    loadImage(frame.src).then((i) => live && setFrameImg(i));
    return () => { live = false; };
  }, [frame.src]);

  // preview render
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const H = 900;
    const W = Math.round((H * px.w) / px.h);
    c.width = W; c.height = H;
    scaleRef.current = H / px.h;
    const ctx = c.getContext("2d")!;
    geomRef.current = render(ctx, W, H, frame, frameImg, photo, crop, {
      name: info.name || "ชื่อ - นามสกุล", born: info.born || "วัน เดือน ปี", died: info.died || "วัน เดือน ปี", age: info.age,
    }, showCrop, frameScale, textAdj);
  }, [frame, frameImg, photo, crop, info, px.w, px.h, showCrop, fontReady, frameScale, textAdj]);

  // Helper functions for hit testing
  const getCanvasCoord = (e: PointerEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  };

  const isInside = (pt: { x: number; y: number }, box?: { x: number; y: number; w: number; h: number }, pad = 12) => {
    if (!box) return false;
    return pt.x >= box.x - pad && pt.x <= box.x + box.w + pad &&
           pt.y >= box.y - pad && pt.y <= box.y + box.h + pad;
  };

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!photoRef.current) return;
      if (photoLockedRef.current) {
        showToast("🔒 ตำแหน่งรูปภาพถูกล็อคไว้กึ่งกลาง", "ปลดล็อค", () => {
          setPhotoLocked(false);
          photoLockedRef.current = false;
        });
        return;
      }
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      setCrop((p) => ({ ...p, zoom: clamp(p.zoom * Math.exp(-dy * 0.0015), 0.5, 4) }));
    };

    const onDown = (e: PointerEvent) => {
      const g = geomRef.current;
      if (!g) return;
      const pt = getCanvasCoord(e, c);

      // Hit testing: did user click text or photo?
      let target: "photo" | "text" | null = null;
      if (isInside(pt, g.textBox, 14)) {
        target = "text";
      } else if (isInside(pt, g.photoBox, 14)) {
        target = "photo";
      }

      if (!target) return;

      setActiveLayer(target);
      activeLayerRef.current = target;

      // Check lock state
      if (target === "photo") {
        if (!photoRef.current) return;
        if (photoLockedRef.current) {
          showToast("🔒 ตำแหน่งรูปภาพถูกล็อคไว้กึ่งกลาง", "ปลดล็อค", () => {
            setPhotoLocked(false);
            photoLockedRef.current = false;
          });
          return;
        }
      }
      if (target === "text" && textLockedRef.current) {
        showToast("🔒 ตำแหน่งข้อความถูกล็อคไว้กึ่งกลาง", "ปลดล็อค", () => {
          setTextLocked(false);
          textLockedRef.current = false;
        });
        return;
      }

      dragRef.current = {
        target,
        x: e.clientX,
        y: e.clientY,
        crop: { ...cropRef.current },
        text: { ...textAdjRef.current },
      };
      c.setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current, g = geomRef.current;
      if (!d) {
        if (!g) return;
        const pt = getCanvasCoord(e, c);
        if (isInside(pt, g.textBox, 14)) {
          c.style.cursor = textLockedRef.current ? "not-allowed" : "grab";
        } else if (isInside(pt, g.photoBox, 14)) {
          c.style.cursor = !photoRef.current ? "default" : (photoLockedRef.current ? "not-allowed" : "grab");
        } else {
          c.style.cursor = "default";
        }
        return;
      }

      if (!g) return;
      c.style.cursor = "grabbing";
      const rect = c.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const ratio = c.width / rect.width;
      if (d.target === "photo") {
        const nox = d.crop.ox + ((e.clientX - d.x) * ratio) / (g.rw / 2);
        const noy = d.crop.oy + ((e.clientY - d.y) * ratio) / (g.rh / 2);
        setCrop((p) => ({
          ...p,
          ox: photoLockCenterRef.current ? 0 : clamp(nox, -4, 4),
          oy: clamp(noy, -4, 4),
        }));
      } else {
        const nox = d.text.ox + ((e.clientX - d.x) * ratio) / c.width;
        const noy = d.text.oy + ((e.clientY - d.y) * ratio) / c.height;
        setTextAdj((p) => ({
          ...p,
          ox: textLockCenterRef.current ? 0 : clamp(nox, -0.8, 0.8),
          oy: clamp(noy, -0.8, 0.8),
        }));
      }
    };

    const onUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
        c.style.cursor = "default";
      }
    };

    c.addEventListener("wheel", onWheel, { passive: false });
    c.addEventListener("pointerdown", onDown);
    c.addEventListener("pointermove", onMove);
    c.addEventListener("pointerup", onUp);
    c.addEventListener("pointercancel", onUp);
    return () => {
      c.removeEventListener("wheel", onWheel);
      c.removeEventListener("pointerdown", onDown);
      c.removeEventListener("pointermove", onMove);
      c.removeEventListener("pointerup", onUp);
      c.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const onFile = (f?: File) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    loadImage(url).then((i) => {
      setPhoto(i);
      setCrop({ zoom: 1, ox: 0, oy: 0 });
      setPhotoLocked(true);
      photoLockedRef.current = true;
    });
  };

  const centerPhoto = () => {
    setCrop((p) => ({ ...p, ox: 0, oy: 0 }));
    showToast("จัดตำแหน่งรูปภาพไว้กึ่งกลางเรียบร้อย");
  };

  const centerText = () => {
    setTextAdj((p) => ({ ...p, ox: 0, oy: 0 }));
    showToast("จัดตำแหน่งตัวอักษรไว้กึ่งกลางเรียบร้อย");
  };

  const resetAll = () => {
    setCrop({ zoom: 1, ox: 0, oy: 0 });
    setTextAdj({ scale: 1, ox: 0, oy: 0 });
    setFrameScale(1);
    setPhotoLocked(true);
    setTextLocked(true);
    setPhotoLockCenter(false);
    setTextLockCenter(false);
    showToast("รีเซ็ตตำแหน่งกลับสู่กึ่งกลางและล็อคเรียบร้อย");
  };

  const save = async () => {
    if (!frameImg) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 30));
    try {
      const c = document.createElement("canvas");
      c.width = px.w; c.height = px.h;
      render(c.getContext("2d")!, px.w, px.h, frame, frameImg, photo, crop, info, false, frameScale, textAdj);
      const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.95));
      const out = await setJpegDpi(blob, DPI);
      const url = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${info.name.trim() || "ภาพหน้างาน"}_${size.id}_300dpi.jpg`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } finally { setSaving(false); }
  };

  const set = (k: keyof typeof info) => (e: React.ChangeEvent<HTMLInputElement>) => setInfo({ ...info, [k]: e.target.value });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <h1 className="font-display text-2xl font-bold text-primary">ทำภาพหน้างานศพ</h1>
          <p className="text-sm text-muted-foreground">เลือกกรอบ ใส่รูปและข้อมูล แล้วบันทึกเป็นไฟล์พร้อมพิมพ์ 300dpi</p>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[380px_1fr]">
        <aside className="space-y-6">
          <section className="space-y-2">
            <h2 className="font-semibold">1. รูปภาพ</h2>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-card p-4 text-sm hover:border-primary">
              <ImagePlus className="h-5 w-5 text-primary" />
              {photo ? "เปลี่ยนรูป" : "เลือกรูปผู้วายชนม์"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold">2. ข้อมูล</h2>
            <div><Label>ชื่อ</Label><Input value={info.name} onChange={set("name")} placeholder="คุณแม่ กอง จันบัวลา" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ชาตะ</Label><Input value={info.born} onChange={set("born")} placeholder="20 มี.ค. 2494" /></div>
              <div><Label>มรณะ</Label><Input value={info.died} onChange={set("died")} placeholder="1 ต.ค. 2569" /></div>
            </div>
            <div><Label>อายุ (ปี)</Label><Input value={info.age} onChange={set("age")} placeholder="75" inputMode="numeric" /></div>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">3. ขนาดพิมพ์</h2>
            <div className="grid grid-cols-2 gap-2">
              {SIZES.map((s) => (
                <button key={s.id} onClick={() => setSizeId(s.id)}
                  className={`rounded-md border px-3 py-2 text-sm ${s.id === sizeId ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary"}`}>
                  {s.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">ไฟล์ที่ได้ {px.w}×{px.h} พิกเซล</p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">4. กรอบ</h2>
            <div className="grid grid-cols-5 gap-2">
              {FRAMES.map((f) => (
                <button key={f.id} onClick={() => setFrameId(f.id)} title={f.name}
                  className={`overflow-hidden rounded border-2 ${f.id === frameId ? "border-primary ring-2 ring-primary/40" : "border-transparent"}`}>
                  <img src={f.thumb} alt={f.name} width={200} height={300} loading="lazy" className="block w-full" />
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">กรอบ: {frame.name}</p>
          </section>
        </aside>

        <section className="space-y-4">
          {/* Quick Toolbar above Canvas */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">เลเยอร์:</span>
              <div className="flex overflow-hidden rounded-md border border-border">
                <button
                  type="button"
                  onClick={() => setActiveLayer("photo")}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium transition-colors ${
                    activeLayer === "photo" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
                  }`}
                >
                  {photoLocked ? <Lock className="h-3 w-3 text-amber-500" /> : <Unlock className="h-3 w-3 text-emerald-500" />}
                  รูปภาพ
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLayer("text")}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium transition-colors ${
                    activeLayer === "text" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
                  }`}
                >
                  {textLocked ? <Lock className="h-3 w-3 text-amber-500" /> : <Unlock className="h-3 w-3 text-emerald-500" />}
                  ตัวอักษร
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeLayer === "photo" ? (
                <>
                  <Button
                    type="button"
                    variant={photoLocked ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setPhotoLocked(!photoLocked);
                      showToast(photoLocked ? "🔓 ปลดล็อคตำแหน่งรูปภาพแล้ว ลากได้อิสระ" : "🔒 ล็อคตำแหน่งรูปภาพแล้ว");
                    }}
                    className={`h-8 text-xs ${
                      photoLocked
                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                        : "border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                    }`}
                  >
                    {photoLocked ? <Lock className="h-3.5 w-3.5 mr-1" /> : <Unlock className="h-3.5 w-3.5 mr-1" />}
                    {photoLocked ? "ล็อคกึ่งกลาง" : "ปลดล็อค (ลากอิสระ)"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={centerPhoto} className="h-8 text-xs">
                    <AlignCenter className="h-3.5 w-3.5 mr-1" />
                    จัดกึ่งกลาง
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant={textLocked ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setTextLocked(!textLocked);
                      showToast(textLocked ? "🔓 ปลดล็อคตำแหน่งข้อความแล้ว ลากได้อิสระ" : "🔒 ล็อคตำแหน่งข้อความแล้ว");
                    }}
                    className={`h-8 text-xs ${
                      textLocked
                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                        : "border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                    }`}
                  >
                    {textLocked ? <Lock className="h-3.5 w-3.5 mr-1" /> : <Unlock className="h-3.5 w-3.5 mr-1" />}
                    {textLocked ? "ล็อคกึ่งกลาง" : "ปลดล็อค (ลากอิสระ)"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={centerText} className="h-8 text-xs">
                    <AlignCenter className="h-3.5 w-3.5 mr-1" />
                    จัดกึ่งกลาง
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Canvas Wrapper */}
          <div className="relative flex justify-center rounded-xl bg-muted p-4 overflow-hidden select-none">
            {/* Toast overlay */}
            {toast && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full bg-neutral-900/90 text-white px-4 py-2 text-xs md:text-sm shadow-xl backdrop-blur animate-in fade-in slide-in-from-top-2">
                <Lock className="h-4 w-4 text-amber-400 shrink-0" />
                <span>{toast.text}</span>
                {toast.actionText && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.onAction?.();
                      setToast(null);
                    }}
                    className="ml-1 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    {toast.actionText}
                  </button>
                )}
              </div>
            )}

            {/* Floating Status Badges */}
            <div className="absolute top-6 left-6 z-20 flex flex-col sm:flex-row gap-2 pointer-events-auto">
              <button
                type="button"
                onClick={() => {
                  setActiveLayer("photo");
                  const next = !photoLocked;
                  setPhotoLocked(next);
                  showToast(next ? "🔒 ล็อคตำแหน่งรูปภาพแล้ว" : "🔓 ปลดล็อคตำแหน่งรูปภาพแล้ว ลากได้อิสระ");
                }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium shadow-md backdrop-blur transition-all ${
                  photoLocked
                    ? "bg-card/90 text-amber-700 dark:text-amber-300 border border-amber-500/40 hover:bg-card"
                    : "bg-card/90 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 hover:bg-card"
                }`}
                title="คลิกเพื่อล็อค/ปลดล็อครูปภาพ"
              >
                {photoLocked ? <Lock className="h-3.5 w-3.5 text-amber-600" /> : <Unlock className="h-3.5 w-3.5 text-emerald-600" />}
                <span>ภาพ: {photoLocked ? "ล็อคกึ่งกลาง" : "ลากอิสระ"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveLayer("text");
                  const next = !textLocked;
                  setTextLocked(next);
                  showToast(next ? "🔒 ล็อคตำแหน่งข้อความแล้ว" : "🔓 ปลดล็อคตำแหน่งข้อความแล้ว ลากได้อิสระ");
                }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium shadow-md backdrop-blur transition-all ${
                  textLocked
                    ? "bg-card/90 text-amber-700 dark:text-amber-300 border border-amber-500/40 hover:bg-card"
                    : "bg-card/90 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 hover:bg-card"
                }`}
                title="คลิกเพื่อล็อค/ปลดล็อคตัวอักษร"
              >
                {textLocked ? <Lock className="h-3.5 w-3.5 text-amber-600" /> : <Unlock className="h-3.5 w-3.5 text-emerald-600" />}
                <span>ข้อความ: {textLocked ? "ล็อคกึ่งกลาง" : "ลากอิสระ"}</span>
              </button>
            </div>

            <canvas
              ref={canvasRef}
              className="max-h-[75vh] w-auto max-w-full shadow-xl transition-shadow select-none touch-none"
            />
          </div>

          {/* Full Adjustment Controls */}
          <div className="space-y-5 rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <h2 className="font-semibold text-base">ปรับแต่งตำแหน่ง ขนาด และกรอบ</h2>
                <p className="text-xs text-muted-foreground mt-0.5">คลิกบนผืนผ้าใบเพื่อเลือกและลากย้ายตำแหน่งอย่างอิสระ (หรือใช้แถบเลื่อนด้านล่าง)</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <Switch checked={showCrop} onCheckedChange={setShowCrop} id="sc" />
                  <Label htmlFor="sc" className="cursor-pointer text-xs">แสดงเส้นครอป</Label>
                </div>
                <Button variant="ghost" size="sm" onClick={resetAll} className="h-8 text-xs text-muted-foreground hover:text-foreground">
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  รีเซ็ตทั้งหมด
                </Button>
              </div>
            </div>

            {/* Section: Photo Controls */}
            <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm flex items-center gap-1.5">
                    <Move className="h-4 w-4 text-primary" />
                    ตำแหน่งและขนาดรูปภาพ
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${
                    photoLocked ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                  }`}>
                    {photoLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                    {photoLocked ? "ล็อคกึ่งกลาง" : "ปลดล็อค (ลากอิสระ)"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={photoLocked ? "outline" : "default"}
                    size="sm"
                    onClick={() => {
                      const next = !photoLocked;
                      setPhotoLocked(next);
                      showToast(next ? "🔒 ล็อคตำแหน่งรูปภาพแล้ว" : "🔓 ปลดล็อคตำแหน่งรูปภาพแล้ว ลากได้อิสระ");
                    }}
                    className="h-7 text-xs"
                  >
                    {photoLocked ? <Unlock className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                    {photoLocked ? "ปลดล็อคเพื่อย้าย" : "ล็อคตำแหน่ง"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={centerPhoto} className="h-7 text-xs">
                    <AlignCenter className="h-3 w-3 mr-1" />
                    จัดกึ่งกลาง
                  </Button>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none ml-1">
                    <Switch checked={photoLockCenter} onCheckedChange={setPhotoLockCenter} disabled={photoLocked} id="plc" />
                    <Label htmlFor="plc" className="cursor-pointer text-xs">ล็อคแกน X กึ่งกลาง</Label>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-[120px_1fr_84px] items-center gap-3 pt-1">
                <Label className="text-xs">ขนาดรูป (ซูม)</Label>
                <Slider disabled={!photo} min={0.5} max={4} step={0.01} value={[crop.zoom]}
                  onValueChange={([v]) => setCrop((p) => ({ ...p, zoom: v ?? 1 }))} />
                <Input type="number" disabled={!photo} min={0.5} max={4} step={0.01} value={crop.zoom}
                  onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setCrop((p) => ({ ...p, zoom: clamp(v, 0.5, 4) })); }}
                  className="h-7 px-2 text-center text-xs" />
              </div>

              <div className="grid grid-cols-[120px_1fr_84px] items-center gap-3">
                <div className="flex flex-col">
                  <Label className={`text-xs ${photoLocked || photoLockCenter ? "text-muted-foreground" : ""}`}>รูป ซ้าย–ขวา (X)</Label>
                  {photoLockCenter && !photoLocked && <span className="text-[10px] text-amber-600 dark:text-amber-400">ล็อคกึ่งกลาง X</span>}
                </div>
                <Slider disabled={!photo || photoLocked || photoLockCenter} min={-3} max={3} step={0.01} value={[crop.ox]}
                  onValueChange={([v]) => setCrop((p) => ({ ...p, ox: v ?? 0 }))} />
                <Input type="number" disabled={!photo || photoLocked || photoLockCenter} min={-3} max={3} step={0.01} value={Math.round(crop.ox * 100) / 100}
                  onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setCrop((p) => ({ ...p, ox: clamp(v, -3, 3) })); }}
                  className="h-7 px-2 text-center text-xs" />
              </div>

              <div className="grid grid-cols-[120px_1fr_84px] items-center gap-3">
                <Label className={`text-xs ${photoLocked ? "text-muted-foreground" : ""}`}>รูป บน–ล่าง (Y)</Label>
                <Slider disabled={!photo || photoLocked} min={-3} max={3} step={0.01} value={[crop.oy]}
                  onValueChange={([v]) => setCrop((p) => ({ ...p, oy: v ?? 0 }))} />
                <Input type="number" disabled={!photo || photoLocked} min={-3} max={3} step={0.01} value={Math.round(crop.oy * 100) / 100}
                  onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setCrop((p) => ({ ...p, oy: clamp(v, -3, 3) })); }}
                  className="h-7 px-2 text-center text-xs" />
              </div>
            </div>

            {/* Section: Text Controls */}
            <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm flex items-center gap-1.5">
                    <Move className="h-4 w-4 text-primary" />
                    ตำแหน่งและขนาดตัวอักษร
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${
                    textLocked ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                  }`}>
                    {textLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                    {textLocked ? "ล็อคกึ่งกลาง" : "ปลดล็อค (ลากอิสระ)"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={textLocked ? "outline" : "default"}
                    size="sm"
                    onClick={() => {
                      const next = !textLocked;
                      setTextLocked(next);
                      showToast(next ? "🔒 ล็อคตำแหน่งข้อความแล้ว" : "🔓 ปลดล็อคตำแหน่งข้อความแล้ว ลากได้อิสระ");
                    }}
                    className="h-7 text-xs"
                  >
                    {textLocked ? <Unlock className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                    {textLocked ? "ปลดล็อคเพื่อย้าย" : "ล็อคตำแหน่ง"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={centerText} className="h-7 text-xs">
                    <AlignCenter className="h-3 w-3 mr-1" />
                    จัดกึ่งกลาง
                  </Button>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none ml-1">
                    <Switch checked={textLockCenter} onCheckedChange={setTextLockCenter} disabled={textLocked} id="tlc" />
                    <Label htmlFor="tlc" className="cursor-pointer text-xs">ล็อคแกน X กึ่งกลาง</Label>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-[120px_1fr_84px] items-center gap-3 pt-1">
                <Label className="text-xs">ขนาดตัวอักษร</Label>
                <Slider min={0.4} max={2.5} step={0.01} value={[textAdj.scale]}
                  onValueChange={([v]) => setTextAdj((p) => ({ ...p, scale: v ?? 1 }))} />
                <Input type="number" min={0.4} max={2.5} step={0.01} value={textAdj.scale}
                  onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setTextAdj((p) => ({ ...p, scale: clamp(v, 0.4, 2.5) })); }}
                  className="h-7 px-2 text-center text-xs" />
              </div>

              <div className="grid grid-cols-[120px_1fr_84px] items-center gap-3">
                <div className="flex flex-col">
                  <Label className={`text-xs ${textLocked || textLockCenter ? "text-muted-foreground" : ""}`}>อักษร ซ้าย–ขวา (X)</Label>
                  {textLockCenter && !textLocked && <span className="text-[10px] text-amber-600 dark:text-amber-400">ล็อคกึ่งกลาง X</span>}
                </div>
                <Slider disabled={textLocked || textLockCenter} min={-0.8} max={0.8} step={0.005} value={[textAdj.ox]}
                  onValueChange={([v]) => setTextAdj((p) => ({ ...p, ox: v ?? 0 }))} />
                <Input type="number" disabled={textLocked || textLockCenter} min={-0.8} max={0.8} step={0.01} value={Math.round(textAdj.ox * 100) / 100}
                  onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setTextAdj((p) => ({ ...p, ox: clamp(v, -0.8, 0.8) })); }}
                  className="h-7 px-2 text-center text-xs" />
              </div>

              <div className="grid grid-cols-[120px_1fr_84px] items-center gap-3">
                <Label className={`text-xs ${textLocked ? "text-muted-foreground" : ""}`}>อักษร บน–ล่าง (Y)</Label>
                <Slider disabled={textLocked} min={-0.8} max={0.8} step={0.005} value={[textAdj.oy]}
                  onValueChange={([v]) => setTextAdj((p) => ({ ...p, oy: v ?? 0 }))} />
                <Input type="number" disabled={textLocked} min={-0.8} max={0.8} step={0.01} value={Math.round(textAdj.oy * 100) / 100}
                  onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setTextAdj((p) => ({ ...p, oy: clamp(v, -0.8, 0.8) })); }}
                  className="h-7 px-2 text-center text-xs" />
              </div>
            </div>

            {/* Section: Frame Controls */}
            <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
              <span className="font-medium text-sm">ขนาดกรอบรูปภาพ</span>
              <div className="grid grid-cols-[120px_1fr_84px] items-center gap-3">
                <Label className="text-xs">ขนาดกรอบ</Label>
                <Slider min={0.6} max={1.15} step={0.005} value={[frameScale]}
                  onValueChange={([v]) => setFrameScale(v ?? 1)} />
                <Input type="number" min={0.6} max={1.15} step={0.01} value={Math.round(frameScale * 100) / 100}
                  onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setFrameScale(clamp(v, 0.6, 1.15)); }}
                  className="h-7 px-2 text-center text-xs" />
              </div>
            </div>
          </div>

          <Button size="lg" className="w-full text-base font-semibold py-6 shadow-md" onClick={save} disabled={saving || !frameImg}>
            <Download className="h-5 w-5 mr-2" />{saving ? "กำลังสร้างไฟล์พร้อมพิมพ์…" : `บันทึกไฟล์พร้อมพิมพ์ (${size.label}, 300dpi)`}
          </Button>
        </section>
      </div>
    </main>
  );
}
