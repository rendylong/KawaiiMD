import hljs from "highlight.js/lib/common";
import { S } from "../ui-strings";

function escapeHtml(code: string): string {
  return code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function mdHighlight(code: string, lang: string): string {
  if (lang === "mermaid") return escapeHtml(code);
  if (lang && hljs.getLanguage(lang)) {
    return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
  }
  return escapeHtml(code);
}

export function addCopyButtons(container: HTMLElement): void {
  container.querySelectorAll("pre").forEach((pre) => {
    if (pre.querySelector("button.copy-btn")) return;
    const code = pre.querySelector("code");
    if (!code) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-btn";
    btn.textContent = S.copy;
    btn.addEventListener("click", () => {
      const text = code.textContent ?? "";
      void navigator.clipboard?.writeText(text).then(
        () => {
          btn.textContent = S.copied;
          setTimeout(() => {
            btn.textContent = S.copy;
          }, 1500);
        },
        () => {}
      );
    });
    pre.appendChild(btn);
  });
}
