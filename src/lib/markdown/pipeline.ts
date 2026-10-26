import { convertFileSrc } from "../fs/tauri";
import type { Doc, Theme } from "../types";
import { resolveImageSrcs } from "./images";
import { renderMarkdown } from "./render";

export function renderForFile(src: string, fileDir: string): Doc {
  const { html, toc, headingLines } = renderMarkdown(src);
  return { html: resolveImageSrcs(html, fileDir, convertFileSrc), toc, headingLines };
}

export async function mountDoc(container: HTMLElement, src: string, fileDir: string, theme: Theme): Promise<void> {
  void theme;
  container.innerHTML = renderForFile(src, fileDir).html;
}
