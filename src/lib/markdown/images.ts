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

// markdown-it 会把非 ASCII 的 src 输出为百分号编码，拼接前先解码，
// 否则 convertFileSrc 的二次编码会让 asset 协议探测到字面 %XX 文件名。
function decodeSrc(src: string): string {
  try {
    return decodeURIComponent(src);
  } catch {
    return src;
  }
}

export function resolveImageSrcs(html: string, baseDir: string, toUrl: (absPath: string) => string): string {
  return html.replace(/(<img\s[^>]*src=")([^"]*)(")/g, (whole, before: string, rawSrc: string, after: string) => {
    if (!rawSrc || isExternal(rawSrc)) return whole;
    return `${before}${toUrl(joinPath(baseDir, decodeSrc(rawSrc)))}${after}`;
  });
}

export function collectImagePaths(html: string, baseDir: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<img\s[^>]*src="([^"]*)"/g)) {
    const src = m[1];
    if (!src || isExternal(src)) continue;
    out.push(joinPath(baseDir, decodeSrc(src)));
  }
  return out;
}
