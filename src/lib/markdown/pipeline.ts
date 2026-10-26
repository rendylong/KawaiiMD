import { convertFileSrc, grantAssetScope } from "../fs/tauri";
import type { Doc, Theme } from "../types";
import { addCopyButtons } from "./highlight";
import { collectImagePaths, resolveImageSrcs } from "./images";
import { renderMarkdown } from "./render";
import { renderMermaidBlocks } from "./mermaid";

const grantedDirs = new Set<string>();

async function ensureImageScopes(html: string, fileDir: string): Promise<void> {
  for (const abs of collectImagePaths(html, fileDir)) {
    const i = abs.lastIndexOf("/");
    const dir = i <= 0 ? "/" : abs.slice(0, i);
    if (dir === fileDir || grantedDirs.has(dir)) continue;
    grantedDirs.add(dir);
    await grantAssetScope(dir).catch(() => {
      grantedDirs.delete(dir);
    });
  }
}

export function renderForFile(src: string, fileDir: string): Doc {
  const { html, toc, headingLines } = renderMarkdown(src);
  return { html: resolveImageSrcs(html, fileDir, convertFileSrc), toc, headingLines };
}

export async function mountDoc(container: HTMLElement, src: string, fileDir: string, theme: Theme): Promise<Doc> {
  const doc = renderForFile(src, fileDir);
  await ensureImageScopes(doc.html, fileDir);
  container.innerHTML = doc.html;
  addCopyButtons(container);
  await renderMermaidBlocks(container, theme);
  return doc;
}
