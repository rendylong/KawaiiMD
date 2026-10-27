import { describe, expect, it } from "vitest";
import {
  anyDirty,
  cycleTabId,
  findTabByPath,
  makeTab,
  neighborActiveId,
  nthTabId,
  tabTitle,
  tabsToSession,
  type Tab,
} from "./tabs";

function tabsWith(paths: Array<string | null>): Tab[] {
  return paths.map((p) => {
    const t = makeTab();
    t.path = p;
    return t;
  });
}

describe("tabs 纯逻辑", () => {
  it("makeTab 生成唯一 id 的空标签", () => {
    const a = makeTab();
    const b = makeTab();
    expect(a.id).not.toBe(b.id);
    expect(a.path).toBeNull();
    expect(a.dirty).toBe(false);
    expect(a.docVersion).toBe(0);
  });

  it("findTabByPath 命中已有标签", () => {
    const ts = tabsWith(["/a.md", null, "/b.md"]);
    expect(findTabByPath(ts, "/b.md")).toBe(ts[2]);
    expect(findTabByPath(ts, "/x.md")).toBeUndefined();
  });

  it("anyDirty 只要有一个脏标签即为真", () => {
    const ts = tabsWith(["/a.md", "/b.md"]);
    expect(anyDirty(ts)).toBe(false);
    ts[1].dirty = true;
    expect(anyDirty(ts)).toBe(true);
  });

  it("neighborActiveId：关闭激活标签取右侧邻居，无则左侧，再无则 null", () => {
    const ts = tabsWith(["/a.md", "/b.md", "/c.md"]);
    expect(neighborActiveId(ts, ts[0].id, ts[0].id)).toBe(ts[1].id);
    expect(neighborActiveId(ts, ts[1].id, ts[1].id)).toBe(ts[2].id);
    expect(neighborActiveId(ts, ts[2].id, ts[2].id)).toBe(ts[1].id);
    const single = tabsWith(["/a.md"]);
    expect(neighborActiveId(single, single[0].id, single[0].id)).toBeNull();
  });

  it("neighborActiveId：关闭非激活标签时激活态不变", () => {
    const ts = tabsWith(["/a.md", "/b.md"]);
    expect(neighborActiveId(ts, ts[0].id, ts[1].id)).toBe(ts[1].id);
  });

  it("cycleTabId 循环切换，空数组或未激活返回 null", () => {
    const ts = tabsWith(["/a.md", "/b.md", "/c.md"]);
    expect(cycleTabId(ts, ts[2].id, 1)).toBe(ts[0].id);
    expect(cycleTabId(ts, ts[0].id, -1)).toBe(ts[2].id);
    expect(cycleTabId(ts, null, 1)).toBeNull();
    expect(cycleTabId([], null, 1)).toBeNull();
  });

  it("nthTabId：⌘1..9 直达第 n 个，越界为 null", () => {
    const ts = tabsWith(["/a.md", "/b.md"]);
    expect(nthTabId(ts, 1)).toBe(ts[0].id);
    expect(nthTabId(ts, 9)).toBeNull();
  });

  it("tabTitle 去掉 md 系扩展名，空标签用占位名", () => {
    expect(tabTitle(tabsWith(["/docs/笔记.md"])[0], "新标签")).toBe("笔记");
    expect(tabTitle(tabsWith(["/docs/计划.MARKDOWN"])[0], "新标签")).toBe("计划");
    expect(tabTitle(tabsWith(["/docs/无扩展名"])[0], "新标签")).toBe("无扩展名");
    expect(tabTitle(tabsWith([null])[0], "新标签")).toBe("新标签");
  });

  it("tabsToSession：剔除空标签、上限 10、active 缺席回退末位", () => {
    const paths = Array.from({ length: 12 }, (_, i) => `/d/f${i}.md`);
    const ts = tabsWith([...paths.slice(0, 6), null, ...paths.slice(6)]);
    const s = tabsToSession(ts, ts[3].id);
    expect(s.files).toEqual(paths.slice(2));
    expect(s.active).toBe(paths[3]);

    const s2 = tabsToSession(ts, null);
    expect(s2.active).toBe(paths.at(-1));

    expect(tabsToSession([], null)).toEqual({ files: [], active: null });
  });
});
