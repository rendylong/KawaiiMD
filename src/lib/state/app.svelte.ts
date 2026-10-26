import { convertFileSrc, dirname, grantAssetScope, readTextFile } from "../fs/tauri";
import { renderForFile } from "../markdown/pipeline";
import { pushRecent } from "../settings.svelte";
import type { Doc } from "../types";

export const app = $state({
  currentPath: null as string | null,
  workspaceRoot: null as string | null,
  mode: "read" as "read" | "edit",
  doc: null as Doc | null,
  error: null as string | null,
  loading: false,
  conflictPath: null as string | null,
});

export function setError(msg: string): void {
  app.error = msg;
}

export async function openFile(path: string): Promise<void> {
  app.loading = true;
  try {
    await grantAssetScope(dirname(path));
    const src = await readTextFile(path);
    app.doc = renderForFile(src, dirname(path));
    app.currentPath = path;
    app.error = null;
    pushRecent(path);
  } catch (e) {
    app.doc = null;
    const msg = e instanceof Error ? e.message : String(e);
    app.error = msg.includes(path) ? msg : `${msg} (${path})`;
  } finally {
    app.loading = false;
  }
}

export async function openFolder(path: string): Promise<void> {
  app.workspaceRoot = path;
  await grantAssetScope(path);
}
