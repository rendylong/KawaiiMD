import { beforeEach, describe, expect, it, vi } from "vitest";

const grantAssetScope = vi.fn(async () => {});
const readTextFile = vi.fn(async (_path: string) => "# 标题\n\n正文 [^1]\n\n[^1]: 注");
const writeTextFile = vi.fn(async () => 1700000000000);
let discardAnswer = true;
const confirmDiscard = vi.fn(async () => discardAnswer);

vi.mock("$lib/fs/tauri", () => ({
  grantAssetScope,
  readTextFile,
  writeTextFile,
  listDir: vi.fn(async () => []),
  pickFile: vi.fn(async () => null),
  pickFolder: vi.fn(async () => null),
  watchPaths: vi.fn(async () => {}),
  onFsChange: vi.fn(async () => () => {}),
  onOpenFileEvent: vi.fn(async () => () => {}),
  onDrop: vi.fn(async () => () => {}),
  confirmDiscard,
  openExternalUrl: vi.fn(async () => {}),
  revealInFinder: vi.fn(async () => {}),
  convertFileSrc: (p: string) => `asset://${p}`,
  dirname: (p: string) => p.split("/").slice(0, -1).join("/") || "/",
}));

const { app, openFile, openFolder, saveCurrent, switchMode, updateSource } = await import("./app.svelte");
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

  it("dirty 时切换文件：拒绝则不切换，同意或 force 则切换", async () => {
    await openFile("/d/a.md");
    updateSource("# 改动");
    expect(app.dirty).toBe(true);
    discardAnswer = false;
    await openFile("/d/b.md");
    expect(app.currentPath).toBe("/d/a.md");
    discardAnswer = true;
    await openFile("/d/b.md");
    expect(app.currentPath).toBe("/d/b.md");
    expect(app.dirty).toBe(false);
    updateSource("# 又改");
    await openFile("/d/a.md", { force: true });
    expect(app.currentPath).toBe("/d/a.md");
  });

  it("saveCurrent 成功后清 dirty 并记录 mtime；失败置 error", async () => {
    await openFile("/d/a.md");
    updateSource("# 改动");
    const ok = await saveCurrent();
    expect(ok).toBe(true);
    expect(app.dirty).toBe(false);
    expect(app.savedMtime).toBe(1700000000000);
    updateSource("# 再改");
    writeTextFile.mockRejectedValueOnce(new Error("写入失败(无权限): /d/a.md"));
    const ok2 = await saveCurrent();
    expect(ok2).toBe(false);
    expect(app.error).toContain("/d/a.md");
    expect(app.dirty).toBe(true);
  });

  it("switchMode：带脏切回阅读时用最新源码重渲染 doc", async () => {
    await openFile("/d/a.md");
    app.mode = "edit";
    updateSource("# 新标题\n\n新正文");
    switchMode();
    expect(app.mode).toBe("read");
    expect(app.doc?.toc).toEqual([{ id: "新标题", level: 1, text: "新标题" }]);
  });
});
