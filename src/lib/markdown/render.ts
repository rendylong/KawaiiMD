import MarkdownIt from "markdown-it";
import type { Token } from "markdown-it";
import taskLists from "markdown-it-task-lists";
import footnote from "markdown-it-footnote";
import { alert as mdAlert } from "@mdit/plugin-alert";
import type { Doc, HeadingLine, TocItem } from "../types";
import { makeSlugger } from "./slug";
import { mdHighlight } from "./highlight";

const md = new MarkdownIt({ html: false, linkify: true, highlight: mdHighlight })
  .use(taskLists)
  .use(footnote)
  .use(mdAlert);

function headingText(tokens: Token[], index: number): string {
  const inline = tokens[index + 1];
  if (!inline) return "";
  if (inline.children && inline.children.length > 0) {
    return inline.children.map((c) => c.content).join("");
  }
  return inline.content ?? "";
}

export function renderMarkdown(src: string): Doc {
  const tokens = md.parse(src, {});
  const slug = makeSlugger();
  const headingLines: HeadingLine[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== "heading_open") continue;
    const text = headingText(tokens, i);
    const id = slug(text);
    t.attrSet("id", id);
    headingLines.push({
      id,
      level: Number(t.tag.slice(1)),
      text,
      line: t.map?.[0] ?? 0,
    });
  }

  const html = md.renderer.render(tokens, md.options, {});
  const toc: TocItem[] = headingLines.map(({ id, level, text }) => ({ id, level, text }));
  return { html, toc, headingLines };
}
