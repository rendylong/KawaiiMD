import { beforeEach, describe, expect, it, vi } from "vitest";
import { pushRecent, resolvedTheme, setThemeMode, setTreeCollapsed, settings } from "./settings.svelte";

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
});
