export function joinPath(base: string, rel: string): string {
  const parts = `${base}/${rel}`.split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length > 0) out.pop();
      continue;
    }
    out.push(part);
  }
  return `/${out.join("/")}`;
}

function isExternal(src: string): boolean {
  return (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("data:") ||
    src.startsWith("asset://") ||
    src.startsWith("/")
  );
}

export function resolveImageSrcs(html: string, baseDir: string, toUrl: (absPath: string) => string): string {
  return html.replace(/(<img\s[^>]*src=")([^"]*)(")/g, (whole, before: string, src: string, after: string) => {
    if (!src || isExternal(src)) return whole;
    return `${before}${toUrl(joinPath(baseDir, src))}${after}`;
  });
}
