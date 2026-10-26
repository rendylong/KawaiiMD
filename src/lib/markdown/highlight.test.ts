import { describe, expect, it, vi } from "vitest";
import { addCopyButtons, mdHighlight } from "./highlight";

describe("mdHighlight", () => {
  it("已知语言产生 hljs 高亮标记", () => {
    const out = mdHighlight("const a = 1", "ts");
    expect(out).toContain("hljs");
    expect(out).toContain("const");
  });

  it("mermaid 语言不走 hljs，仅转义", () => {
    const out = mdHighlight("graph TD\nA-->B", "mermaid");
    expect(out).not.toContain("hljs");
    expect(out).toContain("A--&gt;B");
  });

  it("未知语言退化为转义文本", () => {
    const out = mdHighlight("<x>", "nosuchlang");
    expect(out).toContain("&lt;x&gt;");
  });
});

describe("addCopyButtons", () => {
  it("为每个 pre 注入按钮，点击复制代码内容", async () => {
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });
    const div = document.createElement("div");
    div.innerHTML = '<pre><code>line1\nline2</code></pre>';
    addCopyButtons(div);
    const btn = div.querySelector<HTMLButtonElement>("button.copy-btn");
    expect(btn).not.toBeNull();
    btn?.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("line1\nline2"));
  });
});
