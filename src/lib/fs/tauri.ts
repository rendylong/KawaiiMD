import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type { DirEntry, FsKind } from "../types";

export type FsChange = { path: string; kind: FsKind; mtime: number };

const MD_FILTER = [{ name: "Markdown", extensions: ["md", "markdown", "mkd", "mdx"] }];

export async function readTextFile(path: string): Promise<string> {
  return invoke<string>("read_text_file", { path });
}

export async function writeTextFile(path: string, contents: string): Promise<number> {
  return invoke<number>("write_text_file", { path, contents });
}

export async function listDir(path: string): Promise<DirEntry[]> {
  return invoke<DirEntry[]>("list_dir", { path });
}

export async function grantAssetScope(dir: string): Promise<void> {
  return invoke<void>("grant_asset_scope", { dir });
}

export async function pickFile(): Promise<string | null> {
  const r = await open({ multiple: false, directory: false, filters: MD_FILTER });
  return typeof r === "string" ? r : null;
}

export async function pickFolder(): Promise<string | null> {
  const r = await open({ multiple: false, directory: true });
  return typeof r === "string" ? r : null;
}

export function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i <= 0 ? "/" : path.slice(0, i);
}

export async function watchPaths(paths: string[]): Promise<void> {
  return invoke<void>("watch_paths", { paths });
}

export async function onFsChange(cb: (e: FsChange) => void): Promise<() => void> {
  const un = await listen<FsChange>("fs-change", (ev) => cb(ev.payload));
  return un;
}

export { convertFileSrc };
