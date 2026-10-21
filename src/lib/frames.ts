import f1 from "@/assets/frames/frame1.png";
import f2 from "@/assets/frames/frame2.png";
import f3 from "@/assets/frames/frame3.png";
import f4 from "@/assets/frames/frame4.png";
import f5 from "@/assets/frames/frame5.png";
import f6 from "@/assets/frames/frame6.png";
import f7 from "@/assets/frames/frame7.png";
import f8 from "@/assets/frames/frame8.png";
import f9 from "@/assets/frames/frame9.png";
import f10 from "@/assets/frames/frame10.png";
import t1 from "@/assets/frames/thumb1.jpg";
import t2 from "@/assets/frames/thumb2.jpg";
import t3 from "@/assets/frames/thumb3.jpg";
import t4 from "@/assets/frames/thumb4.jpg";
import t5 from "@/assets/frames/thumb5.jpg";
import t6 from "@/assets/frames/thumb6.jpg";
import t7 from "@/assets/frames/thumb7.jpg";
import t8 from "@/assets/frames/thumb8.jpg";
import t9 from "@/assets/frames/thumb9.jpg";
import t10 from "@/assets/frames/thumb10.jpg";

/** All coordinates are in the 1280x1920 base frame space. */
export type FrameDef = {
  id: number;
  name: string;
  src: string;
  thumb: string;
  photo: [number, number, number, number];
  text: [number, number];
};

export const FRAMES: FrameDef[] = [
  { id: 1, name: "ทองคลาสสิก", src: f1, thumb: t1, photo: [128, 133, 1147, 1350], text: [1420, 1800] },
  { id: 2, name: "ดำขลิบทอง", src: f2, thumb: t2, photo: [152, 182, 1130, 1435], text: [1560, 1820] },
  { id: 3, name: "เงินลายไทย", src: f3, thumb: t3, photo: [132, 150, 1150, 1405], text: [1490, 1800] },
  { id: 4, name: "บัวทอง", src: f4, thumb: t4, photo: [138, 140, 1142, 1405], text: [1480, 1770] },
  { id: 5, name: "ม่วงกำมะหยี่", src: f5, thumb: t5, photo: [92, 100, 1188, 1410], text: [1440, 1780] },
  { id: 6, name: "กนกทอง", src: f6, thumb: t6, photo: [130, 165, 1150, 1325], text: [1470, 1730] },
  { id: 7, name: "มะลิขาว", src: f7, thumb: t7, photo: [225, 145, 1058, 1385], text: [1430, 1790] },
  { id: 8, name: "ไม้แกะสลัก", src: f8, thumb: t8, photo: [140, 140, 1142, 1405], text: [1420, 1760] },
  { id: 9, name: "โรสโกลด์", src: f9, thumb: t9, photo: [62, 62, 1218, 1418], text: [1450, 1810] },
  { id: 10, name: "ขาวดำลายไทย", src: f10, thumb: t10, photo: [90, 95, 1192, 1382], text: [1400, 1780] },
];

export type PrintSize = { id: string; label: string; w: number; h: number };
export const SIZES: PrintSize[] = [
  { id: "a4", label: "A4 (8.27×11.69 นิ้ว)", w: 8.27, h: 11.69 },
  { id: "10x12", label: "10×12 นิ้ว", w: 10, h: 12 },
  { id: "10x15", label: "10×15 นิ้ว", w: 10, h: 15 },
  { id: "12x18", label: "12×18 นิ้ว", w: 12, h: 18 },
];
export const DPI = 300;
export const pixelSize = (s: PrintSize) => ({ w: Math.round(s.w * DPI), h: Math.round(s.h * DPI) });
