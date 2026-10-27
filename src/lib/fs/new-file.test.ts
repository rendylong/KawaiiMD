import { describe, expect, it } from "vitest";
import { finalizeName, nextUntitled, validateName } from "./new-file";

describe("finalizeName", () => {
  it("无扩展名补 .md", () => {
    expect(finalizeName("周报")).toBe("周报.md");
  });

  it("保留已有扩展名（不强制改成 .md）", () => {
    expect(finalizeName("notes.markdown")).toBe("notes.markdown");
  });

  it("首尾空白去除后再判断", () => {
    expect(finalizeName("  周报  ")).toBe("周报.md");
    expect(finalizeName(" a.b ")).toBe("a.b");
  });

  it("点开头的名字视作有扩展名不追加", () => {
    expect(finalizeName(".gitignore")).toBe(".gitignore");
  });
});

describe("validateName", () => {
  it("空白名称报 empty", () => {
    expect(validateName("   ", [])).toBe("empty");
  });

  it("路径分隔符与冒号非法（macOS Finder 保留字符）", () => {
    expect(validateName("a/b", [])).toBe("invalid");
    expect(validateName("a:b", [])).toBe("invalid");
  });

  it("同名判断大小写不敏感且按补后缀后的最终名比较", () => {
    expect(validateName("周报", ["周报.md"])).toBe("exists");
    expect(validateName("周报.MD", ["周报.md"])).toBe("exists");
    expect(validateName("周报", ["周报.txt"])).toBeNull();
  });

  it("合法名称返回 null", () => {
    expect(validateName("2026-10-27 周报", ["周报.md"])).toBeNull();
  });
});

describe("nextUntitled", () => {
  it("空目录从未命名.md 起", () => {
    expect(nextUntitled([])).toBe("未命名.md");
  });

  it("占用后递增", () => {
    expect(nextUntitled(["未命名.md"])).toBe("未命名 2.md");
    expect(nextUntitled(["未命名.md", "未命名 2.md"])).toBe("未命名 3.md");
  });

  it("不回填空洞：只有 2 号被占时仍从 1 起", () => {
    expect(nextUntitled(["未命名 2.md"])).toBe("未命名.md");
  });

  it("大小写不敏感地识别占用", () => {
    expect(nextUntitled(["未命名.MD"])).toBe("未命名 2.md");
  });
});
