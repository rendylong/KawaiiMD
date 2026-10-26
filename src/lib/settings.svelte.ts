export type ThemeMode = "system" | "light" | "dark";
export type Theme = "light" | "dark";

const KEY_THEME = "moyue.theme";
const KEY_RECENT = "moyue.recent";

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
});

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
