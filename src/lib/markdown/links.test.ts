import { describe, expect, it } from "vitest";
import { linkAction } from "./links";

describe("linkAction", () => {
  it("外链 → external", () => {
    expect(linkAction("https://example.com/a", "/d")).toEqual({ type: "external", target: "https://example.com/a" });
    expect(linkAction("http://x.y", "/d")).toEqual({ type: "external", target: "http://x.y" });
  });

  it("页内锚点 → anchor", () => {
    expect(linkAction("#sec", "/d")).toEqual({ type: "anchor", target: "sec" });
  });

  it("相对 .md 链接（含编码）→ md，基于 baseDir 解析", () => {
    expect(linkAction("other.md", "/d")).toEqual({ type: "md", target: "/d/other.md" });
    expect(linkAction("%E4%B8%AD%E6%96%87.md", "/d")).toEqual({ type: "md", target: "/d/中文.md" });
    expect(linkAction("sub/a.markdown", "/d")).toEqual({ type: "md", target: "/d/sub/a.markdown" });
  });

  it("其他相对链接 → other（交系统处理）", () => {
    expect(linkAction("a.pdf", "/d")).toEqual({ type: "other", target: "/d/a.pdf" });
  });
});
