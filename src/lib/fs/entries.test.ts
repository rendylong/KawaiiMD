import { describe, expect, it } from "vitest";
import { classifyEntry, filterNodes, sortEntries } from "./entries";
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

describe("filterNodes", () => {
  const nodes = [
    { name: "docs", isDir: true },
    { name: "README.md", isDir: false },
    { name: "logo.png", isDir: false },
    { name: "数据.csv", isDir: false },
    { name: "AGENTS.md", isDir: false },
  ];

  it("仅 md 模式：保留目录与 markdown，滤掉其余文件", () => {
    const names = filterNodes(nodes, false).map((n) => n.name);
    expect(names).toEqual(["docs", "README.md", "AGENTS.md"]);
  });

  it("全部模式：原样返回（同一引用，不变异）", () => {
    expect(filterNodes(nodes, true)).toBe(nodes);
  });

  it("空数组与边界", () => {
    expect(filterNodes([], false)).toEqual([]);
    expect(filterNodes([{ name: "x.pdf", isDir: false }], false)).toEqual([]);
  });
});
