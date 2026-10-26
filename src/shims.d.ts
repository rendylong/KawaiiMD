declare module "markdown-it-task-lists" {
  const taskLists: (md: import("markdown-it").MarkdownIt) => void;
  export default taskLists;
}

declare module "markdown-it-footnote" {
  const footnote: (md: import("markdown-it").MarkdownIt) => void;
  export default footnote;
}
