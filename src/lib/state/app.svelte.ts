import {
  confirmDiscard,
  createTextFile,
  dirname,
  grantAssetScope,
  onDrop,
  onFsChange,
  onOpenFileEvent,
  readTextFile,
  takePendingOpenFile,
  watchPaths,
  writeTextFile,
  type FsChange,
} from "../fs/tauri";
import { finalizeName } from "../fs/new-file";
import { restoreScroll } from "../dom/scroll";
import { renderForFile } from "../markdown/pipeline";
import { debounce300, decideReload } from "./reload";
import { pushRecent, setSession, settings } from "../settings.svelte";
import { S } from "../ui-strings";
import { anyDirty, findTabByPath, makeTab, neighborActiveId, tabsToSession, type Tab } from "./tabs";

// 多标签状态模型：Tab 对象是每份文档状态的唯一真相（路径/内容/模式/脏/滚动/冲突），
// app 只保留跨标签的全局字段。组件一律经 activeTab() 读当前标签——不做
// 「单文档视图字段 ↔ 标签状态」双向投影，避免两者漂移的整类 bug。
export const app = $state({
  workspaceRoot: null as string | null,
  tabs: [] as Tab[],
  activeId: null as number | null,
  lightboxSrc: null as string | null,
  // 就地新建的目标目录路径（文件树据此显示命名行），null = 未在新建
  creating: null as string | null,
});

export function activeTab(): Tab | null {
  return app.tabs.find((t) => t.id === app.activeId) ?? null;
}

export function currentPath(): string | null {
  return activeTab()?.path ?? null;
}

function persistSession(): void {
  setSession(tabsToSession(app.tabs, app.activeId));
}

function readerEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".reader");
}

// 切走前把阅读/编辑滚动位置记回当前标签（编辑器销毁前的兜底，EditorView 的 cleanup 也会记）
function saveActiveScroll(): void {
  const cur = activeTab();
  const reader = readerEl();
  if (!cur || !reader) return;
  cur.scrollTop = reader.scrollTop;
  const cm = reader.querySelector<HTMLElement>(".cm-scroller");
  if (cm) cur.editScrollTop = cm.scrollTop;
}

export function activateTab(id: number): void {
  if (app.activeId === id || !app.tabs.some((t) => t.id === id)) return;
  saveActiveScroll();
  app.activeId = id;
  persistSession();
}

// 空标签（正文区显示欢迎页，等待文件填入）
export function newTab(): void {
  saveActiveScroll();
  const t = makeTab();
  app.tabs.push(t);
  app.activeId = t.id;
  persistSession();
}

// 必须返回「从状态数组读回的代理引用」：Svelte 5 的 $state 代理在元素首次被
// 读取时接管对象，之后对原始（raw）引用的写入会静默丢失——持有 raw 引用改写
// 是多标签状态不生效的根因，勿改回返回 makeTab() 的直接产物。
function appendTab(): Tab {
  const t = makeTab();
  app.tabs.push(t);
  // 首个标签立即成为激活态，避免欢迎页闪一帧
  app.activeId ??= t.id;
  return app.tabs[app.tabs.length - 1];
}

export function anyTabDirty(): boolean {
  return anyDirty(app.tabs);
}

// 读取 + 渲染到指定标签。失败时保留标签原有内存内容（未保存修改不丢、仍可保存），
// 仅记录错误；空标签失败则记下目标路径，让错误页有上下文。
async function loadIntoTab(tab: Tab, path: string): Promise<void> {
  tab.loading = true;
  try {
    await grantAssetScope(dirname(path));
    const src = await readTextFile(path);
    tab.path = path;
    tab.docSource = src;
    tab.savedSource = src;
    tab.dirty = false;
    tab.savedMtime = null;
    tab.error = null;
    tab.conflict = null;
    tab.doc = renderForFile(src, dirname(path));
    tab.docVersion += 1;
    pushRecent(path);
    persistSession();
    await watchPaths([path, dirname(path)]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    tab.error = msg.includes(path) ? msg : `${msg} (${path})`;
    if (tab.path === null) tab.path = path;
  } finally {
    tab.loading = false;
  }
}

// 打开语义（多标签）：
// - 路径已在某标签打开 → 激活该标签（同文件不重复开，避免保存/刷新语义分叉）
// - newTab / force → 新标签承载（Finder 双击、拖拽、⌘O 等外部入口；force 为刚创建的文件）
// - 默认 → 替换当前标签内容（树点击、文档内链接、最近打开）；当前是空标签则就地填充
// - 替换有未保存修改的标签前先确认（与单文档时代一致）
export async function openFile(path: string, opts?: { force?: boolean; newTab?: boolean }): Promise<void> {
  const existing = findTabByPath(app.tabs, path);
  if (existing && !opts?.force && !opts?.newTab) {
    activateTab(existing.id);
    return;
  }

  const cur = activeTab();
  let tab: Tab;
  if (existing) {
    tab = existing; // force：同路径原地重载（外部修改/冲突），不抢激活
  } else if (opts?.newTab || opts?.force) {
    tab = appendTab();
  } else if (cur && cur.path === null) {
    tab = cur; // 空标签就地填充
  } else {
    if (cur?.dirty) {
      const ok = await confirmDiscard(`${S.dirtySwitch}: ${path}`);
      if (!ok) return;
    }
    tab = cur ?? appendTab();
  }

  if (app.activeId !== tab.id && tab.path === null) activateTab(tab.id);
  await loadIntoTab(tab, path);
}

// 返回 false = 用户在脏确认中取消
export async function closeTab(id: number): Promise<boolean> {
  const idx = app.tabs.findIndex((t) => t.id === id);
  if (idx < 0) return true;
  const tab = app.tabs[idx];
  if (tab.dirty) {
    const ok = await confirmDiscard(`${S.tabDirtyClose}${tab.path ? `：${tab.path}` : ""}`);
    if (!ok) return false;
  }
  const wasActive = app.activeId === id;
  const next = neighborActiveId(app.tabs, id, app.activeId);
  app.tabs.splice(idx, 1);
  if (wasActive) app.activeId = next;
  persistSession();
  return true;
}

export async function closeOtherTabs(keepId: number): Promise<boolean> {
  if (app.tabs.some((t) => t.id !== keepId && t.dirty)) {
    const ok = await confirmDiscard(S.otherTabsDirtyClose);
    if (!ok) return false;
  }
  app.tabs = app.tabs.filter((t) => t.id === keepId);
  app.activeId = keepId;
  persistSession();
  return true;
}

export function updateSource(src: string): void {
  const tab = activeTab();
  if (!tab) return;
  tab.docSource = src;
  tab.dirty = src !== tab.savedSource;
}

export async function saveCurrent(): Promise<boolean> {
  const tab = activeTab();
  if (!tab?.path || tab.docSource === null) return true;
  try {
    tab.savedMtime = await writeTextFile(tab.path, tab.docSource);
    tab.savedSource = tab.docSource;
    tab.dirty = false;
    return true;
  } catch (e) {
    tab.error = e instanceof Error ? e.message : String(e);
    return false;
  }
}

export function switchMode(): void {
  const tab = activeTab();
  if (!tab?.doc) return;
  if (tab.mode === "read") {
    tab.mode = "edit";
  } else {
    if (tab.dirty && tab.docSource !== null && tab.path) {
      tab.doc = renderForFile(tab.docSource, dirname(tab.path));
    }
    tab.mode = "read";
  }
}

export type CreateResult = { ok: true } | { ok: false; cancelled?: boolean; error?: string };

// 在 dir 下以 rawName 新建 md：create_new 原子创建（绝不覆盖已有文件），
// 成功后在「新标签」打开并直接进入编辑模式——不打扰当前标签，也无需脏确认。
export async function createFileAt(dir: string, rawName: string): Promise<CreateResult> {
  const name = finalizeName(rawName);
  const path = `${dir}/${name}`;
  try {
    const base = name.replace(/\.md$/i, "");
    await createTextFile(path, `# ${base}\n`);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  app.creating = null;
  await openFile(path, { force: true });
  const tab = activeTab();
  if (tab) tab.mode = "edit";
  return { ok: true };
}

export async function openFolder(path: string): Promise<void> {
  app.workspaceRoot = path;
  await grantAssetScope(path);
  setSession({ folder: path });
}

function nearestHeadingId(tab: Tab): string | null {
  const reader = readerEl();
  if (!reader || !tab.doc) return null;
  let cur: string | null = null;
  for (const t of tab.doc.toc) {
    const el = reader.querySelector<HTMLElement>(`[id="${t.id}"]`);
    if (el && el.offsetTop <= reader.scrollTop + 90) cur = t.id;
  }
  return cur;
}

const onFsChangeDebounced = debounce300((e: FsChange) => {
  // 事件按路径路由到所属标签；未被任何标签持有（或已关闭）的路径直接忽略
  const tab = findTabByPath(app.tabs, e.path);
  if (!tab) return;
  const decision = decideReload(e.kind, tab.dirty, tab.savedMtime ?? undefined, e.mtime);
  if (decision === "ignore") return;
  if (decision === "error") {
    tab.error = `${S.fileDeleted}: ${e.path}`;
    return;
  }
  if (decision === "ask") {
    // 后台标签的冲突挂起到该标签上，待其激活时再弹（标签以警示点示意）
    tab.conflict = e.path;
    return;
  }
  const heading = app.activeId === tab.id ? nearestHeadingId(tab) : null;
  void loadIntoTab(tab, e.path).then(() => {
    const r = app.activeId === tab.id ? readerEl() : null;
    if (r && heading) restoreScroll(r, heading);
  });
});

let fsChangeWired = false;

export async function wireFsChange(): Promise<void> {
  if (fsChangeWired) return;
  fsChangeWired = true;
  await onFsChange((e) => onFsChangeDebounced(e));
  // Finder 双击 / 二次启动：新标签打开，不打断当前阅读
  await onOpenFileEvent((path) => void openFile(path, { newTab: true }));
  // 冷启动时 Opened 事件先于前端监听器到达，Rust 侧暂存于 PENDING_OPEN，此处补取
  const pending = await takePendingOpenFile();
  if (pending) await openFile(pending, { newTab: true });
  await onDrop((paths) => {
    const p = paths[0];
    if (!p) return;
    if (/\.(md|markdown|mkd|mdx)$/i.test(p)) void openFile(p, { newTab: true });
    else void openFolder(p);
  });
}

export async function restoreSession(): Promise<void> {
  if (settings.session.folder) app.workspaceRoot = settings.session.folder;
  // 冷启动双击文件已先行打开：以它为准，不恢复会话标签
  if (app.tabs.length > 0) return;
  const files = settings.session.files;
  let activePath = settings.session.active;
  for (const f of files.slice(0, 10)) {
    const t = appendTab();
    await loadIntoTab(t, f);
    if (t.error) {
      // 打不开的（已被删除/移动）静默丢弃，与单文件时代一致
      app.tabs = app.tabs.filter((x) => x.id !== t.id);
      if (activePath === f) activePath = null;
    }
  }
  const target = (activePath && findTabByPath(app.tabs, activePath)) || app.tabs.at(-1) || null;
  app.activeId = target?.id ?? null;
  persistSession();
}
