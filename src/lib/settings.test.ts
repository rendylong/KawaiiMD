import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  TOC_WIDTH_DEFAULT,
  TREE_WIDTH_DEFAULT,
  normalizeSession,
  pushRecent,
  resolvedTheme,
  setSession,
  setSplit,
  setThemeMode,
  setTocWidth,
  setTreeCollapsed,
  setTreeWidth,
  settings,
} from "./settings.svelte";

describe("settings", () => {
  beforeEach(() => {
    localStorage.clear();
    settings.themeMode = "system";
    settings.recents = [];
  });

  it("setThemeMode 持久化并影响 resolvedTheme", () => {
    setThemeMode("dark");
    expect(localStorage.getItem("kawaimd.theme")).toBe('"dark"');
    expect(resolvedTheme()).toBe("dark");
  });

  it("system 模式跟随 matchMedia", () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    expect(resolvedTheme()).toBe("dark");
    vi.unstubAllGlobals();
  });

  it("pushRecent 去重置顶且上限 10 条", () => {
    for (let i = 1; i <= 11; i++) pushRecent(`/d/f${i}.md`);
    pushRecent("/d/f5.md");
    expect(settings.recents[0]).toBe("/d/f5.md");
    expect(settings.recents).toHaveLength(10);
    expect(JSON.parse(localStorage.getItem("kawaimd.recent") ?? "[]")).toHaveLength(10);
  });

  it("侧栏折叠状态持久化", () => {
    setTreeCollapsed(true);
    expect(localStorage.getItem("kawaimd.tree-collapsed")).toBe("true");
    expect(settings.treeCollapsed).toBe(true);
  });

  it("编辑分栏比例持久化并夹取 25-75", () => {
    setSplit(90);
    expect(settings.split).toBe(75);
    expect(JSON.parse(localStorage.getItem("kawaimd.split") ?? "0")).toBe(75);
    setSplit(50);
  });

  it("侧栏拖宽持久化并夹取（树 170-420 / 目录 150-340），双击复位到默认", () => {
    setTreeWidth(100);
    expect(settings.treeWidth).toBe(170);
    setTreeWidth(500);
    expect(settings.treeWidth).toBe(420);
    setTreeWidth(300.6);
    expect(settings.treeWidth).toBe(301);
    expect(JSON.parse(localStorage.getItem("kawaimd.tree-width") ?? "0")).toBe(301);
    setTocWidth(120);
    expect(settings.tocWidth).toBe(150);
    setTocWidth(999);
    expect(settings.tocWidth).toBe(340);
    setTocWidth(260);
    expect(JSON.parse(localStorage.getItem("kawaimd.toc-width") ?? "0")).toBe(260);
    setTreeWidth(TREE_WIDTH_DEFAULT);
    setTocWidth(TOC_WIDTH_DEFAULT);
    expect(settings.treeWidth).toBe(240);
    expect(settings.tocWidth).toBe(220);
  });

  it("会话持久化（部分更新）", () => {
    setSession({ files: ["/d/a.md"], active: "/d/a.md" });
    setSession({ folder: "/d" });
    const saved = JSON.parse(localStorage.getItem("kawaimd.session") ?? "{}");
    expect(saved).toEqual({ files: ["/d/a.md"], active: "/d/a.md", folder: "/d" });
    settings.session = { files: [], active: null, folder: null };
  });

  it("旧版单文件会话迁移为新形状", () => {
    expect(normalizeSession({ file: "/d/a.md", folder: "/d" })).toEqual({
      files: ["/d/a.md"],
      active: null,
      folder: "/d",
    });
  });

  it("normalizeSession 剔除非法字段并回退为空", () => {
    expect(normalizeSession({ files: ["/a.md", 42, null], active: "/missing.md", folder: 7 })).toEqual({
      files: ["/a.md"],
      active: null,
      folder: null,
    });
    expect(normalizeSession(undefined)).toEqual({ files: [], active: null, folder: null });
    expect(normalizeSession("junk")).toEqual({ files: [], active: null, folder: null });
  });
});
