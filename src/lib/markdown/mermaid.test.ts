import { describe, expect, it, vi } from "vitest";

const render = vi.fn(async (_id: string, code: string) => ({ svg: `<svg>graph ${code}</svg>` }));
const initialize = vi.fn();

vi.mock("mermaid", () => ({
  default: { initialize, render },
}));

const { mapMermaidTheme, renderMermaidBlocks } = await import("./mermaid");

function makeContainer(html: string): HTMLElement {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div;
}

describe("mapMermaidTheme", () => {
  it("light→default, dark→dark", () => {
    expect(mapMermaidTheme("light")).toBe("default");
    expect(mapMermaidTheme("dark")).toBe("dark");
  });
});

describe("renderMermaidBlocks", () => {
  it("渲染所有 mermaid 块并替换为 svg", async () => {
    render.mockClear();
    initialize.mockClear();
    const c = makeContainer(
      '<pre><code class="language-mermaid">A--&gt;B</code></pre><pre><code class="language-mermaid">C--&gt;D</code></pre>'
    );
    await renderMermaidBlocks(c, "light");
    expect(render).toHaveBeenCalledTimes(2);
    expect(c.querySelectorAll("code.language-mermaid").length).toBe(0);
    expect(c.querySelectorAll("svg").length).toBe(2);
    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({ theme: "default" }));
  });

  it("渲染期间显示骨架占位，完成后移除", async () => {
    let resolveRender!: (v: { svg: string }) => void;
    render.mockImplementationOnce(
      () => new Promise((r) => (resolveRender = r as typeof resolveRender))
    );
    const c = makeContainer('<pre><code class="language-mermaid">X</code></pre>');
    const pending = renderMermaidBlocks(c, "light");
    expect(c.querySelector(".mermaid-skel")).not.toBeNull();
    resolveRender({ svg: "<svg>ok</svg>" });
    await pending;
    expect(c.querySelector(".mermaid-skel")).toBeNull();
    expect(c.querySelector("svg")?.textContent).toBe("ok");
  });

  it("渲染失败：保留源码并插入错误提示", async () => {
    render.mockRejectedValueOnce(new Error("parse error"));
    const c = makeContainer('<pre><code class="language-mermaid">bad</code></pre>');
    await renderMermaidBlocks(c, "light");
    expect(c.querySelector("code.language-mermaid")?.textContent).toBe("bad");
    expect(c.querySelector(".mermaid-error")).not.toBeNull();
  });

  it("已渲染的块跳过", async () => {
    render.mockClear();
    const c = makeContainer(
      '<pre data-mermaid="done"><code class="language-mermaid">done</code></pre><pre><code class="language-mermaid">todo</code></pre>'
    );
    await renderMermaidBlocks(c, "light");
    expect(render).toHaveBeenCalledTimes(1);
  });
});
