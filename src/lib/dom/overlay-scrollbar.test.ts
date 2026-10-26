import { describe, expect, it } from "vitest";
import { scrollPerThumbPx, thumbMetrics, thumbTopForScroll } from "./overlay-scrollbar";

describe("thumbMetrics", () => {
  it("内容不足一屏时不可滚动，返回 null", () => {
    expect(thumbMetrics(800, 800)).toBeNull();
    expect(thumbMetrics(800, 500)).toBeNull();
    expect(thumbMetrics(0, 500)).toBeNull();
  });

  it("指示条高度与内容占比成正比", () => {
    // 内容 4 屏（3200px），视口 800px → 占 1/4
    expect(thumbMetrics(800, 3200)!.thumbH).toBe(200);
  });

  it("超长内容时指示条不小于最小高度", () => {
    const m = thumbMetrics(800, 80000);
    expect(m!.thumbH).toBe(28);
    expect(m!.maxThumbTop).toBe(772);
  });

  it("最小高度不会超出视口", () => {
    const m = thumbMetrics(20, 40, 28);
    expect(m!.thumbH).toBe(20);
    expect(m!.maxThumbTop).toBe(0);
  });
});

describe("thumbTopForScroll", () => {
  it("滚动量与指示条位移成正比并夹紧边界", () => {
    // 视口 800 / 内容 3200：thumbH=200，可滚 2400 → 指示条可移 600
    expect(thumbTopForScroll(0, 800, 3200, 200)).toBe(0);
    expect(thumbTopForScroll(1200, 800, 3200, 200)).toBe(300);
    expect(thumbTopForScroll(2400, 800, 3200, 200)).toBe(600);
    expect(thumbTopForScroll(9999, 800, 3200, 200)).toBe(600);
    expect(thumbTopForScroll(-5, 800, 3200, 200)).toBe(0);
  });

  it("不可滚动或指示条占满视口时位移为 0", () => {
    expect(thumbTopForScroll(100, 800, 800, 800)).toBe(0);
    expect(thumbTopForScroll(100, 800, 1600, 800)).toBe(0);
  });
});

describe("scrollPerThumbPx", () => {
  it("拖到轨道底端恰好滚到内容底端", () => {
    // 视口 800 / 内容 3200：thumbH=200，可移 600 对应可滚 2400 → 4px/px
    const px = scrollPerThumbPx(800, 3200, 200);
    expect(px * 600).toBe(2400);
  });

  it("指示条占满视口时退化为 1", () => {
    expect(scrollPerThumbPx(800, 1600, 800)).toBe(1);
  });
});
