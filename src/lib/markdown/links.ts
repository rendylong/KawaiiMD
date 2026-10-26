import { joinPath } from "./images";

export type LinkAction =
  | { type: "external"; target: string }
  | { type: "anchor"; target: string }
  | { type: "md"; target: string }
  | { type: "other"; target: string };

const MD_RE = /\.(md|markdown|mkd|mdx)$/i;

function decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function linkAction(href: string, baseDir: string): LinkAction {
  if (/^https?:\/\//i.test(href)) return { type: "external", target: href };
  if (href.startsWith("#")) return { type: "anchor", target: decode(href.slice(1)) };
  const abs = joinPath(baseDir, decode(href));
  if (MD_RE.test(abs)) return { type: "md", target: abs };
  return { type: "other", target: abs };
}
