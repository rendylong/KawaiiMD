import {
  convertFileSrc,
  dirname,
  grantAssetScope,
  onDrop,
  onFsChange,
  onOpenFileEvent,
  readTextFile,
  watchPaths,
} from "../fs/tauri";
import { restoreScroll } from "../dom/scroll";
import { renderForFile } from "../markdown/pipeline";
import { debounce300, decideReload } from "./reload";
import { pushRecent, setSession, settings } from "../settings.svelte";
import { S } from "../ui-strings";
import type { Doc } from "../types";

export const app = $state({
  currentPath: null as string | null,
  workspaceRoot: null as string | null,
  mode: "read" as "read" | "edit",
  doc: null as Doc | null,
  error: null as string | null,
  loading: false,
  conflictPath: null as string | null,
  dirty: false,
  savedMtime: null as number | null,
  docSource: null as string | null,
});

export function setError(msg: string): void {
  app.error = msg;
}

export async function openFile(path: string): Promise<void> {
  app.loading = true;
  try {
    await grantAssetScope(dirname(path));
    const src = await readTextFile(path);
    app.docSource = src;
    app.doc = renderForFile(src, dirname(path));
    app.currentPath = path;
    app.error = null;
    pushRecent(path);
    setSession({ file: path });
    await watchPaths([path, dirname(path)]);
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
  setSession({ folder: path });
}

function nearestHeadingId(): string | null {
  const reader = document.querySelector<HTMLElement>(".reader");
  if (!reader || !app.doc) return null;
  let cur: string | null = null;
  for (const t of app.doc.toc) {
    const el = reader.querySelector<HTMLElement>(`[id="${t.id}"]`);
    if (el && el.offsetTop <= reader.scrollTop + 90) cur = t.id;
  }
  return cur;
}

function restoreAfterReload(id: string | null): void {
  const reader = document.querySelector<HTMLElement>(".reader");
  if (reader) restoreScroll(reader, id);
}

const onFsChangeDebounced = debounce300((e: { path: string; kind: "modify" | "remove" | "create"; mtime: number }) => {
  if (e.path !== app.currentPath) return;
  const decision = decideReload(e.kind, app.dirty, app.savedMtime ?? undefined, e.mtime);
  if (decision === "ignore") return;
  if (decision === "error") {
    setError(`${S.fileDeleted}: ${e.path}`);
    return;
  }
  if (decision === "ask") {
    app.conflictPath = e.path;
    return;
  }
  const id = nearestHeadingId();
  void openFile(e.path).then(() => restoreAfterReload(id));
});

let fsChangeWired = false;

export async function wireFsChange(): Promise<void> {
  if (fsChangeWired) return;
  fsChangeWired = true;
  await onFsChange((e) => onFsChangeDebounced(e));
  await onOpenFileEvent((path) => void openFile(path));
  await onDrop((paths) => {
    const p = paths[0];
    if (!p) return;
    if (/\.(md|markdown|mkd|mdx)$/i.test(p)) void openFile(p);
    else void openFolder(p);
  });
}

export async function restoreSession(): Promise<void> {
  if (settings.session.folder) app.workspaceRoot = settings.session.folder;
  if (settings.session.file) {
    await openFile(settings.session.file);
    if (app.error) {
      app.error = null;
      app.currentPath = null;
      app.doc = null;
    }
  }
}
