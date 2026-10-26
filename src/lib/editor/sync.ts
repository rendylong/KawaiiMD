import type { HeadingLine } from "../types";

export function headingAtLine(headingLines: HeadingLine[], line: number): HeadingLine | null {
  let cur: HeadingLine | null = null;
  for (const h of headingLines) {
    if (h.line <= line) cur = h;
    else break;
  }
  return cur;
}
