import { describe, expect, it, vi } from "vitest";
import { decideReload, debounce300 } from "./reload";
import type { FsKind } from "../types";

describe("decideReload", () => {
  const cases: Array<[FsKind, boolean, number | undefined, number | undefined, string]> = [
    ["modify", false, undefined, undefined, "reload"],
    ["modify", true, undefined, undefined, "ask"],
    ["remove", false, undefined, undefined, "error"],
    ["create", false, undefined, undefined, "ignore"],
    ["modify", true, 1000, 1000, "ignore"],
    ["modify", false, 1000, 1001, "reload"],
    ["modify", true, 1000, 1001, "ask"],
  ];

  it.each(cases)("%s dirty=%s mtime %s/%s → %s", (kind, dirty, saved, event, expected) => {
    expect(decideReload(kind, dirty, saved, event)).toBe(expected);
  });
});

describe("debounce300", () => {
  it("只执行最后一次", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce300(fn);
    d(1);
    d(2);
    d(3);
    vi.advanceTimersByTime(400);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
    vi.useRealTimers();
  });
});
