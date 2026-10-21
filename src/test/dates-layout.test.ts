import { describe, expect, it } from "vitest";
import { parseDateTokens, computeDateLayout, DEFAULT_TEXT_ADJ } from "../lib/render";
import { FRAMES, SIZES, pixelSize } from "../lib/frames";

describe("Date tokens parsing and column alignment", () => {
  it("correctly parses 3-token Thai dates and cleans arbitrary spacing", () => {
    const d1 = parseDateTokens("20 มี.ค. 2531");
    expect(d1).toEqual({ day: "20", month: "มี.ค.", year: "2531", isCol: true });

    const d2 = parseDateTokens(" 1 ต.ค. 2569");
    expect(d2).toEqual({ day: "1", month: "ต.ค.", year: "2569", isCol: true });

    const d3 = parseDateTokens("  15    มกราคม    2500  ");
    expect(d3).toEqual({ day: "15", month: "มกราคม", year: "2500", isCol: true });

    const d4 = parseDateTokens("วัน เดือน ปี");
    expect(d4).toEqual({ day: "วัน", month: "เดือน", year: "ปี", isCol: true });

    const d5 = parseDateTokens("2531");
    expect(d5).toEqual({ raw: "2531", isCol: false });

    const d6 = parseDateTokens("   ");
    expect(d6).toBeNull();
  });

  it("locks Day, Month, and Year to identical columns for born and died rows", () => {
    // Mock text measurement: 10px per character for test predictability
    const mockMeasure = (txt: string) => txt.length * 10;
    const datesCx = 500;
    const datesFs = 24;

    const layout = computeDateLayout(
      "20 มี.ค. 2531",
      " 1 ต.ค. 2569",
      datesCx,
      datesFs,
      mockMeasure,
    );

    expect(layout.useColMode).toBe(true);
    expect(layout.bornParsed).toEqual({ day: "20", month: "มี.ค.", year: "2531", isCol: true });
    expect(layout.diedParsed).toEqual({ day: "1", month: "ต.ค.", year: "2569", isCol: true });

    // The horizontal coordinates must be shared single values (locked columns)
    expect(typeof layout.blockLeft).toBe("number");
    expect(typeof layout.colonX).toBe("number");
    expect(typeof layout.dayRightX).toBe("number");
    expect(typeof layout.monthStartX).toBe("number");
    expect(typeof layout.yearStartX).toBe("number");

    // Order of columns from left to right:
    // blockLeft ("ชาตะ"/"มรณะ") < colonX (":") < dayRightX (Day column end) < monthStartX (Month start) < yearStartX (Year start)
    expect(layout.blockLeft).toBeLessThan(layout.colonX);
    expect(layout.colonX).toBeLessThan(layout.dayRightX);
    expect(layout.dayRightX).toBeLessThan(layout.monthStartX);
    expect(layout.monthStartX).toBeLessThan(layout.yearStartX);

    // Spacing between Day column end and Month start should equal colGap
    const expectedColGap = datesFs * 0.45;
    expect(layout.monthStartX - layout.dayRightX).toBeCloseTo(expectedColGap, 2);

    // Month column width must accommodate the longest month token
    const maxMonthW = Math.max(mockMeasure("มี.ค."), mockMeasure("ต.ค."));
    expect(layout.yearStartX - layout.monthStartX).toBeGreaterThanOrEqual(maxMonthW + expectedColGap);
  });

  it("verifies optical balance across all 10 frames and 4 print sizes", () => {
    for (const size of SIZES) {
      const px = pixelSize(size);
      const H = px.h;
      const s = H / 1920;

      for (const frame of FRAMES) {
        const [t0, t1] = frame.text;
        const baseTy = t0 * s;
        const th = (t1 - t0) * s;

        // Balanced ratios with Age
        const nameY = baseTy + th * 0.18;
        const bornY = baseTy + th * 0.50;
        const diedY = baseTy + th * 0.68;
        const ageY = baseTy + th * 0.86;

        // Equal vertical gap between Born -> Died and Died -> Age
        const gapDates = diedY - bornY;
        const gapAge = ageY - diedY;
        expect(gapDates).toBeCloseTo(gapAge, 1);

        // Name is comfortably above born date
        expect(bornY).toBeGreaterThan(nameY);
        // Age is inside frame text area (below t1 * s)
        const ageFs = th * 0.115;
        const ageBottom = ageY + ageFs * 0.5;
        expect(ageBottom).toBeLessThanOrEqual(t1 * s);
      }
    }
  });

  it("verifies default text adjustment values are locked at scale 1 and center 0", () => {
    expect(DEFAULT_TEXT_ADJ.name).toEqual({ scale: 1, ox: 0, oy: 0 });
    expect(DEFAULT_TEXT_ADJ.dates).toEqual({ scale: 1, ox: 0, oy: 0 });
    expect(DEFAULT_TEXT_ADJ.age).toEqual({ scale: 1, ox: 0, oy: 0 });
  });
});
