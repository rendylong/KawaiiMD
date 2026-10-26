import { beforeEach, describe, expect, it, vi } from "vitest";

const grantAssetScope = vi.fn(async () => {});
const readTextFile = vi.fn(async (_path: string) => "# 标题\n\n正文 [^1]\n\n[^1]: 注");

vi.mock("$lib/fs/tauri", () => ({
  grantAssetScope,
  readTextFile,
  writeTextFile: vi.fn(async () => {}),
  listDir: vi.fn(async () => []),
  pickFile: vi.fn(async () => null),
  pickFolder: vi.fn(async () => null),
  convertFileSrc: (p: string) => `asset://${p}`,
  dirname: (p: string) => p.split("/").slice(0, -1).join("/") || "/",
}));

const { app, openFile, openFolder } = await import("./app.svelte");
const { settings } = await import("$lib/settings.svelte");

describe("openFile", () => {
  beforeEach(() => {
    app.error = null;
    app.doc = null;
    settings.recents = [];
    grantAssetScope.mockClear();
    readTextFile.mockClear();
  });

  it("成功路径：授权目录、渲染文档、记录最近", async () => {
    await openFile("/d/a.md");
    expect(grantAssetScope).toHaveBeenCalledWith("/d");
    expect(app.currentPath).toBe("/d/a.md");
    expect(app.error).toBeNull();
    expect(app.doc?.toc).toEqual([{ id: "标题", level: 1, text: "标题" }]);
    expect(app.doc?.html).toContain("正文");
    expect(settings.recents[0]).toBe("/d/a.md");
  });

  it("读取失败：错误信息包含文件路径，doc 置空", async () => {
    readTextFile.mockRejectedValueOnce(new Error("读取失败(不存在): /d/missing.md"));
    await openFile("/d/missing.md");
    expect(app.error).toContain("/d/missing.md");
    expect(app.doc).toBeNull();
  });

  it("openFolder 设置 workspaceRoot 并授权", async () => {
    await openFolder("/docs");
    expect(app.workspaceRoot).toBe("/docs");
    expect(grantAssetScope).toHaveBeenCalledWith("/docs");
  });
});
