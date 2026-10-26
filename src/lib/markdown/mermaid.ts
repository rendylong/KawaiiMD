import { S } from "../ui-strings";
import type { Theme } from "../types";

type Mermaid = typeof import("mermaid")["default"];

let mermaidMod: Mermaid | null = null;
let initializedTheme = "";

export function mapMermaidTheme(t: Theme): "default" | "dark" {
  return t === "dark" ? "dark" : "default";
}

export async function renderMermaidBlocks(container: HTMLElement, theme: Theme): Promise<void> {
  const blocks = Array.from(container.querySelectorAll<HTMLElement>("pre > code.language-mermaid"));
  if (blocks.length === 0) return;

  if (!mermaidMod) {
    mermaidMod = (await import("mermaid")).default;
  }
  const mermaidTheme = mapMermaidTheme(theme);
  if (initializedTheme !== mermaidTheme) {
    mermaidMod.initialize({ startOnLoad: false, theme: mermaidTheme });
    initializedTheme = mermaidTheme;
  }

  let seq = 0;
  for (const code of blocks) {
    const pre = code.parentElement;
    if (!pre || pre.dataset.mermaid === "done" || pre.dataset.mermaid === "rendering") continue;
    pre.dataset.mermaid = "rendering";

    const holder = document.createElement("div");
    holder.className = "mermaid-holder";
    const skel = document.createElement("div");
    skel.className = "mermaid-skel";
    holder.appendChild(skel);
    pre.replaceWith(holder);

    try {
      const id = `mmd-${Date.now()}-${seq++}`;
      const { svg } = await mermaidMod.render(id, code.textContent ?? "");
      holder.innerHTML = svg;
      holder.dataset.mermaid = "done";
      holder.classList.add("mermaid-fade");
    } catch {
      pre.dataset.mermaid = "error";
      holder.replaceWith(pre);
      const err = document.createElement("div");
      err.className = "mermaid-error";
      err.textContent = `${S.mermaidError}: 语法错误，已保留源码`;
      pre.before(err);
    }
  }
}
