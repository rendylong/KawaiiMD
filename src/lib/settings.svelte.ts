export type ThemeMode = "system" | "light" | "dark";
export type Theme = "light" | "dark";

const KEY_THEME = "moyue.theme";
const KEY_RECENT = "moyue.recent";
const KEY_TREE_COLLAPSED = "moyue.tree-collapsed";
const KEY_TOC_COLLAPSED = "moyue.toc-collapsed";
const KEY_SPLIT = "moyue.split";
const KEY_SESSION = "moyue.session";
const KEY_SHOW_ALL = "moyue.show-all-files";

export type Session = { file: string | null; folder: string | null };

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

export const settings = $state({
  themeMode: load<ThemeMode>(KEY_THEME, "system"),
  recents: load<string[]>(KEY_RECENT, []),
  treeCollapsed: load<boolean>(KEY_TREE_COLLAPSED, false),
  tocCollapsed: load<boolean>(KEY_TOC_COLLAPSED, false),
  split: load<number>(KEY_SPLIT, 50),
  session: load<Session>(KEY_SESSION, { file: null, folder: null }),
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
