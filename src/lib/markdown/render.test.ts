import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./render";

describe("renderMarkdown", () => {
  it("GFM 表格", () => {
    const { html } = renderMarkdown("| a | b |\n| --- | --- |\n| 1 | 2 |");
    expect(html).toContain("<table");
  });

  it("任务列表渲染 checkbox", () => {
    const { html } = renderMarkdown("- [ ] 待办");
    expect(html).toContain('type="checkbox"');
  });

  it("脚注", () => {
    const { html } = renderMarkdown("正文[^1]\n\n[^1]: 注释内容");
    expect(html.toLowerCase()).toContain("footnote");
  });

  it("alert 容器", () => {
    const { html } = renderMarkdown("> [!NOTE]\n> 提示内容");
    expect(html).toContain("markdown-alert");
  });

  it("中文标题 slug、去重、toc 与 headingLines", () => {
    const doc = renderMarkdown("# 中文 标题\n\n## Section Two\n\n# 中文 标题");
    expect(doc.html).toContain('id="中文-标题"');
    expect(doc.html).toContain('id="中文-标题-1"');
    expect(doc.toc).toHaveLength(3);
    expect(doc.toc[0]).toEqual({ id: "中文-标题", level: 1, text: "中文 标题" });
    expect(doc.headingLines[1]).toMatchObject({ id: "section-two", level: 2 });
    expect(doc.headingLines[1].line).toBeGreaterThanOrEqual(2);
  });

  it("未闭合代码块不抛异常且内容可见", () => {
    expect(() => renderMarkdown("```js\nconst a = 1")).not.toThrow();
    const html = renderMarkdown("```js\nconst a = 1").html;
    expect(html.replace(/<[^>]+>/g, "")).toContain("const a = 1");
  });

  it("mermaid 块保留 language-mermaid", () => {
    const { html } = renderMarkdown("```mermaid\ngraph TD\nA-->B\n```");
    expect(html).toContain("language-mermaid");
  });
});
