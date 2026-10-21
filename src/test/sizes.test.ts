import { describe, expect, it } from "vitest";
import { SIZES, DPI, pixelSize } from "../lib/frames";
import { setJpegDpi } from "../lib/render";

describe("Print Sizes and DPI verification", () => {
  it("verifies 12x18 in is exactly 3600x5400 pixels at 300 DPI", () => {
    const size12x18 = SIZES.find((s) => s.id === "12x18");
    expect(size12x18).toBeDefined();
    expect(size12x18?.w).toBe(12);
    expect(size12x18?.h).toBe(18);

    const px = pixelSize(size12x18!);
    expect(px.w).toBe(3600);
    expect(px.h).toBe(5400);

    // Physical dimensions
    expect(px.w / DPI).toBe(12.0);
    expect(px.h / DPI).toBe(18.0);
    expect(px.w / px.h).toBeCloseTo(2 / 3);
  });

  it("verifies 10x15 in is exactly 3000x4500 pixels at 300 DPI", () => {
    const size10x15 = SIZES.find((s) => s.id === "10x15");
    const px = pixelSize(size10x15!);
    expect(px.w).toBe(3000);
    expect(px.h).toBe(4500);
    expect(px.w / DPI).toBe(10.0);
    expect(px.h / DPI).toBe(15.0);
  });

  it("verifies 10x12 in is exactly 3000x3600 pixels at 300 DPI", () => {
    const size10x12 = SIZES.find((s) => s.id === "10x12");
    const px = pixelSize(size10x12!);
    expect(px.w).toBe(3000);
    expect(px.h).toBe(3600);
    expect(px.w / DPI).toBe(10.0);
    expect(px.h / DPI).toBe(12.0);
  });

  it("verifies A4 is exact ISO 216 dimensions 2480x3508 pixels at 300 DPI", () => {
    const sizeA4 = SIZES.find((s) => s.id === "a4");
    const px = pixelSize(sizeA4!);
    expect(px.w).toBe(2480);
    expect(px.h).toBe(3508);
  });

  it("injects 300 DPI into JPEG header properly", async () => {
    // Minimal JPEG with SOI and DQT (no JFIF segment)
    const rawJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00]);
    const blob = new Blob([rawJpeg], { type: "image/jpeg" });
    const dpiBlob = await setJpegDpi(blob, 300);

    const buf = new Uint8Array(await dpiBlob.arrayBuffer());
    expect(buf[0]).toBe(0xff);
    expect(buf[1]).toBe(0xd8);
    expect(buf[2]).toBe(0xff);
    expect(buf[3]).toBe(0xe0); // APP0 marker
    expect(buf[13]).toBe(1); // Dots Per Inch
    expect((buf[14] << 8) | buf[15]).toBe(300); // 300 DPI X
    expect((buf[16] << 8) | buf[17]).toBe(300); // 300 DPI Y
  });
});
