import type { FsKind } from "../types";

export function decideReload(
  kind: FsKind,
  isDirty: boolean,
  savedMtime?: number,
  eventMtime?: number
): "reload" | "ask" | "error" | "ignore" {
  if (kind === "create") return "ignore";
  if (kind === "remove") return "error";
  if (savedMtime !== undefined && eventMtime !== undefined && savedMtime === eventMtime) return "ignore";
  return isDirty ? "ask" : "reload";
}

export function debounce300<A extends unknown[]>(fn: (...args: A) => void): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), 300);
  };
}
