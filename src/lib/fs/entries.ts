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
