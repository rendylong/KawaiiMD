import { describe, expect, it } from "vitest";
import { activeFromOffsets } from "./scroll";

describe("activeFromOffsets", () => {
  it("空数组返回 -1", () => {
    expect(activeFromOffsets([], 100)).toBe(-1);
  });

  it("scrollTop 在两标题之间取前一个", () => {
    expect(activeFromOffsets([0, 200, 400], 250)).toBe(1);
  });

  it("超过最后标题仍取最后一个", () => {
    expect(activeFromOffsets([0, 200], 9999)).toBe(1);
  });

  it("scrollTop 小于首个标题（有偏移）取 -1", () => {
    expect(activeFromOffsets([120, 300], 50)).toBe(-1);
  });
});
