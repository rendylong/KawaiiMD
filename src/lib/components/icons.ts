// 图标几何表 + 墨水包围盒测量。
// 两套并存（用户 2026-10-27 裁定）：
// - 树内三图标（folder/fileText/image）：实测墨水盒归一化（统一墨水高 15、中心对齐），
//   icons.test.ts 钉住「归一后墨水框一致」——五轮实测换来的方案，不要回退。
// - 界面/工具栏图标：保持 Lucide 原始几何（不烘 transform），按 Lucide 家族原设计比例渲染，
//   用户明确认为比归一化后更好看。fileText 双用：树内归一，工具栏传 raw。

export type IconDef = { d: string; transform?: string };

export const INK_TARGET_HEIGHT = 15;

export const icons: Record<string, IconDef> = {
  panelLeft: { d: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Zm6 0v14" },
  listTree: { d: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" },
  fileText: {
    d: "M13 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-4-4Z M13 4v4h4 M9 12h6 M9 16h4",
    transform: "translate(1.83 1.83) scale(0.8475)",
  },
  folderOpen: {
    d: "M3 7V5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v2M3 7h18l-2 10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L3 7Z",
  },
  folder: {
    d: "M5 7a2 2 0 0 1 2-2h3.5l2 2H17a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7Z",
    transform: "translate(0.54 0.54) scale(0.9554)",
  },
  image: {
    d: "M5 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6Z M6 15.5l3.5-3.5 3 3 1.5-1.5 4 4 M9.5 9.5a1 1 0 1 0-2 0 1 1 0 0 0 2 0Z",
    transform: "translate(1.83 1.83) scale(0.8475)",
  },
  sun: { d: "M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" },
  moon: { d: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" },
  pencilLine: { d: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" },
  settings2: { d: "M20 7h-9M14 17H5 M10 7a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z M20 17a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z" },
  filePlus: { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z M14 2v4a2 2 0 0 0 2 2h4 M9 15h6 M12 12v6" },
  plus: { d: "M12 5v14 M5 12h14" },
};

// 树内使用、必须墨水归一的图标；其余为界面图标（保持原始几何）
export const TREE_ICONS = ["folder", "fileText", "image"] as const;
export const UI_ICONS = ["panelLeft", "listTree", "folderOpen", "sun", "moon", "pencilLine", "settings2", "filePlus", "plus"] as const;

export type Box = { x: number; y: number; w: number; h: number };

const NUM = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

// 解析 M/L/H/V/A（本项目路径只用这些命令）并采样圆弧，返回路径几何点集。
function pathPoints(d: string): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  let cx = 0;
  let cy = 0;
  const segs = d.match(/[a-zA-Z][^a-zA-Z]*/g) ?? [];
  for (const seg of segs) {
    const cmd = seg[0];
    const n = (seg.slice(1).match(NUM) ?? []).map(Number);
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toLowerCase()) {
      case "m": {
        // moveto 后续坐标对是隐式 lineto（m/M 均如此），必须全部采样
        for (let i = 0; i + 1 < n.length; i += 2) {
          cx = rel ? cx + n[i] : n[i];
          cy = rel ? cy + n[i + 1] : n[i + 1];
          pts.push([cx, cy]);
        }
        break;
      }
      case "l": {
        for (let i = 0; i + 1 < n.length; i += 2) {
          cx = rel ? cx + n[i] : n[i];
          cy = rel ? cy + n[i + 1] : n[i + 1];
          pts.push([cx, cy]);
        }
        break;
      }
      case "h": {
        for (const x of n) {
          cx = rel ? cx + x : x;
          pts.push([cx, cy]);
        }
        break;
      }
      case "v": {
        for (const y of n) {
          cy = rel ? cy + y : y;
          pts.push([cx, cy]);
        }
        break;
      }
      case "a": {
        for (let i = 0; i + 6 < n.length + 0; i += 7) {
          const rx = n[i];
          const ry = n[i + 1];
          const laf = n[i + 3];
          const sf = n[i + 4];
          const x2 = rel ? cx + n[i + 5] : n[i + 5];
          const y2 = rel ? cy + n[i + 6] : n[i + 6];
          const { from, to, cx0, cy0 } = arcAngles(cx, cy, rx, ry, laf, sf, x2, y2);
          const STEPS = 24;
          for (let s = 0; s <= STEPS; s++) {
            const t = from + ((to - from) * s) / STEPS;
            pts.push([cx0 + rx * Math.cos(t), cy0 + ry * Math.sin(t)]);
          }
          cx = x2;
          cy = y2;
        }
        break;
      }
      case "z":
        break;
      default:
        throw new Error(`unsupported path command: ${cmd}`);
    }
  }
  return pts;
}

function arcAngles(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  laf: number,
  sf: number,
  x2: number,
  y2: number
): { from: number; to: number; cx0: number; cy0: number } {
  const phi = 0;
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const num = rx * rx * ry * ry - rx * rx * dy * dy - ry * ry * dx * dx;
  const den = rx * rx * dy * dy + ry * ry * dx * dx;
  const co = Math.sqrt(Math.max(0, num / den));
  const sign = laf === sf ? -1 : 1;
  const cxp = (sign * co * (rx * dy)) / ry;
  const cyp = (-sign * co * (ry * dx)) / rx;
  const cx0 = Math.cos(phi) * cxp - Math.sin(phi) * cyp + (x1 + x2) / 2;
  const cy0 = Math.sin(phi) * cxp + Math.cos(phi) * cyp + (y1 + y2) / 2;
  const a1 = Math.atan2((y1 - cy0) / ry, (x1 - cx0) / rx);
  const a2 = Math.atan2((y2 - cy0) / ry, (x2 - cx0) / rx);
  let delta = a2 - a1;
  if (sf === 1 && delta < 0) delta += 2 * Math.PI;
  if (sf === 0 && delta > 0) delta -= 2 * Math.PI;
  return { from: a1, to: a1 + delta, cx0, cy0 };
}

export const STROKE_HALF = 1.7 / 2;

// 墨水包围盒 = 几何 bbox ± 半笔宽
export function inkBox(d: string): Box {
  const pts = pathPoints(d);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs) - STROKE_HALF;
  const y = Math.min(...ys) - STROKE_HALF;
  return { x, y, w: Math.max(...xs) - Math.min(...xs) + 2 * STROKE_HALF, h: Math.max(...ys) - Math.min(...ys) + 2 * STROKE_HALF };
}

// 统一墨水高度到 INK_TARGET_HEIGHT，几何中心平移到 (12,12)；返回 SVG transform
export function normalizeTransform(box: Box): string {
  const k = INK_TARGET_HEIGHT / box.h;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const tx = 12 - k * cx;
  const ty = 12 - k * cy;
  return `translate(${round(tx)} ${round(ty)}) scale(${round(k, 4)})`;
}

// 应用表内 transform（仅本表生成的 translate/scale 形式）后的墨水框
export function effectiveBox(def: IconDef): Box {
  const b = inkBox(def.d);
  if (!def.transform) return b;
  const n = (def.transform.match(NUM) ?? []).map(Number);
  const [tx, ty, k] = n;
  return { x: b.x * k + tx, y: b.y * k + ty, w: b.w * k, h: b.h * k };
}

function round(v: number, p = 2): number {
  const m = 10 ** p;
  return Math.round(v * m) / m;
}
