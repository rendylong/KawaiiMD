export type ThemeMode = "system" | "light" | "dark";
export type Theme = "light" | "dark";

const KEY_THEME = "kawaimd.theme";
const KEY_RECENT = "kawaimd.recent";
const KEY_TREE_COLLAPSED = "kawaimd.tree-collapsed";
const KEY_TOC_COLLAPSED = "kawaimd.toc-collapsed";
const KEY_SPLIT = "kawaimd.split";
const KEY_TREE_W = "kawaimd.tree-width";
const KEY_TOC_W = "kawaimd.toc-width";
const KEY_SESSION = "kawaimd.session";
const KEY_SHOW_ALL = "kawaimd.show-all-files";

export type Session = { files: string[]; active: string | null; folder: string | null };

// 旧版单文件会话 { file, folder } 迁移到 { files[], active, folder }；
// 形状非法的字段一律回退为空，宁可丢会话也不抛错。
export function normalizeSession(raw: unknown): Session {
  const s = (raw ?? {}) as { files?: unknown; active?: unknown; folder?: unknown; file?: unknown };
  const files = Array.isArray(s.files)
    ? s.files.filter((x): x is string => typeof x === "string")
    : typeof s.file === "string"
      ? [s.file]
      : [];
  const active = typeof s.active === "string" && files.includes(s.active) ? s.active : null;
  const folder = typeof s.folder === "string" ? s.folder : null;
  return { files, active, folder };
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function persist(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 存储不可用时静默降级为会话内状态 */
  }
}

// 侧栏拖宽的夹取范围：树要装下长文件名，目录要装下长标题；下限保证正文区还有意义。
// （须在 settings 初始化之前声明，避免 TDZ）
export const TREE_WIDTH_DEFAULT = 240;
export const TREE_WIDTH_MIN = 170;
export const TREE_WIDTH_MAX = 420;
export const TOC_WIDTH_DEFAULT = 220;
export const TOC_WIDTH_MIN = 150;
export const TOC_WIDTH_MAX = 340;

export const settings = $state({
  themeMode: load<ThemeMode>(KEY_THEME, "system"),
  recents: load<string[]>(KEY_RECENT, []),
  treeCollapsed: load<boolean>(KEY_TREE_COLLAPSED, false),
  tocCollapsed: load<boolean>(KEY_TOC_COLLAPSED, false),
  split: load<number>(KEY_SPLIT, 50),
  treeWidth: load<number>(KEY_TREE_W, TREE_WIDTH_DEFAULT),
  tocWidth: load<number>(KEY_TOC_W, TOC_WIDTH_DEFAULT),
  session: normalizeSession(load<unknown>(KEY_SESSION, {})),
  showAllFiles: load<boolean>(KEY_SHOW_ALL, false),
});

export function setSession(patch: Partial<Session>): void {
  settings.session = { ...settings.session, ...patch };
  persist(KEY_SESSION, settings.session);
}

export function setSplit(v: number): void {
  settings.split = Math.min(75, Math.max(25, Math.round(v)));
  persist(KEY_SPLIT, settings.split);
}

export function setTreeWidth(v: number): void {
  settings.treeWidth = Math.min(TREE_WIDTH_MAX, Math.max(TREE_WIDTH_MIN, Math.round(v)));
  persist(KEY_TREE_W, settings.treeWidth);
}

export function setTocWidth(v: number): void {
  settings.tocWidth = Math.min(TOC_WIDTH_MAX, Math.max(TOC_WIDTH_MIN, Math.round(v)));
  persist(KEY_TOC_W, settings.tocWidth);
}

export function setTreeCollapsed(v: boolean): void {
  settings.treeCollapsed = v;
  persist(KEY_TREE_COLLAPSED, v);
}

export function setTocCollapsed(v: boolean): void {
  settings.tocCollapsed = v;
  persist(KEY_TOC_COLLAPSED, v);
}

export function setShowAllFiles(v: boolean): void {
  settings.showAllFiles = v;
  persist(KEY_SHOW_ALL, v);
}

export function setThemeMode(mode: ThemeMode): void {
  settings.themeMode = mode;
  persist(KEY_THEME, mode);
}

function systemPrefersDark(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolvedTheme(): Theme {
  if (settings.themeMode !== "system") return settings.themeMode;
  return systemPrefersDark() ? "dark" : "light";
}

export function watchSystemTheme(cb: () => void): () => void {
  if (typeof matchMedia !== "function") return () => {};
  const mq = matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function pushRecent(path: string): void {
  settings.recents = [path, ...settings.recents.filter((p) => p !== path)].slice(0, 10);
  persist(KEY_RECENT, settings.recents);
}
