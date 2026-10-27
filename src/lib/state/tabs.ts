import type { Doc } from "../types";
import type { Session } from "../settings.svelte";

// 多标签纯逻辑：不碰 DOM / Tauri IPC，可单测。有副作用的编排都在 app.svelte.ts。

export type Tab = {
  id: number;
  // null = 空标签（正文区显示欢迎页，待文件填入）
  path: string | null;
  mode: "read" | "edit";
  doc: Doc | null;
  docSource: string | null;
  savedSource: string | null;
  dirty: boolean;
  savedMtime: number | null;
  error: string | null;
  loading: boolean;
  // 该文件的外部修改冲突待决路径（非 null 时激活态弹对话框）
  conflict: string | null;
  // 每标签独立状态：内容版本（切标签/外部重载时重建阅读器与编辑器）
  docVersion: number;
  scrollTop: number;
  editScrollTop: number;
};

let tabSeq = 0;

export function makeTab(): Tab {
  tabSeq += 1;
  return {
    id: tabSeq,
    path: null,
    mode: "read",
    doc: null,
    docSource: null,
    savedSource: null,
    dirty: false,
    savedMtime: null,
    error: null,
    loading: false,
    conflict: null,
    docVersion: 0,
    scrollTop: 0,
    editScrollTop: 0,
  };
}

export function findTabByPath(tabs: Tab[], path: string): Tab | undefined {
  return tabs.find((t) => t.path === path);
}

export function anyDirty(tabs: Tab[]): boolean {
  return tabs.some((t) => t.dirty);
}

// 关闭 closedId 后应激活的标签：关的是激活标签时取右侧邻居，无则左侧，再无则 null。
// 关闭非激活标签时激活态不动。
export function neighborActiveId(tabs: Tab[], closedId: number, activeId: number | null): number | null {
  if (closedId !== activeId) return activeId;
  const idx = tabs.findIndex((t) => t.id === closedId);
  if (idx < 0) return activeId;
  return tabs[idx + 1]?.id ?? tabs[idx - 1]?.id ?? null;
}

// ⌘⇧[ / ⌘⇧] 循环切换；无标签或未激活返回 null（调用方 no-op）
export function cycleTabId(tabs: Tab[], activeId: number | null, delta: 1 | -1): number | null {
  if (tabs.length === 0) return null;
  const idx = tabs.findIndex((t) => t.id === activeId);
  if (idx < 0) return null;
  return tabs[(idx + delta + tabs.length) % tabs.length].id;
}

// ⌘1–⌘9 直达第 n 个标签（macOS 惯例：⌘9 是第 9 个而非最后一个）
export function nthTabId(tabs: Tab[], n: number): number | null {
  return tabs[n - 1]?.id ?? null;
}

const MD_EXT = /\.(md|markdown|mkd|mdx)$/i;

// 标签标题：去 md 扩展名（Safari/Xcode 惯例），空标签显示占位名
export function tabTitle(tab: Tab, emptyTitle: string): string {
  if (!tab.path) return emptyTitle;
  return tab.path.split("/").pop()!.replace(MD_EXT, "");
}

// 会话序列化：只记有文件的标签，上限 10（与最近打开对齐）；active 不在列时回退末位。
// folder 由 openFolder 单独维护，不在此序列化。
export function tabsToSession(
  tabs: Tab[],
  activeId: number | null,
  limit = 10
): Pick<Session, "files" | "active"> {
  const files = tabs.flatMap((t) => (t.path ? [t.path] : [])).slice(-limit);
  const active = tabs.find((t) => t.id === activeId)?.path ?? null;
  return { files, active: active && files.includes(active) ? active : (files.at(-1) ?? null) };
}
