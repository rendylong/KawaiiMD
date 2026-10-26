import { describe, expect, it } from "vitest";
import { classifyEntry, sortEntries } from "./entries";
import type { DirEntry } from "../types";

describe("classifyEntry", () => {
  it("目录与 markdown 扩展名（大小写不敏感）", () => {
    expect(classifyEntry("docs", true)).toBe("dir");
    expect(classifyEntry("a.md", false)).toBe("markdown");
    expect(classifyEntry("B.MARKDOWN", false)).toBe("markdown");
    expect(classifyEntry("c.Mdx", false)).toBe("markdown");
    expect(classifyEntry("x.md.exe", false)).toBe("other");
  });

  it("图片类型", () => {
    expect(classifyEntry("图.PNG", false)).toBe("image");
    expect(classifyEntry("a.jpeg", false)).toBe("image");
    expect(classifyEntry("a.svg", false)).toBe("image");
    expect(classifyEntry("a.txt", false)).toBe("other");
  });
});

describe("sortEntries", () => {
  it("dir → markdown → image → other，组内中文排序", () => {
    const entries: DirEntry[] = [
      { name: "香蕉.md", isDir: false },
      { name: "z-other.txt", isDir: false },
      { name: "b", isDir: true },
      { name: "苹果.md", isDir: false },
      { name: "pic.png", isDir: false },
      { name: "a", isDir: true },
    ];
    const sorted = sortEntries(entries).map((e) => e.name);
    expect(sorted).toEqual(["a", "b", "苹果.md", "香蕉.md", "pic.png", "z-other.txt"]);
  });
});
