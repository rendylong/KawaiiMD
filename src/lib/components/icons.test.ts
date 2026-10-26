import { describe, expect, it } from "vitest";
import { INK_TARGET_HEIGHT, effectiveBox, icons, inkBox, normalizeTransform } from "./icons";

const ALL = Object.keys(icons);

describe("图标墨水几何（根因：手工 path 无测量导致大小不一）", () => {
  it("实测原始墨水框——留档证据", () => {
    for (const name of ALL) {
      const b = inkBox(icons[name].d);
      console.log(`raw ink box [${name}]: x=${b.x.toFixed(2)} y=${b.y.toFixed(2)} w=${b.w.toFixed(2)} h=${b.h.toFixed(2)}`);
    }
    expect(true).toBe(true);
  });

  it("归一 transform 后：全部图标墨水高度一致且几何中心对齐", () => {
    for (const name of ALL) {
      const def = icons[name];
      const b = effectiveBox(def);
      console.log(`effective box [${name}]: h=${b.h.toFixed(3)} cx=${(b.x + b.w / 2).toFixed(3)} cy=${(b.y + b.h / 2).toFixed(3)}`);
      expect(Math.abs(b.h - INK_TARGET_HEIGHT), `${name} 高度 ${b.h}`).toBeLessThan(0.05);
      expect(Math.abs(b.x + b.w / 2 - 12), `${name} cx`).toBeLessThan(0.05);
      expect(Math.abs(b.y + b.h / 2 - 12), `${name} cy`).toBeLessThan(0.05);
    }
  });

  it("表内 transform 与 normalizeTransform 计算一致（防手工漂移）", () => {
    for (const name of ALL) {
      const def = icons[name];
      expect(def.transform).toBe(normalizeTransform(inkBox(def.d)));
    }
  });

  it("解析器采样 moveto 后续隐式 lineto（check 曾漏采第二对坐标）", () => {
    // m4 12 5 5 → 两点 (4,12) 与 (9,17)，y 跨度 6→17
    const b = inkBox("m4 12 5 5L20 6");
    expect(b.h).toBeCloseTo(11 + 2 * 0.85, 2);
  });
});
