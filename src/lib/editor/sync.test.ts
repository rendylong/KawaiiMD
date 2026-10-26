import { describe, expect, it } from "vitest";
import { headingAtLine } from "./sync";
import type { HeadingLine } from "../types";

const lines: HeadingLine[] = [
  { id: "a", level: 1, text: "A", line: 2 },
  { id: "b", level: 2, text: "B", line: 5 },
  { id: "c", level: 2, text: "C", line: 12 },
];

describe("headingAtLine", () => {
  it("命中：取不大于输入行的最后一个标题", () => {
    expect(headingAtLine(lines, 7)?.id).toBe("b");
    expect(headingAtLine(lines, 5)?.id).toBe("b");
    expect(headingAtLine(lines, 100)?.id).toBe("c");
  });

  it("低于首标题返回 null", () => {
    expect(headingAtLine(lines, 0)).toBeNull();
  });

  it("空数组返回 null", () => {
    expect(headingAtLine([], 10)).toBeNull();
  });
});
