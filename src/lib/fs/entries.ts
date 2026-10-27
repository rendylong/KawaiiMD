import type { DirEntry } from "../types";

const MD_EXT = [".md", ".markdown", ".mkd", ".mdx"];
const IMG_EXT = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif"];

export type EntryKind = "dir" | "markdown" | "image" | "other";

export function classifyEntry(name: string, isDir: boolean): EntryKind {
  if (isDir) return "dir";
  const lower = name.toLowerCase();
  if (MD_EXT.some((e) => lower.endsWith(e))) return "markdown";
  if (IMG_EXT.some((e) => lower.endsWith(e))) return "image";
  return "other";
}

const RANK: Record<EntryKind, number> = { dir: 0, markdown: 1, image: 2, other: 3 };

export function sortEntries(entries: DirEntry[]): DirEntry[] {
  return [...entries].sort((a, b) => {
    const ka = RANK[classifyEntry(a.name, a.isDir)];
    const kb = RANK[classifyEntry(b.name, b.isDir)];
    if (ka !== kb) return ka - kb;
    return a.name.localeCompare(b.name, "zh");
  });
}

// 仅 md 模式下的树视图过滤（纯函数、不变异节点）。
// 只过滤文件、目录一律保留：树是懒加载的，未展开目录无法廉价判断子树是否含 md，
// 误藏目录会让里面的 md 永远打不开——宁可多显示空目录，不丢可达内容。
export function filterNodes<T extends { name: string; isDir: boolean }>(nodes: T[], showAll: boolean): T[] {
  if (showAll) return nodes;
  return nodes.filter((n) => n.isDir || classifyEntry(n.name, false) === "markdown");
}
