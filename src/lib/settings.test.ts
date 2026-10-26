import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  pushRecent,
  resolvedTheme,
  setSession,
  setSplit,
  setThemeMode,
  setTreeCollapsed,
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
    expect(localStorage.getItem("moyue.theme")).toBe('"dark"');
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
    expect(JSON.parse(localStorage.getItem("moyue.recent") ?? "[]")).toHaveLength(10);
  });

  it("侧栏折叠状态持久化", () => {
    setTreeCollapsed(true);
    expect(localStorage.getItem("moyue.tree-collapsed")).toBe("true");
    expect(settings.treeCollapsed).toBe(true);
  });

  it("编辑分栏比例持久化并夹取 25-75", () => {
    setSplit(90);
    expect(settings.split).toBe(75);
    expect(JSON.parse(localStorage.getItem("moyue.split") ?? "0")).toBe(75);
    setSplit(50);
  });

  it("会话持久化（部分更新）", () => {
    setSession({ file: "/d/a.md" });
    setSession({ folder: "/d" });
    const saved = JSON.parse(localStorage.getItem("moyue.session") ?? "{}");
    expect(saved).toEqual({ file: "/d/a.md", folder: "/d" });
    expect(settings.session.file).toBe("/d/a.md");
    settings.session = { file: null, folder: null };
  });
});
