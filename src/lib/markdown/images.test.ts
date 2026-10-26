import { describe, expect, it } from "vitest";
import { joinPath, resolveImageSrcs } from "./images";

describe("resolveImageSrcs", () => {
  const calls: string[] = [];
  const toUrl = (abs: string): string => {
    calls.push(abs);
    return `asset://${abs}`;
  };

  it("相对路径基于 baseDir 解析并经 toUrl 转换", () => {
    calls.length = 0;
    const out = resolveImageSrcs('<p><img src="a.png" alt="" /></p>', "/Users/x/docs", toUrl);
    expect(calls).toEqual(["/Users/x/docs/a.png"]);
    expect(out).toContain('src="asset:///Users/x/docs/a.png"');
  });

  it("../ 上跳一级", () => {
    calls.length = 0;
    resolveImageSrcs('<img src="../img.png">', "/Users/x/docs", toUrl);
    expect(calls).toEqual(["/Users/x/img.png"]);
  });

  it("中文与空格子路径正确拼接", () => {
    calls.length = 0;
    resolveImageSrcs('<img src="子 目录/图 片.png">', "/Users/x/docs", toUrl);
    expect(calls).toEqual(["/Users/x/docs/子 目录/图 片.png"]);
    resolveImageSrcs('<img src="中文/图.png">', "/Users/x/docs", toUrl);
    expect(calls).toContain("/Users/x/docs/中文/图.png");
  });

  it("http/data/绝对路径不经 toUrl", () => {
    calls.length = 0;
    const html = '<img src="https://a.b/c.png"><img src="data:image/png;base64,xx"><img src="/abs.png"><img src="asset:///keep.png">';
    const out = resolveImageSrcs(html, "/Users/x/docs", toUrl);
    expect(calls).toEqual([]);
    expect(out).toContain('src="https://a.b/c.png"');
    expect(out).toContain('src="data:image/png;base64,xx"');
    expect(out).toContain('src="/abs.png"');
    expect(out).toContain('src="asset:///keep.png"');
  });
});

describe("joinPath", () => {
  it("处理 ./ 与 .. 段", () => {
    expect(joinPath("/a/b", "./c.png")).toBe("/a/b/c.png");
    expect(joinPath("/a/b", "../c.png")).toBe("/a/c.png");
    expect(joinPath("/a/b", "../../c.png")).toBe("/c.png");
  });
});
