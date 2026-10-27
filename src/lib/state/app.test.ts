import { beforeEach, describe, expect, it, vi } from "vitest";

const grantAssetScope = vi.fn(async () => {});
const readTextFile = vi.fn(async (_path: string) => "# 标题\n\n正文 [^1]\n\n[^1]: 注");
const writeTextFile = vi.fn(async () => 1700000000000);
const createTextFile = vi.fn(async () => 0);
let discardAnswer = true;
const confirmDiscard = vi.fn(async () => discardAnswer);

vi.mock("$lib/fs/tauri", () => ({
  grantAssetScope,
  readTextFile,
  writeTextFile,
  createTextFile,
  listDir: vi.fn(async () => []),
  pickFile: vi.fn(async () => null),
  pickFolder: vi.fn(async () => null),
  watchPaths: vi.fn(async () => {}),
  onFsChange: vi.fn(async () => () => {}),
  onOpenFileEvent: vi.fn(async () => () => {}),
  onDrop: vi.fn(async () => () => {}),
  takePendingOpenFile: vi.fn(async () => null),
  confirmDiscard,
  openExternalUrl: vi.fn(async () => {}),
  revealInFinder: vi.fn(async () => {}),
  convertFileSrc: (p: string) => `asset://${p}`,
  dirname: (p: string) => p.split("/").slice(0, -1).join("/") || "/",
}));

const {
  activeTab,
  app,
  closeOtherTabs,
  closeTab,
  createFileAt,
  newTab,
  openFile,
  openFolder,
  restoreSession,
  saveCurrent,
  switchMode,
  updateSource,
} = await import("./app.svelte");
const { settings } = await import("$lib/settings.svelte");

function resetTabs(): void {
  app.tabs = [];
  app.activeId = null;
  app.workspaceRoot = null;
  app.creating = null;
}

describe("openFile / 多标签", () => {
  beforeEach(() => {
    resetTabs();
    settings.recents = [];
    settings.session = { files: [], active: null, folder: null };
    grantAssetScope.mockClear();
    readTextFile.mockClear();
    confirmDiscard.mockClear();
    discardAnswer = true;
  });

  it("成功路径：授权目录、渲染文档、记录最近", async () => {
    await openFile("/d/a.md");
    expect(grantAssetScope).toHaveBeenCalledWith("/d");
    expect(activeTab()?.path).toBe("/d/a.md");
    expect(activeTab()?.error).toBeNull();
    expect(activeTab()?.doc?.toc).toEqual([{ id: "标题", level: 1, text: "标题" }]);
    expect(settings.recents[0]).toBe("/d/a.md");
  });

  it("读取失败：错误含路径，空标签记下目标路径、doc 置空", async () => {
    readTextFile.mockRejectedValueOnce(new Error("读取失败(不存在): /d/missing.md"));
    await openFile("/d/missing.md");
    expect(activeTab()?.error).toContain("/d/missing.md");
    expect(activeTab()?.doc).toBeNull();
    expect(activeTab()?.path).toBe("/d/missing.md");
  });

  it("同文件重复打开：复用已有标签并激活，不新增", async () => {
    await openFile("/d/a.md");
    await openFile("/d/b.md", { newTab: true });
    await openFile("/d/a.md");
    expect(app.tabs).toHaveLength(2);
    expect(app.tabs.map((t) => t.path)).toEqual(["/d/a.md", "/d/b.md"]);
    expect(app.activeId).toBe(app.tabs[0].id);
  });

  it("newTab：强制新标签承载，不询问当前标签的 dirty 确认", async () => {
    await openFile("/d/a.md");
    updateSource("# 改动");
    discardAnswer = false;
    await openFile("/d/b.md", { newTab: true });
    expect(confirmDiscard).not.toHaveBeenCalled();
    expect(app.tabs).toHaveLength(2);
    expect(activeTab()?.path).toBe("/d/b.md");
    expect(app.tabs[0].dirty).toBe(true);
  });

  it("空标签就地填充而非再开新标签", async () => {
    newTab();
    await openFile("/d/a.md");
    expect(app.tabs).toHaveLength(1);
    expect(activeTab()?.path).toBe("/d/a.md");
  });

  it("默认替换当前标签：dirty 时确认，拒绝则不切换，同意则切换", async () => {
    await openFile("/d/a.md");
    updateSource("# 改动");
    discardAnswer = false;
    await openFile("/d/b.md");
    expect(confirmDiscard).toHaveBeenCalled();
    expect(app.tabs).toHaveLength(1);
    expect(activeTab()?.path).toBe("/d/a.md");
    expect(activeTab()?.dirty).toBe(true);
    discardAnswer = true;
    await openFile("/d/b.md");
    expect(activeTab()?.path).toBe("/d/b.md");
    expect(activeTab()?.dirty).toBe(false);
  });

  it("openFolder 设置 workspaceRoot 并授权", async () => {
    await openFolder("/docs");
    expect(app.workspaceRoot).toBe("/docs");
    expect(grantAssetScope).toHaveBeenCalledWith("/docs");
  });

  it("closeTab：非脏直接关；脏标签取消则保留；关激活标签取邻居；全关回 null", async () => {
    await openFile("/d/a.md");
    await openFile("/d/b.md", { newTab: true });
    await openFile("/d/c.md", { newTab: true });
    const [, b, c] = app.tabs;
    updateSource("# 改"); // c（激活）脏
    app.activeId = b.id;

    expect(await closeTab(app.tabs[0].id)).toBe(true); // a 非脏直接关
    expect(app.tabs.map((t) => t.path)).toEqual(["/d/b.md", "/d/c.md"]);
    discardAnswer = false;
    expect(await closeTab(c.id)).toBe(false); // 脏且拒绝
    expect(app.tabs).toHaveLength(2);
    discardAnswer = true;
    expect(await closeTab(c.id)).toBe(true); // c 非激活，关后激活态不动
    expect(app.activeId).toBe(b.id);
    expect(await closeTab(b.id)).toBe(true); // 最后一个，无邻居
    expect(app.tabs).toHaveLength(0);
    expect(app.activeId).toBeNull();
  });

  it("closeOtherTabs：他标签有脏先确认；同意后仅剩保留标签", async () => {
    await openFile("/d/a.md");
    await openFile("/d/b.md", { newTab: true });
    await openFile("/d/c.md", { newTab: true });
    app.activeId = app.tabs[0].id;
    app.tabs[2].dirty = true;
    discardAnswer = false;
    expect(await closeOtherTabs(app.tabs[0].id)).toBe(false);
    expect(app.tabs).toHaveLength(3);
    discardAnswer = true;
    expect(await closeOtherTabs(app.tabs[0].id)).toBe(true);
    expect(app.tabs.map((t) => t.path)).toEqual(["/d/a.md"]);
    expect(app.activeId).toBe(app.tabs[0].id);
  });

  it("saveCurrent 成功后清 dirty 并记录 mtime；失败置标签 error", async () => {
    await openFile("/d/a.md");
    updateSource("# 改动");
    const ok = await saveCurrent();
    expect(ok).toBe(true);
    expect(activeTab()?.dirty).toBe(false);
    expect(activeTab()?.savedMtime).toBe(1700000000000);
    updateSource("# 再改");
    writeTextFile.mockRejectedValueOnce(new Error("写入失败(无权限): /d/a.md"));
    const ok2 = await saveCurrent();
    expect(ok2).toBe(false);
    expect(activeTab()?.error).toContain("/d/a.md");
    expect(activeTab()?.dirty).toBe(true);
  });

  it("switchMode：带脏切回阅读时用最新源码重渲染 doc", async () => {
    await openFile("/d/a.md");
    activeTab()!.mode = "edit";
    updateSource("# 新标题\n\n新正文");
    switchMode();
    expect(activeTab()?.mode).toBe("read");
    expect(activeTab()?.doc?.toc).toEqual([{ id: "新标题", level: 1, text: "新标题" }]);
  });

  it("docVersion 按标签独立：加载即 1，原地重载递增，他标签不受影响", async () => {
    await openFile("/d/a.md");
    expect(app.tabs[0].docVersion).toBe(1);
    await openFile("/d/b.md", { newTab: true });
    expect(app.tabs[1].docVersion).toBe(1);
    expect(app.tabs[0].docVersion).toBe(1);
    await openFile("/d/b.md", { force: true }); // 外部重载：同路径原地递增
    expect(app.tabs[1].docVersion).toBe(2);
    expect(app.tabs[0].docVersion).toBe(1);
  });

  it("createFileAt：创建后在新标签打开并直接进入编辑", async () => {
    await openFile("/d/a.md");
    const r = await createFileAt("/d", "新笔记.md");
    expect(r.ok).toBe(true);
    expect(app.tabs).toHaveLength(2);
    expect(activeTab()?.path).toBe("/d/新笔记.md");
    expect(activeTab()?.mode).toBe("edit");
  });

  it("restoreSession：files 恢复为标签并激活 active；打不开的静默丢弃", async () => {
    // gone.md 排首位：mockRejectedValueOnce 拒绝的是第一次读取
    settings.session = { files: ["/d/gone.md", "/d/a.md", "/d/b.md"], active: "/d/b.md", folder: "/d" };
    readTextFile.mockRejectedValueOnce(new Error("不存在: /d/gone.md"));
    await restoreSession();
    expect(app.workspaceRoot).toBe("/d");
    expect(app.tabs.map((t) => t.path)).toEqual(["/d/a.md", "/d/b.md"]);
    expect(activeTab()?.path).toBe("/d/b.md");
  });

  it("restoreSession：已有标签（如启动期双击打开）则不再恢复会话", async () => {
    settings.session = { files: ["/d/old.md"], active: null, folder: null };
    await openFile("/d/new.md", { newTab: true });
    await restoreSession();
    expect(app.tabs.map((t) => t.path)).toEqual(["/d/new.md"]);
  });
});
