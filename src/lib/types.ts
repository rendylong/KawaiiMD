export type Theme = "light" | "dark";

export type TocItem = { id: string; level: number; text: string };

export type HeadingLine = TocItem & { line: number };

export type Doc = { html: string; toc: TocItem[]; headingLines: HeadingLine[] };

export type DirEntry = { name: string; isDir: boolean };

export type FileKind = "markdown" | "image" | "other";
