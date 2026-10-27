// 新建文档的命名规则（纯函数）。重名探测仅供预填/行内提示，
// 最终落盘由 Rust create_text_file 的 create_new 原子语义兜底。

export type NameIssue = "empty" | "invalid" | "exists";

const UNTITLED = "未命名";

// 无扩展名时补 .md；有任意扩展名（含 .md/.markdown 等）则原样保留
export function finalizeName(raw: string): string {
  const name = raw.trim();
  return name.includes(".") ? name : `${name}.md`;
}

export function validateName(raw: string, existing: string[]): NameIssue | null {
  const name = raw.trim();
  if (!name) return "empty";
  if (/[/:]/.test(name)) return "invalid";
  const final = finalizeName(name);
  // macOS 文件系统默认大小写不敏感，重名判断也按不敏感处理
  if (existing.some((n) => n.toLowerCase() === final.toLowerCase())) return "exists";
  return null;
}

// 首个可用的「未命名 N.md」：N 从 1 起，被占用则递增（不回填空洞）
export function nextUntitled(existing: string[]): string {
  const taken = new Set(existing.map((n) => n.toLowerCase()));
  for (let i = 1; ; i++) {
    const name = i === 1 ? `${UNTITLED}.md` : `${UNTITLED} ${i}.md`;
    if (!taken.has(name.toLowerCase())) return name;
  }
}
