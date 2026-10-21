import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { FRAMES, SIZES, DPI, pixelSize } from "@/lib/frames";
import {
  render,
  loadImage,
  setJpegDpi,
  DEFAULT_TEXT_ADJ,
  type Crop,
  type TextAdj,
  type PhotoGeom,
} from "@/lib/render";
import {
  Download,
  ImagePlus,
  RotateCcw,
  Lock,
  Unlock,
  AlignCenter,
  Move,
  User,
  Calendar,
  Clock,
  Sparkles,
} from "lucide-react";

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

type LayerType = "photo" | "name" | "dates" | "age";

function Index() {
  const [frameId, setFrameId] = useState(1);
  const [sizeId, setSizeId] = useState("a4");
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [frameImg, setFrameImg] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>({ zoom: 1, ox: 0, oy: 0 });
  const [frameScale, setFrameScale] = useState(1);

  // ตัวอักษรแยกอิสระ 3 ส่วน: ชื่อ / ชาตะ-มรณะ / อายุ
  const [textAdj, setTextAdj] = useState<TextAdj>(DEFAULT_TEXT_ADJ);

  const [activeLayer, setActiveLayer] = useState<LayerType>("photo");

  // ค่าเริ่มต้นล็อคตำแหน่งไว้กึ่งกลางสำหรับทุกส่วน
  const [photoLocked, setPhotoLocked] = useState(true);
  const [nameLocked, setNameLocked] = useState(true);
  const [datesLocked, setDatesLocked] = useState(true);
  const [ageLocked, setAgeLocked] = useState(true);

  // ล็อคแกน X กึ่งกลาง (ลากเฉพาะแนวตั้ง)
  const [photoLockCenter, setPhotoLockCenter] = useState(false);
  const [nameLockCenter, setNameLockCenter] = useState(false);
  const [datesLockCenter, setDatesLockCenter] = useState(false);
  const [ageLockCenter, setAgeLockCenter] = useState(false);

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
    target: LayerType;
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
  const nameLockedRef = useRef(nameLocked);
  nameLockedRef.current = nameLocked;
  const datesLockedRef = useRef(datesLocked);
  datesLockedRef.current = datesLocked;
  const ageLockedRef = useRef(ageLocked);
  ageLockedRef.current = ageLocked;

  const photoLockCenterRef = useRef(photoLockCenter);
  photoLockCenterRef.current = photoLockCenter;
  const nameLockCenterRef = useRef(nameLockCenter);
  nameLockCenterRef.current = nameLockCenter;
  const datesLockCenterRef = useRef(datesLockCenter);
  datesLockCenterRef.current = datesLockCenter;
  const ageLockCenterRef = useRef(ageLockCenter);
  ageLockCenterRef.current = ageLockCenter;

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
      name: info.name || "ชื่อ - นามสกุล",
      born: info.born || "วัน เดือน ปี",
      died: info.died || "วัน เดือน ปี",
      age: info.age,
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

  const isInside = (pt: { x: number; y: number }, box?: { x: number; y: number; w: number; h: number }, pad = 10) => {
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

      // Hit testing: ตรวจสอบว่าคลิกส่วนไหน 1.ชื่อ 2.ชาตะ-มรณะ 3.อายุ 4.รูปภาพ
      let target: LayerType | null = null;
      if (isInside(pt, g.nameBox, 8)) {
        target = "name";
      } else if (isInside(pt, g.datesBox, 8)) {
        target = "dates";
      } else if (isInside(pt, g.ageBox, 8)) {
        target = "age";
      } else if (isInside(pt, g.photoBox, 8)) {
        target = "photo";
      }

      if (!target) return;

      setActiveLayer(target);
      activeLayerRef.current = target;

      // ตรวจสอบสถานะล็อคของส่วนนั้นๆ
      if (target === "photo") {
        if (!photoRef.current) return;
        if (photoLockedRef.current) {
          showToast("🔒 ตำแหน่งรูปภาพถูกล็อคไว้กึ่งกลาง", "ปลดล็อค", () => {
            setPhotoLocked(false);
            photoLockedRef.current = false;
          });
          return;
        }
      } else if (target === "name") {
        if (nameLockedRef.current) {
          showToast("🔒 ตำแหน่งชื่อถูกล็อคไว้กึ่งกลาง", "ปลดล็อค", () => {
            setNameLocked(false);
            nameLockedRef.current = false;
          });
          return;
        }
      } else if (target === "dates") {
        if (datesLockedRef.current) {
          showToast("🔒 ตำแหน่งชาตะ-มรณะถูกล็อคไว้กึ่งกลาง", "ปลดล็อค", () => {
            setDatesLocked(false);
            datesLockedRef.current = false;
          });
          return;
        }
      } else if (target === "age") {
        if (ageLockedRef.current) {
          showToast("🔒 ตำแหน่งสิริอายุถูกล็อคไว้กึ่งกลาง", "ปลดล็อค", () => {
            setAgeLocked(false);
            ageLockedRef.current = false;
          });
          return;
        }
      }

      dragRef.current = {
        target,
        x: e.clientX,
        y: e.clientY,
        crop: { ...cropRef.current },
        text: {
          name: { ...textAdjRef.current.name },
          dates: { ...textAdjRef.current.dates },
          age: { ...textAdjRef.current.age },
        },
      };
      c.setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current, g = geomRef.current;
      if (!d) {
        if (!g) return;
        const pt = getCanvasCoord(e, c);
        if (isInside(pt, g.nameBox, 8)) {
          c.style.cursor = nameLockedRef.current ? "not-allowed" : "grab";
        } else if (isInside(pt, g.datesBox, 8)) {
          c.style.cursor = datesLockedRef.current ? "not-allowed" : "grab";
        } else if (isInside(pt, g.ageBox, 8)) {
          c.style.cursor = ageLockedRef.current ? "not-allowed" : "grab";
        } else if (isInside(pt, g.photoBox, 8)) {
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
      } else if (d.target === "name") {
        const nox = d.text.name.ox + ((e.clientX - d.x) * ratio) / c.width;
        const noy = d.text.name.oy + ((e.clientY - d.y) * ratio) / c.height;
        setTextAdj((p) => ({
          ...p,
          name: {
            ...p.name,
            ox: nameLockCenterRef.current ? 0 : clamp(nox, -0.8, 0.8),
            oy: clamp(noy, -0.8, 0.8),
          },
        }));
      } else if (d.target === "dates") {
        const nox = d.text.dates.ox + ((e.clientX - d.x) * ratio) / c.width;
        const noy = d.text.dates.oy + ((e.clientY - d.y) * ratio) / c.height;
        setTextAdj((p) => ({
          ...p,
          dates: {
            ...p.dates,
            ox: datesLockCenterRef.current ? 0 : clamp(nox, -0.8, 0.8),
            oy: clamp(noy, -0.8, 0.8),
          },
        }));
      } else if (d.target === "age") {
        const nox = d.text.age.ox + ((e.clientX - d.x) * ratio) / c.width;
        const noy = d.text.age.oy + ((e.clientY - d.y) * ratio) / c.height;
        setTextAdj((p) => ({
          ...p,
          age: {
            ...p.age,
            ox: ageLockCenterRef.current ? 0 : clamp(nox, -0.8, 0.8),
            oy: clamp(noy, -0.8, 0.8),
          },
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

  // จัดกึ่งกลางแต่ละส่วน
  const centerPhoto = () => {
    setCrop((p) => ({ ...p, ox: 0, oy: 0 }));
    showToast("จัดตำแหน่งรูปภาพไว้กึ่งกลางเรียบร้อย");
  };

  const centerName = () => {
    setTextAdj((p) => ({ ...p, name: { ...p.name, ox: 0, oy: 0 } }));
    showToast("จัดตำแหน่งชื่อไว้กึ่งกลางเรียบร้อย");
  };

  const centerDates = () => {
    setTextAdj((p) => ({ ...p, dates: { ...p.dates, ox: 0, oy: 0 } }));
    showToast("จัดตำแหน่งชาตะ-มรณะไว้กึ่งกลางเรียบร้อย");
  };

  const centerAge = () => {
    setTextAdj((p) => ({ ...p, age: { ...p.age, ox: 0, oy: 0 } }));
    showToast("จัดตำแหน่งสิริอายุไว้กึ่งกลางเรียบร้อย");
  };

  const resetAll = () => {
    setCrop({ zoom: 1, ox: 0, oy: 0 });
    setTextAdj(DEFAULT_TEXT_ADJ);
    setFrameScale(1);

    setPhotoLocked(true);
    setNameLocked(true);
    setDatesLocked(true);
    setAgeLocked(true);

    setPhotoLockCenter(false);
    setNameLockCenter(false);
    setDatesLockCenter(false);
    setAgeLockCenter(false);

    showToast("รีเซ็ตทุกตำแหน่งกลับสู่กึ่งกลางและล็อคเรียบร้อย");
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

  // ข้อมูล active layer สำหรับแถบควบคุมด้านบน
  const getActiveLayerInfo = () => {
    switch (activeLayer) {
      case "photo":
        return {
          title: "รูปภาพ",
          locked: photoLocked,
          toggleLock: () => {
            const next = !photoLocked;
            setPhotoLocked(next);
            showToast(next ? "🔒 ล็อคตำแหน่งรูปภาพแล้ว" : "🔓 ปลดล็อคตำแหน่งรูปภาพแล้ว ลากได้อิสระ");
          },
          center: centerPhoto,
          lockCenter: photoLockCenter,
          setLockCenter: setPhotoLockCenter,
        };
      case "name":
        return {
          title: "ชื่อ",
          locked: nameLocked,
          toggleLock: () => {
            const next = !nameLocked;
            setNameLocked(next);
            showToast(next ? "🔒 ล็อคตำแหน่งชื่อแล้ว" : "🔓 ปลดล็อคตำแหน่งชื่อแล้ว ลากได้อิสระ");
          },
          center: centerName,
          lockCenter: nameLockCenter,
          setLockCenter: setNameLockCenter,
        };
      case "dates":
        return {
          title: "ชาตะ-มรณะ",
          locked: datesLocked,
          toggleLock: () => {
            const next = !datesLocked;
            setDatesLocked(next);
            showToast(next ? "🔒 ล็อคตำแหน่งชาตะ-มรณะแล้ว" : "🔓 ปลดล็อคตำแหน่งชาตะ-มรณะแล้ว ลากได้อิสระ");
          },
          center: centerDates,
          lockCenter: datesLockCenter,
          setLockCenter: setDatesLockCenter,
        };
      case "age":
        return {
          title: "สิริอายุ",
          locked: ageLocked,
          toggleLock: () => {
            const next = !ageLocked;
            setAgeLocked(next);
            showToast(next ? "🔒 ล็อคตำแหน่งสิริอายุแล้ว" : "🔓 ปลดล็อคตำแหน่งสิริอายุแล้ว ลากได้อิสระ");
          },
          center: centerAge,
          lockCenter: ageLockCenter,
          setLockCenter: setAgeLockCenter,
        };
    }
  };

  const curLayer = getActiveLayerInfo();

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
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground mr-1">เลือกส่วนที่จะปรับ:</span>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setActiveLayer("photo")}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
                    activeLayer === "photo"
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/50 border-transparent hover:bg-muted"
                  }`}
                >
                  {photoLocked ? <Lock className="h-3 w-3 text-amber-500" /> : <Unlock className="h-3 w-3 text-emerald-500" />}
                  รูปภาพ
                </button>

                <button
                  type="button"
                  onClick={() => setActiveLayer("name")}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
                    activeLayer === "name"
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/50 border-transparent hover:bg-muted"
                  }`}
                >
                  {nameLocked ? <Lock className="h-3 w-3 text-amber-500" /> : <Unlock className="h-3 w-3 text-emerald-500" />}
                  ชื่อ
                </button>

                <button
                  type="button"
                  onClick={() => setActiveLayer("dates")}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
                    activeLayer === "dates"
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/50 border-transparent hover:bg-muted"
                  }`}
                >
                  {datesLocked ? <Lock className="h-3 w-3 text-amber-500" /> : <Unlock className="h-3 w-3 text-emerald-500" />}
                  ชาตะ-มรณะ
                </button>

                <button
                  type="button"
                  onClick={() => setActiveLayer("age")}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border transition-all ${
                    activeLayer === "age"
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/50 border-transparent hover:bg-muted"
                  }`}
                >
                  {ageLocked ? <Lock className="h-3 w-3 text-amber-500" /> : <Unlock className="h-3 w-3 text-emerald-500" />}
                  สิริอายุ
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={curLayer.locked ? "default" : "outline"}
                size="sm"
                onClick={curLayer.toggleLock}
                className={`h-8 text-xs ${
                  curLayer.locked
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                }`}
              >
                {curLayer.locked ? <Lock className="h-3.5 w-3.5 mr-1" /> : <Unlock className="h-3.5 w-3.5 mr-1" />}
                {curLayer.locked ? `ล็อค (${curLayer.title})` : `ปลดล็อค (${curLayer.title})`}
              </Button>

              <Button type="button" variant="outline" size="sm" onClick={curLayer.center} className="h-8 text-xs">
                <AlignCenter className="h-3.5 w-3.5 mr-1" />
                จัดกึ่งกลาง
              </Button>
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

            {/* Floating Status Badges for all 4 parts */}
            <div className="absolute top-6 left-6 z-20 flex flex-wrap gap-1.5 pointer-events-auto max-w-[85%]">
              <button
                type="button"
                onClick={() => {
                  setActiveLayer("photo");
                  const next = !photoLocked;
                  setPhotoLocked(next);
                  showToast(next ? "🔒 ล็อคตำแหน่งรูปภาพแล้ว" : "🔓 ปลดล็อคตำแหน่งรูปภาพแล้ว ลากได้อิสระ");
                }}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium shadow-md backdrop-blur transition-all ${
                  photoLocked
                    ? "bg-card/90 text-amber-700 dark:text-amber-300 border border-amber-500/40 hover:bg-card"
                    : "bg-card/90 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 hover:bg-card"
                }`}
                title="คลิกเพื่อสลับล็อครูปภาพ"
              >
                {photoLocked ? <Lock className="h-3 w-3 text-amber-600" /> : <Unlock className="h-3 w-3 text-emerald-600" />}
                <span>ภาพ: {photoLocked ? "ล็อค" : "อิสระ"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveLayer("name");
                  const next = !nameLocked;
                  setNameLocked(next);
                  showToast(next ? "🔒 ล็อคตำแหน่งชื่อแล้ว" : "🔓 ปลดล็อคตำแหน่งชื่อแล้ว ลากได้อิสระ");
                }}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium shadow-md backdrop-blur transition-all ${
                  nameLocked
                    ? "bg-card/90 text-amber-700 dark:text-amber-300 border border-amber-500/40 hover:bg-card"
                    : "bg-card/90 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 hover:bg-card"
                }`}
                title="คลิกเพื่อสลับล็อคชื่อ"
              >
                {nameLocked ? <Lock className="h-3 w-3 text-amber-600" /> : <Unlock className="h-3 w-3 text-emerald-600" />}
                <span>ชื่อ: {nameLocked ? "ล็อค" : "อิสระ"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveLayer("dates");
                  const next = !datesLocked;
                  setDatesLocked(next);
                  showToast(next ? "🔒 ล็อคตำแหน่งชาตะ-มรณะแล้ว" : "🔓 ปลดล็อคตำแหน่งชาตะ-มรณะแล้ว ลากได้อิสระ");
                }}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium shadow-md backdrop-blur transition-all ${
                  datesLocked
                    ? "bg-card/90 text-amber-700 dark:text-amber-300 border border-amber-500/40 hover:bg-card"
                    : "bg-card/90 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 hover:bg-card"
                }`}
                title="คลิกเพื่อสลับล็อคชาตะ-มรณะ"
              >
                {datesLocked ? <Lock className="h-3 w-3 text-amber-600" /> : <Unlock className="h-3 w-3 text-emerald-600" />}
                <span>ชาตะ-มรณะ: {datesLocked ? "ล็อค" : "อิสระ"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveLayer("age");
                  const next = !ageLocked;
                  setAgeLocked(next);
                  showToast(next ? "🔒 ล็อคตำแหน่งสิริอายุแล้ว" : "🔓 ปลดล็อคตำแหน่งสิริอายุแล้ว ลากได้อิสระ");
                }}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium shadow-md backdrop-blur transition-all ${
                  ageLocked
                    ? "bg-card/90 text-amber-700 dark:text-amber-300 border border-amber-500/40 hover:bg-card"
                    : "bg-card/90 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 hover:bg-card"
                }`}
                title="คลิกเพื่อสลับล็อคสิริอายุ"
              >
                {ageLocked ? <Lock className="h-3 w-3 text-amber-600" /> : <Unlock className="h-3 w-3 text-emerald-600" />}
                <span>อายุ: {ageLocked ? "ล็อค" : "อิสระ"}</span>
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
                <h2 className="font-semibold text-base">ปรับแต่งแยกอิสระ (รูป / ชื่อ / ชาตะ-มรณะ / อายุ)</h2>
                <p className="text-xs text-muted-foreground mt-0.5">คลิกบนผืนผ้าใบหรือใช้แถบเลื่อนด้านล่างเพื่อปรับตำแหน่งและขนาดของแต่ละส่วนแยกขาดจากกัน</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <Switch checked={showCrop} onCheckedChange={setShowCrop} id="sc" />
                  <Label htmlFor="sc" className="cursor-pointer text-xs">แสดงกรอบตำแหน่ง</Label>
                </div>
                <Button variant="ghost" size="sm" onClick={resetAll} className="h-8 text-xs text-muted-foreground hover:text-foreground">
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  รีเซ็ตทั้งหมด
                </Button>
              </div>
            </div>

            {/* Segmented Layer Tabs for detailed adjustment */}
            <div className="flex flex-wrap gap-1 p-1 bg-muted rounded-lg border border-border text-xs">
              <button
                type="button"
                onClick={() => setActiveLayer("photo")}
                className={`flex-1 min-w-[100px] py-2 px-3 rounded-md font-medium text-center transition-all ${
                  activeLayer === "photo" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                🖼️ รูปภาพ
              </button>
              <button
                type="button"
                onClick={() => setActiveLayer("name")}
                className={`flex-1 min-w-[100px] py-2 px-3 rounded-md font-medium text-center transition-all ${
                  activeLayer === "name" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                👤 1. ชื่อผู้วายชนม์
              </button>
              <button
                type="button"
                onClick={() => setActiveLayer("dates")}
                className={`flex-1 min-w-[100px] py-2 px-3 rounded-md font-medium text-center transition-all ${
                  activeLayer === "dates" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                📅 2. ชาตะ - มรณะ
              </button>
              <button
                type="button"
                onClick={() => setActiveLayer("age")}
                className={`flex-1 min-w-[100px] py-2 px-3 rounded-md font-medium text-center transition-all ${
                  activeLayer === "age" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                ⏳ 3. สิริอายุ
              </button>
            </div>

            {/* Section: Photo Controls */}
            {activeLayer === "photo" && (
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
                      <Label htmlFor="plc" className="cursor-pointer text-xs">ล็อคแกน X</Label>
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
            )}

            {/* Section: Name Controls */}
            {activeLayer === "name" && (
              <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                      <User className="h-4 w-4" />
                      ส่วนที่ 1: ชื่อผู้วายชนม์
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${
                      nameLocked ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                    }`}>
                      {nameLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                      {nameLocked ? "ล็อคกึ่งกลาง" : "ปลดล็อค (ลากอิสระ)"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={nameLocked ? "outline" : "default"}
                      size="sm"
                      onClick={() => {
                        const next = !nameLocked;
                        setNameLocked(next);
                        showToast(next ? "🔒 ล็อคตำแหน่งชื่อแล้ว" : "🔓 ปลดล็อคตำแหน่งชื่อแล้ว ลากได้อิสระ");
                      }}
                      className="h-7 text-xs"
                    >
                      {nameLocked ? <Unlock className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                      {nameLocked ? "ปลดล็อคเพื่อย้าย" : "ล็อคตำแหน่ง"}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={centerName} className="h-7 text-xs">
                      <AlignCenter className="h-3 w-3 mr-1" />
                      จัดกึ่งกลาง
                    </Button>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none ml-1">
                      <Switch checked={nameLockCenter} onCheckedChange={setNameLockCenter} disabled={nameLocked} id="nlc" />
                      <Label htmlFor="nlc" className="cursor-pointer text-xs">ล็อคแกน X</Label>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-[120px_1fr_84px] items-center gap-3 pt-1">
                  <Label className="text-xs">ขนาดตัวอักษรชื่อ</Label>
                  <Slider min={0.4} max={2.5} step={0.01} value={[textAdj.name.scale]}
                    onValueChange={([v]) => setTextAdj((p) => ({ ...p, name: { ...p.name, scale: v ?? 1 } }))} />
                  <Input type="number" min={0.4} max={2.5} step={0.01} value={textAdj.name.scale}
                    onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setTextAdj((p) => ({ ...p, name: { ...p.name, scale: clamp(v, 0.4, 2.5) } })); }}
                    className="h-7 px-2 text-center text-xs" />
                </div>

                <div className="grid grid-cols-[120px_1fr_84px] items-center gap-3">
                  <div className="flex flex-col">
                    <Label className={`text-xs ${nameLocked || nameLockCenter ? "text-muted-foreground" : ""}`}>ชื่อ ซ้าย–ขวา (X)</Label>
                    {nameLockCenter && !nameLocked && <span className="text-[10px] text-amber-600 dark:text-amber-400">ล็อคกึ่งกลาง X</span>}
                  </div>
                  <Slider disabled={nameLocked || nameLockCenter} min={-0.8} max={0.8} step={0.005} value={[textAdj.name.ox]}
                    onValueChange={([v]) => setTextAdj((p) => ({ ...p, name: { ...p.name, ox: v ?? 0 } }))} />
                  <Input type="number" disabled={nameLocked || nameLockCenter} min={-0.8} max={0.8} step={0.01} value={Math.round(textAdj.name.ox * 100) / 100}
                    onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setTextAdj((p) => ({ ...p, name: { ...p.name, ox: clamp(v, -0.8, 0.8) } })); }}
                    className="h-7 px-2 text-center text-xs" />
                </div>

                <div className="grid grid-cols-[120px_1fr_84px] items-center gap-3">
                  <Label className={`text-xs ${nameLocked ? "text-muted-foreground" : ""}`}>ชื่อ บน–ล่าง (Y)</Label>
                  <Slider disabled={nameLocked} min={-0.8} max={0.8} step={0.005} value={[textAdj.name.oy]}
                    onValueChange={([v]) => setTextAdj((p) => ({ ...p, name: { ...p.name, oy: v ?? 0 } }))} />
                  <Input type="number" disabled={nameLocked} min={-0.8} max={0.8} step={0.01} value={Math.round(textAdj.name.oy * 100) / 100}
                    onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setTextAdj((p) => ({ ...p, name: { ...p.name, oy: clamp(v, -0.8, 0.8) } })); }}
                    className="h-7 px-2 text-center text-xs" />
                </div>
              </div>
            )}

            {/* Section: Dates Controls */}
            {activeLayer === "dates" && (
              <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <Calendar className="h-4 w-4" />
                      ส่วนที่ 2: วันที่ชาตะ - มรณะ
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${
                      datesLocked ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                    }`}>
                      {datesLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                      {datesLocked ? "ล็อคกึ่งกลาง" : "ปลดล็อค (ลากอิสระ)"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={datesLocked ? "outline" : "default"}
                      size="sm"
                      onClick={() => {
                        const next = !datesLocked;
                        setDatesLocked(next);
                        showToast(next ? "🔒 ล็อคตำแหน่งชาตะ-มรณะแล้ว" : "🔓 ปลดล็อคตำแหน่งชาตะ-มรณะแล้ว ลากได้อิสระ");
                      }}
                      className="h-7 text-xs"
                    >
                      {datesLocked ? <Unlock className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                      {datesLocked ? "ปลดล็อคเพื่อย้าย" : "ล็อคตำแหน่ง"}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={centerDates} className="h-7 text-xs">
                      <AlignCenter className="h-3 w-3 mr-1" />
                      จัดกึ่งกลาง
                    </Button>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none ml-1">
                      <Switch checked={datesLockCenter} onCheckedChange={setDatesLockCenter} disabled={datesLocked} id="dlc" />
                      <Label htmlFor="dlc" className="cursor-pointer text-xs">ล็อคแกน X</Label>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-[120px_1fr_84px] items-center gap-3 pt-1">
                  <Label className="text-xs">ขนาดตัวอักษรชาตะ-มรณะ</Label>
                  <Slider min={0.4} max={2.5} step={0.01} value={[textAdj.dates.scale]}
                    onValueChange={([v]) => setTextAdj((p) => ({ ...p, dates: { ...p.dates, scale: v ?? 1 } }))} />
                  <Input type="number" min={0.4} max={2.5} step={0.01} value={textAdj.dates.scale}
                    onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setTextAdj((p) => ({ ...p, dates: { ...p.dates, scale: clamp(v, 0.4, 2.5) } })); }}
                    className="h-7 px-2 text-center text-xs" />
                </div>

                <div className="grid grid-cols-[120px_1fr_84px] items-center gap-3">
                  <div className="flex flex-col">
                    <Label className={`text-xs ${datesLocked || datesLockCenter ? "text-muted-foreground" : ""}`}>ชาตะ-มรณะ ซ้าย–ขวา (X)</Label>
                    {datesLockCenter && !datesLocked && <span className="text-[10px] text-amber-600 dark:text-amber-400">ล็อคกึ่งกลาง X</span>}
                  </div>
                  <Slider disabled={datesLocked || datesLockCenter} min={-0.8} max={0.8} step={0.005} value={[textAdj.dates.ox]}
                    onValueChange={([v]) => setTextAdj((p) => ({ ...p, dates: { ...p.dates, ox: v ?? 0 } }))} />
                  <Input type="number" disabled={datesLocked || datesLockCenter} min={-0.8} max={0.8} step={0.01} value={Math.round(textAdj.dates.ox * 100) / 100}
                    onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setTextAdj((p) => ({ ...p, dates: { ...p.dates, ox: clamp(v, -0.8, 0.8) } })); }}
                    className="h-7 px-2 text-center text-xs" />
                </div>

                <div className="grid grid-cols-[120px_1fr_84px] items-center gap-3">
                  <Label className={`text-xs ${datesLocked ? "text-muted-foreground" : ""}`}>ชาตะ-มรณะ บน–ล่าง (Y)</Label>
                  <Slider disabled={datesLocked} min={-0.8} max={0.8} step={0.005} value={[textAdj.dates.oy]}
                    onValueChange={([v]) => setTextAdj((p) => ({ ...p, dates: { ...p.dates, oy: v ?? 0 } }))} />
                  <Input type="number" disabled={datesLocked} min={-0.8} max={0.8} step={0.01} value={Math.round(textAdj.dates.oy * 100) / 100}
                    onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setTextAdj((p) => ({ ...p, dates: { ...p.dates, oy: clamp(v, -0.8, 0.8) } })); }}
                    className="h-7 px-2 text-center text-xs" />
                </div>
              </div>
            )}

            {/* Section: Age Controls */}
            {activeLayer === "age" && (
              <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                      <Clock className="h-4 w-4" />
                      ส่วนที่ 3: สิริอายุ
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${
                      ageLocked ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                    }`}>
                      {ageLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                      {ageLocked ? "ล็อคกึ่งกลาง" : "ปลดล็อค (ลากอิสระ)"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={ageLocked ? "outline" : "default"}
                      size="sm"
                      onClick={() => {
                        const next = !ageLocked;
                        setAgeLocked(next);
                        showToast(next ? "🔒 ล็อคตำแหน่งสิริอายุแล้ว" : "🔓 ปลดล็อคตำแหน่งสิริอายุแล้ว ลากได้อิสระ");
                      }}
                      className="h-7 text-xs"
                    >
                      {ageLocked ? <Unlock className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                      {ageLocked ? "ปลดล็อคเพื่อย้าย" : "ล็อคตำแหน่ง"}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={centerAge} className="h-7 text-xs">
                      <AlignCenter className="h-3 w-3 mr-1" />
                      จัดกึ่งกลาง
                    </Button>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none ml-1">
                      <Switch checked={ageLockCenter} onCheckedChange={setAgeLockCenter} disabled={ageLocked} id="alc" />
                      <Label htmlFor="alc" className="cursor-pointer text-xs">ล็อคแกน X</Label>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-[120px_1fr_84px] items-center gap-3 pt-1">
                  <Label className="text-xs">ขนาดตัวอักษรอายุ</Label>
                  <Slider min={0.4} max={2.5} step={0.01} value={[textAdj.age.scale]}
                    onValueChange={([v]) => setTextAdj((p) => ({ ...p, age: { ...p.age, scale: v ?? 1 } }))} />
                  <Input type="number" min={0.4} max={2.5} step={0.01} value={textAdj.age.scale}
                    onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setTextAdj((p) => ({ ...p, age: { ...p.age, scale: clamp(v, 0.4, 2.5) } })); }}
                    className="h-7 px-2 text-center text-xs" />
                </div>

                <div className="grid grid-cols-[120px_1fr_84px] items-center gap-3">
                  <div className="flex flex-col">
                    <Label className={`text-xs ${ageLocked || ageLockCenter ? "text-muted-foreground" : ""}`}>อายุ ซ้าย–ขวา (X)</Label>
                    {ageLockCenter && !ageLocked && <span className="text-[10px] text-amber-600 dark:text-amber-400">ล็อคกึ่งกลาง X</span>}
                  </div>
                  <Slider disabled={ageLocked || ageLockCenter} min={-0.8} max={0.8} step={0.005} value={[textAdj.age.ox]}
                    onValueChange={([v]) => setTextAdj((p) => ({ ...p, age: { ...p.age, ox: v ?? 0 } }))} />
                  <Input type="number" disabled={ageLocked || ageLockCenter} min={-0.8} max={0.8} step={0.01} value={Math.round(textAdj.age.ox * 100) / 100}
                    onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setTextAdj((p) => ({ ...p, age: { ...p.age, ox: clamp(v, -0.8, 0.8) } })); }}
                    className="h-7 px-2 text-center text-xs" />
                </div>

                <div className="grid grid-cols-[120px_1fr_84px] items-center gap-3">
                  <Label className={`text-xs ${ageLocked ? "text-muted-foreground" : ""}`}>อายุ บน–ล่าง (Y)</Label>
                  <Slider disabled={ageLocked} min={-0.8} max={0.8} step={0.005} value={[textAdj.age.oy]}
                    onValueChange={([v]) => setTextAdj((p) => ({ ...p, age: { ...p.age, oy: v ?? 0 } }))} />
                  <Input type="number" disabled={ageLocked} min={-0.8} max={0.8} step={0.01} value={Math.round(textAdj.age.oy * 100) / 100}
                    onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setTextAdj((p) => ({ ...p, age: { ...p.age, oy: clamp(v, -0.8, 0.8) } })); }}
                    className="h-7 px-2 text-center text-xs" />
                </div>
              </div>
            )}

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
