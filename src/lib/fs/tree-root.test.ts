import { describe, expect, it } from "vitest";
import { nextStickyRoot } from "./tree-root";

describe("nextStickyRoot", () => {
  it("无粘根时取首个文件目录", () => {
    expect(nextStickyRoot(null, "/notes")).toBe("/notes");
    expect(nextStickyRoot(null, null)).toBeNull();
  });

  it("子目录内的文件不迁移树根（保持可返回上级）", () => {
    expect(nextStickyRoot("/notes", "/notes/sub")).toBe("/notes");
    expect(nextStickyRoot("/notes", "/notes")).toBe("/notes");
  });

  it("树外的文件目录才迁移", () => {
    expect(nextStickyRoot("/notes", "/other")).toBe("/other");
    expect(nextStickyRoot("/notes", "/notes2")).toBe("/notes2");
  });
});
