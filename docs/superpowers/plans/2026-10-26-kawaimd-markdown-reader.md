# 墨阅（MoYue）Markdown 阅读器 App 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建仅 macOS 的本地 markdown 阅读器/编辑器桌面应用「墨阅」：渲染 GFM + mermaid、文件夹树、编辑写回、自动刷新。

**Architecture:** Tauri v2（Rust 提供 fs 命令/文件监听/系统集成）+ Svelte 5 前端。渲染核心（markdown-it → HTML → 图片重写 → mermaid/高亮后处理）为纯 TS 模块，阅读视图与编辑预览共用一条管线。

**Tech Stack:** Tauri 2.x、Svelte 5（runes）、Vite、TypeScript strict、markdown-it + 插件、highlight.js（lib/common）、mermaid（动态 import）、CodeMirror 6、notify-debouncer-mini、pnpm。

**Spec:** `docs/superpowers/specs/2026-10-26-markdown-reader-app-design.md`

## Global Constraints

- 平台 macOS arm64；Node ≥ 20；pnpm；Rust stable + Xcode CLT
- 应用标识全配置统一：productName `墨阅`，identifier `com.rendy.moyue`（若脚手架工具拒绝 unicode，则 productName 用 `MoYue`、窗口标题用「墨阅」，并在提交信息注明）
- 界面文案一律 zh-CN 且集中在 `src/lib/ui-strings.ts`，组件内禁止散落硬编码文案
- **设计已锁定**（2026-10-26 设计评审 + 用户可视化确认）：配色 **B 墨青**；正文**宋体衬线栈** 17px / 行高 1.8 / 栏宽 42em；编辑分栏默认 50%（可拖 25–75%，持久化，**不做折叠**）；**文件树侧栏与目录（TOC）面板支持折叠/展开**（工具栏按钮 + 持久化 + 窄窗自动隐藏）；快捷键 ⌘O / ⇧⌘O / ⌘E / ⌘T / ⌘S / Esc / 树方向键；最小窗口 720×480；focus 环 accent 2px；图标按钮 aria-label 中文
- UTF-8 only：任何读取失败（非 UTF-8/无权限/不存在）的错误信息必须包含文件绝对路径
- 安全：不配置全盘 asset/fs scope；图片访问通过运行时 `grant_asset_scope` 对已打开目录授权
- 测试命令：前端 `pnpm vitest run`（jsdom 环境），Rust `cd src-tauri && cargo test`
- 每个 UI 任务额外门槛：`pnpm check`（svelte-check）零错误、`pnpm build` 成功
- 每个任务最后一步 commit；提交信息 conventional commits（feat/chore/test）
- 包体积 < 15MB；签名 ad-hoc（`signingIdentity: "-"`）
- 设计文档 §8 留白项（CRLF 保留、外部删除的树刷新时机等）实现者可自行决定，不需请示

## Review Focus

以下 5 类输入在本计划任务内有对应测试钉住（括号内为归属任务）：

1. **非法 UTF-8 文件** → 读取报错且错误含文件路径，应用显示错误页不崩溃（T3、T6）
2. **未闭合代码块的坏 markdown** → 优雅降级渲染不抛异常（T4）
3. **mermaid 语法错误** → 该块降级为源码+错误提示，页面其余部分正常（T8）
4. **中文/空格/URL 编码的相对图片路径** → 正确解析（T5）
5. **当前文件被外部删除** → fs-change(remove) 触发错误态而非崩溃（T11）

---

### Task 1: 脚手架与工具链（M1）

**Files:**
- Create: 仓库根的全部脚手架文件（create-tauri-app svelte-ts 模板）
- Create: `.gitignore`（模板自带，追加 `src-tauri/target` 已含则忽略）

**Interfaces:**
- Produces: 可构建的空应用；`pnpm dev`（Vite）、`pnpm tauri dev`、`pnpm build`、`pnpm check`、`cd src-tauri && cargo check` 全部可用

- [ ] **Step 1: 用 create-tauri-app 生成项目到当前目录**

仓库根已有 `docs/`，脚手架生成到临时子目录再上移：

```bash
cd /Users/rendy/markdownreader
pnpm create tauri-app@latest scaffold --template svelte-ts --manager pnpm --identifier com.rendy.moyue --yes
# 将 scaffold/ 下全部内容（含点文件）移动到仓库根，删除 scaffold/，保留 docs/
```

- [ ] **Step 2: 统一应用标识与安全基线**

修改 `src-tauri/tauri.conf.json`：`productName: "墨阅"`（被工具拒绝则 `MoYue`，见 Global Constraints）、`identifier: "com.rendy.moyue"`、默认窗口 1100×750、title `墨阅`；`app.security.csp` 设为 `default-src 'self'; img-src 'self' asset: http://asset.localhost; style-src 'self' 'unsafe-inline'`（R4/D7）。

- [ ] **Step 3: 验证构建链**

Run: `pnpm install && pnpm build && pnpm check && cd src-tauri && cargo check`
Expected: 全部成功，零错误

- [ ] **Step 4: git init 并首次提交**

```bash
git init && git add -A && git commit -m "chore: scaffold tauri2 + svelte5 app"
```

---

### Task 2: 主题系统与界面骨架（M2 部分）

**Files:**
- Create: `src/app.css`、`src/lib/ui-strings.ts`、`src/lib/settings.svelte.ts`、`src/lib/theme.css`
- Modify: `src/App.svelte`（替换模板内容）、`src/main.ts`（引入 app.css/theme.css）

**Interfaces:**
- Produces:
  - `settings.svelte.ts`：`settings: { themeMode: 'system'|'light'|'dark' }`（持久化 key `moyue.theme`）；`setThemeMode(m)`；`resolvedTheme(): 'light'|'dark'`（system 时读 matchMedia，含变更监听）；`recents: string[]`（key `moyue.recent`，最多 10 条）；`pushRecent(path)`（去重置顶并持久化）
  - `ui-strings.ts`：`export const S = { appName: '墨阅', openFile: '打开文件', openFolder: '打开文件夹', theme: '主题', … }`，后续任务只增不改
  - 布局骨架：工具栏（左：墨滴 logo +「墨阅」；**中央：当前文件名**（次级文本，点击 reveal in Finder，决策 1.1/1A）；右：文件树折叠、TOC 折叠、打开文件、打开文件夹、主题切换、阅读/编辑切换，图标按钮均带中文 aria-label）+ 三栏 grid（侧栏 240px / 主区 1fr / TOC 220px）；快捷键 ⌘O/⇧⌘O/⌘E/⌘T 挂载（决策 6.2）
  - theme.css 按锁定值实现（决策 5.1=B 墨青、4.1、4.2）：
    - 亮：`--bg #FAFAF7→墨青版 #FAFAF9 / --bg-side #F1F3F2 / --fg #191D1C / --fg-2 #56605D / --fg-3 #828C89 / --line #E2E7E5 / --accent #237A6F / --accent-weak #E4F0EE / --code-bg #F1F4F3 / --sel rgba(35,122,111,.20)`
    - 暗：`--bg #151817 / --bg-side #1B1F1E / --fg #E3E8E6 / --fg-2 #A0A9A6 / --fg-3 #6A7371 / --line #2C3331 / --accent #56B3A4 / --accent-weak #1F312D / --code-bg #202523 / --sel rgba(86,179,164,.28)`
    - 排版 token：正文 `"Songti SC","Noto Serif CJK SC",serif` 17px / 行高 1.8 / 段距 0.9em / `max-width: 42em`；UI/侧栏/工具栏/TOC 13px `"PingFang SC",system-ui`；标题用 UI 字体 h1 28px·700·上 2.2em 下 0.6em、h2 22px·600·上 1.8em 下 0.5em、h3 19px·600·上 1.5em 下 0.4em；代码块 13.5px `ui-monospace`；标题上方间距恒大于下方
    - 动效仅两处（决策 4.3）：文件切换正文 120ms ease-out 淡入、mermaid 渲染完成淡入，无其他装饰动效；focus 环 `--accent` 2px

- [ ] **Step 1: 安装测试设施并写失败测试**

```bash
pnpm add -D vitest jsdom
```
`vitest.config.ts`：environment `jsdom`。测试 `src/lib/settings.test.ts`：mock `localStorage` 与 `matchMedia`——`setThemeMode('dark')` 后读取 `moyue.theme === 'dark'` 且 `resolvedTheme() === 'dark'`；`pushRecent` 去重置顶、超过 10 条截断。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 settings.svelte.ts、theme.css、App.svelte 骨架**

`resolvedTheme` 在 system 模式下经 `matchMedia('(prefers-color-scheme: dark)')` 计算，并在 `App.svelte` 挂载时把结果写入 `document.documentElement.dataset.theme`；手动切换三态循环 system→light→dark。

- [ ] **Step 4: 运行测试与门槛**

Run: `pnpm vitest run && pnpm check && pnpm build`
Expected: 全部 PASS

- [ ] **Step 5: Commit** `feat: theme system and app shell layout`

---

### Task 3: Rust fs 命令层（M2/M3 地基）

**Files:**
- Create: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`（注册命令）、`src-tauri/Cargo.toml`（dev-dependencies: tempfile）

**Interfaces:**
- Produces（纯函数部分供测试，`#[tauri::command]` 为薄包装）:
  - `read_text_file(path: String) -> Result<String, String>`，实现 `read_text_impl(p: &Path) -> Result<String, String>`；错误格式 `读取失败(不存在/非UTF-8/无权限): {绝对路径}`
  - `write_text_file(path: String, contents: String) -> Result<(), String>` + `write_text_impl`
  - `list_dir(path: String) -> Result<Vec<DirEntry>, String>` + `list_dir_impl`；`DirEntry { name: String, is_dir: bool }`（serde rename_all camelCase → 前端 `{name, isDir}`）
  - `grant_asset_scope(app: AppHandle, dir: String) -> Result<(), String>`：`app.asset_protocol_scope().allow_directory(dir, true)`

- [ ] **Step 1: 写失败测试（commands.rs 内 #[cfg(test)）**

`read_text_impl`：正常读取；UTF-8 非法字节（`\xFF\xFE` 前缀）→ Err 且消息含路径；不存在 → Err 含路径。`write_text_impl`：roundtrip 写后读一致。`list_dir_impl`：tempfile 目录含 `a.md`、`sub/`、`b.txt` → 返回 3 项且 `sub` 的 `is_dir == true`。

- [ ] **Step 2: `cargo test` 确认失败**（Expected: 编译 FAIL）

- [ ] **Step 3: 实现命令并在 lib.rs 注册**（`tauri::generate_handler![read_text_file, write_text_file, list_dir, grant_asset_scope]`；`tauri.conf.json` 启用 `app.assetProtocol.enable: true`，scope 留空数组——运行时授权）

- [ ] **Step 4: `cargo test` PASS；`cargo check` 零警告**

- [ ] **Step 5: Commit** `feat(rust): fs commands with utf-8 guard`

---

### Task 4: 渲染核心——markdown→HTML（M2）

**Files:**
- Create: `src/lib/types.ts`、`src/lib/markdown/render.ts`、`src/lib/markdown/slug.ts`
- Test: `src/lib/markdown/render.test.ts`

**Interfaces:**
- Consumes: 无（纯 TS）
- Produces:
  - `types.ts`：`Theme`、`TocItem = {id; level; text}`、`HeadingLine = TocItem & {line: number}`、`Doc = {html: string; toc: TocItem[]; headingLines: HeadingLine[]}`、`DirEntry = {name: string; isDir: boolean}`
  - `renderMarkdown(src: string): Doc`——html 已注入标题 id；`toc`/`headingLines` 来自 token 遍历
  - `slug.ts`：`slugify(text: string): string`（空白→`-`、小写 ASCII、保留 CJK、去标点；`dedupe` 后缀 `-1`）

- [ ] **Step 1: 安装依赖并写失败测试**

```bash
pnpm add markdown-it @types/markdown-it markdown-it-task-lists markdown-it-footnote @mdit/plugin-alert
```
测试断言：GFM 表格生成 `<table>`；任务列表 `- [ ]` 生成 checkbox；脚注生成段落；`> [!NOTE]` 生成 alert 容器（class 含 `markdown-alert`）；`# 中文 标题` 的 id 为 slug 结果；重复标题第二个 id 带后缀；**未闭合 ``` 代码块不抛异常且渲染为 code**；mermaid 块保留为 `language-mermaid` 的 `code` 元素。

- [ ] **Step 2: `pnpm vitest run` 确认 FAIL**（模块不存在）

- [ ] **Step 3: 实现 render.ts**

模块级单例 markdown-it（`html: false`、`linkify: true`）+ 三个必装插件；`render.rule` 为 heading token 写入 `slugify` id 并顺带收集 `token.map[0]` 为 `line`。

- [ ] **Step 4: `pnpm vitest run` PASS**

- [ ] **Step 5: Commit** `feat(core): markdown renderer with toc and heading ids`

---

### Task 5: 渲染核心——相对图片重写（M2）

**Files:**
- Create: `src/lib/markdown/images.ts`
- Test: `src/lib/markdown/images.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `resolveImageSrcs(html: string, baseDir: string, toUrl: (absPath: string) => string): string`——对 `<img src>` 相对路径基于 baseDir 解析为绝对路径后经 `toUrl` 转换；`http(s)://`、`data:`、`asset://`、以 `/` 开头的绝对路径原样保留

- [ ] **Step 1: 写失败测试**

断言：`![](a.png)` + baseDir `/Users/x/docs` → `toUrl` 收到 `/Users/x/docs/a.png`；`![](../img.png)` → `/Users/x/img.png`；`![](子 目录/图 片.png)` 与 `![](中文/图.png)` 正确拼接；`https://`、`data:image/...`、`/abs.png` 不经 `toUrl`。用 DOMParser 或正则均可，但测试必须覆盖 src 含引号与空格的情形。

- [ ] **Step 2: 确认 FAIL → Step 3: 实现**（自实现 posix `joinPath`：切分 `/`、处理 `.`/`..`；不引入 path 库）

- [ ] **Step 4: `pnpm vitest run` PASS → Step 5: Commit** `feat(core): relative image src resolver`

---

### Task 6: 应用状态与打开文件流（M2）

**Files:**
- Create: `src/lib/state/app.svelte.ts`、`src/lib/fs/tauri.ts`、`src/lib/markdown/pipeline.ts`、`src/lib/components/ReaderView.svelte`、`src/lib/components/Welcome.svelte`、`src/lib/components/Toolbar.svelte`（替换 Task 2 占位）
- Test: `src/lib/state/app.test.ts`

**Interfaces:**
- Consumes: Task 3 命令、Task 4/5 渲染、Task 2 settings
- Produces:
  - `fs/tauri.ts`：`invoke` 的类型化包装 `readTextFile/writeTextFile/listDir/grantAssetScope`（参数与返回和 Task 3 完全一致）、`pickFile(): Promise<string|null>`、`pickFolder(): Promise<string|null>`（@tauri-apps/plugin-dialog，filter `.md/.markdown/.mkd/.mdx`）
  - `app.svelte.ts`：`app = $state({ currentPath: string|null, workspaceRoot: string|null, mode: 'read'|'edit', doc: Doc|null, error: string|null })`；`openFile(path)`：grant asset scope → readTextFile → renderMarkdown → resolveImageSrcs(html, dirname, convertFileSrc) → 组装 doc → pushRecent；任何失败 → `app.error`（含路径）；`openFolder(path)` 设 workspaceRoot 并 grant scope
  - `pipeline.ts`：`mountDoc(container: HTMLElement, src: string, fileDir: string, theme: Theme): Promise<void>` 单一异步入口——renderMarkdown → resolveImageSrcs → innerHTML → mermaid 后处理（Task 8）→ 复制按钮（Task 9）；ReaderView 与 EditorView 共用；任何依赖最终布局的操作（滚动恢复、TOC 偏移计算）在 `await mountDoc(...)` 之后执行（R1/D4）
  - `ReaderView.svelte`：挂载 `app.doc.html` 到容器，**打开期间正文区显示骨架行、内容就绪替换**（决策 2.1），文件切换应用 120ms 淡入；工具栏中央文件名与状态栏路径同步 `app.currentPath`；`Welcome.svelte`：空态三入口（打开文件/打开文件夹/最近文件）

- [ ] **Step 1: 写失败测试**

mock `fs/tauri.ts` 全部函数（vi.mock）：`openFile('/d/a.md')` 成功路径 → `app.currentPath === '/d/a.md'`、`app.doc.toc` 长度正确、`grantAssetScope` 以 `/d` 调用、`pushRecent('/d/a.md')`；`openFile` 读取抛错 → `app.error` 含 `/d/a.md`。

- [ ] **Step 2: 确认 FAIL → Step 3: 实现**（@tauri-apps/api、@tauri-apps/plugin-dialog 前端依赖 + tauri.conf capabilities 增加 dialog:default；`dirname` 自实现或复用 Task 5 joinPath 的逆运算）

- [ ] **Step 4: `pnpm vitest run && pnpm check && pnpm build` PASS → Step 5: Commit** `feat: open-file flow with reader and welcome views`

---

### Task 7: 文件树（M3）

**Files:**
- Create: `src/lib/components/FileTree.svelte`、`src/lib/fs/entries.ts`
- Test: `src/lib/fs/entries.test.ts`

**Interfaces:**
- Consumes: `listDir`、`openFile`、`app`
- Produces:
  - `entries.ts`：`classifyEntry(name: string, isDir: boolean): 'dir'|'markdown'|'image'|'other'`（markdown 扩展名集 `.md/.markdown/.mkd/.mdx` 大小写不敏感；image = png/jpg/jpeg/gif/webp/svg/avif）；`sortEntries(entries: DirEntry[]): DirEntry[]`（dir → markdown → image → other，组内 `localeCompare('zh')`）
  - `FileTree.svelte`：props `{root: string, activePath: string|null}`；根 = `app.workspaceRoot ?? dirname(app.currentPath)`；展开节点时懒加载 `listDir`，**加载行内 spinner 延迟 200ms 显示**（决策 2.1）；文件夹/文件类型图标（内联 SVG 三套）；点击 md → `openFile`；当前文件高亮 class；**侧栏可折叠**：工具栏按钮切换 + 持久化 `moyue.tree-collapsed`，窄窗 ≤640px 自动隐藏（决策 6.1/8.1）；树节点 ↑↓↔↵ 键盘导航（决策 6.2）

- [ ] **Step 1: 写失败测试**（entries 纯函数：分类大小写、排序分组与中文排序）

- [ ] **Step 2: 确认 FAIL → Step 3: 实现**

- [ ] **Step 4: `pnpm vitest run && pnpm check && pnpm build` PASS → Step 5: Commit** `feat: lazy file tree sidebar`

---

### Task 8: Mermaid 渲染（M4）

**Files:**
- Create: `src/lib/markdown/mermaid.ts`
- Modify: `src/lib/markdown/pipeline.ts`（渲染后调用）
- Test: `src/lib/markdown/mermaid.test.ts`

**Interfaces:**
- Consumes: `Theme`
- Produces:
  - `mapMermaidTheme(t: Theme): 'default'|'dark'`（纯函数）
  - `renderMermaidBlocks(container: HTMLElement, theme: Theme): Promise<void>`：查找 `pre > code.language-mermaid`；首次调用动态 `import('mermaid')` 并缓存（`initialize({startOnLoad:false})`）；**渲染期间该块显示近似尺寸骨架占位（避免布局跳动），完成后 120ms 淡入替换**（决策 2.1/4.3）；逐块 `mermaid.render(id, code)` 成功→`pre` 替换为 svg 容器；失败→`pre` 前插入错误提示 div（class `mermaid-error`，文案 `S.mermaidError`）并保留源码；已在渲染/已渲染的块跳过（data 属性标记）

- [ ] **Step 1: 写失败测试**（vi.mock 动态 `import('mermaid')`）：容器含 2 个 mermaid 块 → render 被调 2 次、成功块被替换；mock render reject → 块保留且有 `.mermaid-error`；主题映射断言。

- [ ] **Step 2: 确认 FAIL → Step 3: 实现**（`pnpm add mermaid`；在 `mountDoc` 内、innerHTML 设置后调用 `renderMermaidBlocks(container, theme)`，theme 取 mountDoc 入参；编辑预览的 500ms 防抖由 Task 12 的 EditorView 控制，不在 pipeline 内）

- [ ] **Step 4: `pnpm vitest run && pnpm check && pnpm build` PASS → Step 5: Commit** `feat: mermaid rendering with error fallback`

---

### Task 9: 代码高亮与复制按钮（M4）

**Files:**
- Create: `src/lib/markdown/highlight.ts`
- Modify: `src/lib/markdown/render.ts`（markdown-it `highlight` 选项）、`src/lib/markdown/pipeline.ts`（调用 addCopyButtons）、`src/app.css`（引入 hljs 明暗两套主题 CSS，按 `data-theme` 切换）
- Test: `src/lib/markdown/highlight.test.ts`

**Interfaces:**
- Produces:
  - `mdHighlight(code: string, lang: string): string`——highlight.js `lib/common` 子集，未知语言退化为转义文本 + `language-xxx` class；mermaid 语言直接返回转义（不走 hljs）
  - `addCopyButtons(container: HTMLElement): void`——为每个 `pre` 注入按钮（class `copy-btn`，文案 `S.copy`/成功后 `S.copied` 1.5s），事件委托读 `pre code.innerText` 写剪贴板

- [ ] **Step 1: 写失败测试**：`mdHighlight('const a=1','ts')` 输出含 `hljs` class；`mdHighlight('graph TD','mermaid')` 不含 hljs 且为转义文本；jsdom 中 `addCopyButtons` 后点击按钮 → mock `navigator.clipboard.writeText` 收到代码文本。

- [ ] **Step 2: 确认 FAIL → Step 3: 实现**（`pnpm add highlight.js`）

- [ ] **Step 4: `pnpm vitest run && pnpm check && pnpm build` PASS → Step 5: Commit** `feat: code highlight and copy buttons`

---

### Task 10: TOC 面板（M4）

**Files:**
- Create: `src/lib/components/TocPanel.svelte`、`src/lib/dom/scroll.ts`
- Test: `src/lib/dom/scroll.test.ts`

**Interfaces:**
- Consumes: `app.doc.toc`、heading id
- Produces:
  - `scroll.ts`：`activeFromOffsets(offsets: number[], scrollTop: number): number`（返回最后一个 ≤ scrollTop 的索引，-1 起步）；`restoreScroll(container: HTMLElement, headingId: string|null): void`（Task 12 复用）
  - `TocPanel.svelte`：渲染 `toc`（按 level 缩进），点击项 `scrollIntoView({behavior:'smooth'})`；容器滚动时经 `activeFromOffsets` 高亮当前项（rAF 节流）；**面板可由工具栏按钮折叠 + 持久化 `moyue.toc-collapsed`，≤820px 自动隐藏**（决策 6.1/8.1）

- [ ] **Step 1: 写失败测试**（activeFromOffsets 边界：空数组、scrollTop 在两标题间、超过最后标题）

- [ ] **Step 2: FAIL → Step 3: 实现 → Step 4: `pnpm vitest run && pnpm check && pnpm build` PASS → Step 5: Commit** `feat: toc panel with active heading`

---

### Task 11: 文件监听与自动刷新（M5）

**Files:**
- Create: `src-tauri/src/watcher.rs`、`src/lib/state/reload.ts`
- Modify: `src-tauri/src/lib.rs`、`src/lib/state/app.svelte.ts`（打开文件/文件夹时挂载 watcher；删除→错误态）、`src/lib/fs/tauri.ts`（`onFsChange(cb)`）
- Test: `src-tauri/src/watcher.rs`（内嵌）、`src/lib/state/reload.test.ts`

**Interfaces:**
- Produces:
  - Rust `watch_paths(app: AppHandle, paths: Vec<String>) -> Result<(), String>`：内部 `start_watcher(paths, on_event) -> Result<RecommendedWatcher, String>`（notify-debouncer-mini 200ms）；事件经 `app.emit("fs-change", { path, kind, mtime })`，`kind: 'modify'|'remove'|'create'`，`mtime` 为源文件当前修改时间（ms）；static `Mutex<HashSet<PathBuf>>` 防重复挂载；**监听范围 = 当前文件 + 其父目录**（R3/D6 收敛，工作区不做全树监听，树内其他变更靠懒加载/切换刷新）
  - `reload.ts`：`decideReload(kind: FsKind, isDirty: boolean, savedMtime?: number, eventMtime?: number): 'reload'|'ask'|'error'|'ignore'`（modify+干净→reload；modify+dirty→ask；remove→error；create→ignore；**savedMtime===eventMtime→ignore**，抑制 ⌘S 自写回环，R2/D5）；`debounce300(fn)` 导出复用
  - 前端：reader 模式 reload = 记录当前 heading id → `openFile` 重入（内部 `await mountDoc`）→ `restoreScroll`；dirty 的 ask 对话框 UI 在 Task 12 编辑器就绪后接线，本任务先暴露 `app.conflictPath` 状态位

- [ ] **Step 1: 写失败测试**

Rust：tempdir + `start_watcher` + channel，写入/删除文件 2s 内收到对应 kind（载荷含 mtime）。前端：`decideReload` 七断言（四象限 + mtime 相等→ignore + mtime 不等→按象限 + create→ignore）；`debounce300` 只执行最后一次（vi.useFakeTimers）。

- [ ] **Step 2: 确认 FAIL → Step 3: 实现**（Cargo 加 notify-debouncer-mini；前端 `listen('fs-change')`）

- [ ] **Step 4: `cd src-tauri && cargo test` + `pnpm vitest run && pnpm check && pnpm build` PASS → Step 5: Commit** `feat: fs watcher with auto reload`

---

### Task 12: 编辑模式与滚动同步（M6）

**Files:**
- Create: `src/lib/components/EditorView.svelte`、`src/lib/editor/sync.ts`
- Modify: `src/App.svelte`（mode 切换渲染 Reader/Editor）、`src/lib/ui-strings.ts`、`src/lib/state/app.svelte.ts`（conflict 对话框接线）
- Test: `src/lib/editor/sync.test.ts`

**Interfaces:**
- Consumes: Task 11 `conflictPath`/`decideReload`、Task 6 pipeline、Task 10 `restoreScroll`
- Produces:
  - `sync.ts`：`headingAtLine(headingLines: HeadingLine[], line: number): TocItem|null`（最大 `line ≤` 输入行的标题；空数组→null）
  - `EditorView.svelte`：左右分栏（CM6 | 预览复用 `mountDoc`，500ms 防抖在 EditorView 控制）；**分栏默认 50%，分隔条可拖 25–75%（宽度持久化 `moyue.split`，双击复位 50%）**（决策 7.1；用户更正：编辑分栏不做折叠/布局三态）；CM6 扩展含 `Mod-s` keymap → 保存；`dirty = doc ≠ 保存快照`；保存 = `writeTextFile` + 快照更新 + mtime 基线更新（写盘失败走 T6 的 `setError` 模式，错误含路径）；滚动同步：CM onScroll → 首可见行 → `headingAtLine` → 预览滚到该 id（程序滚动 100ms 内忽略反向事件）；冲突对话框（重载外部版 = openFile 重入；保留我的 = 清 conflictPath，保持编辑内容）；窗口 `onCloseRequested` dirty 时经 dialog 确认

- [ ] **Step 1: 写失败测试**（headingAtLine：命中/低于首标题/超出末标题/空数组；dirty 判定纯函数 `isDirty(snapshot, current)` 若抽出则一并测）

- [ ] **Step 2: FAIL → Step 3: 实现**（`pnpm add @codemirror/state @codemirror/view @codemirror/commands @codemirror/lang-markdown`；capabilities 增加 dialog 已有、opener 不需要）

- [ ] **Step 4: `pnpm vitest run && pnpm check && pnpm build` PASS → Step 5: Commit** `feat: editor mode with heading sync and save`

---

### Task 13: 系统集成（M7）

**Files:**
- Modify: `src-tauri/tauri.conf.json`（macOS document types：`.md/.markdown/.mkd/.mdx`）、`src-tauri/Cargo.toml` + `lib.rs`（tauri-plugin-single-instance）、`src/lib/fs/tauri.ts`（`onOpenFile(cb)` 监听）、`src/lib/components/Welcome.svelte`（最近文件点击可开）、`src/App.svelte`（drag-drop）
- Test: 手动验证（无自动化），但 `cargo check`/`pnpm build` 须过

**Interfaces:**
- Produces: 单实例二次打开文件 → `app.emit("open-file", {path})` → 前端 `openFile`；窗口拖放（`onDragDropEvent` drop 单文件→openFile、目录→openFolder）；Welcome 最近文件列表渲染 `settings.recents` 可点击；**启动恢复上次会话**——`settings.svelte.ts` 增加 `session: {file: string|null, folder: string|null}`（key `moyue.session`，`persistSession()` 在 openFile/openFolder 时更新），`App.svelte` 挂载时若 `session.file` 存在且可读则 `openFile`，同时恢复 `workspaceRoot`，失败（文件已移动/删除）则落到 Welcome 空态

- [ ] **Step 1: 配置与实现**（single-instance 回调解析 `std::env::args` 尾部路径；启动恢复逻辑在 `settings.test.ts` 补 session 持久化两条断言）
- [ ] **Step 2: `cargo check && pnpm check && pnpm build` PASS**
- [ ] **Step 3: Commit** `feat: file association, single instance, drag-drop, recents`

---

### Task 14: Lightbox 与非 markdown 文件（M7）

**Files:**
- Create: `src/lib/components/Lightbox.svelte`
- Modify: `src/lib/components/FileTree.svelte`（image → `app.lightboxPath`；other → opener reveal）、`src/lib/state/app.svelte.ts`（`lightboxPath: string|null`）、`src/lib/fs/tauri.ts`（`revealInFinder`）

**Interfaces:**
- Produces: `Lightbox.svelte`：全屏遮罩 + 图片（`convertFileSrc` URL），Esc/点击遮罩关闭，滚轮 1x/2x 缩放切换；非 md/非图片文件点击 → `revealInFinder`（@tauri-apps/plugin-opener，capabilities 加 opener:allow-reveal-item-in-dir）

- [ ] **Step 1: 实现（组件逻辑简单，jsdom 测 Esc 关闭一条即可，或依赖 `pnpm check` 门槛）**
- [ ] **Step 2: `pnpm vitest run && pnpm check && pnpm build` PASS → Step 3: Commit** `feat: lightbox and external file handling`

---

### Task 15: 打包与验收（M8）

**Files:**
- Modify: `src-tauri/tauri.conf.json`（bundle：dmg、`signingIdentity: "-"`）
- Create: `MANUAL-QA.md`（验收清单）、`README.md`（构建说明，zh-CN）

**Interfaces:**
- Consumes: 全部
- Produces: 可分发 dmg + 验收清单

- [ ] **Step 1: 配置并构建**

Run: `pnpm tauri build`
Expected: 成功产出 dmg；`du -sh src-tauri/target/release/bundle/macos/*.app` < 15MB，超了则在提交信息列出排查结论（嫌疑：mermaid/hljs 全量包）

- [ ] **Step 2: 写 MANUAL-QA.md**

从 spec §7 逐条转为可勾选清单：双击 .md 冷启动 ≤2s、热启动 ≤1s；100KB 文档滚动流畅；5 张 mermaid ≤2s 且明暗联动；外部修改 ≤0.5s 刷新且滚动保持；⌘S 落盘一致重开验证；亮暗切换无闪白；非法 UTF-8/未闭合代码块/mermaid 语法错误/外部删除四类降级；编辑冲突对话框两分支；文件关联双击、单实例转发、拖放、最近文件。

- [ ] **Step 3: Commit** `chore: bundle config and qa checklist`

---

## 任务与里程碑对照

T1→M1；T2+T6→M2；T3+T7→M3；T8+T9+T10→M4；T11→M5；T12→M6；T13+T14→M7；T15→M8

---

# Eng Review 记录（plan-eng-review · 2026-10-26）

Target（固定）：`docs/superpowers/plans/2026-10-26-moyue-markdown-reader.md`（本文件）；Spec：`docs/superpowers/specs/2026-10-26-markdown-reader-app-design.md`。

## Scope Challenge

**A. 评估**（surface-check 均已验证）：

- REALITY: premise-table pass — create-tauri-app 非交互 flags（v2.tauri.app/start/create-project、github.com/tauri-apps/create-tauri-app）；模板已升 Svelte 5（release notes）；Svelte 5 允许 `export const obj = $state({...})` 导出、禁止可重赋值导出（svelte.dev/docs/svelte/$state）；`Manager::asset_protocol_scope() → fs::Scope::allow_directory(path, recursive)`（docs.rs tauri 2.12.5，需默认 feature `protocol-asset`）；`bundle.fileAssociations`（v2.tauri.app/reference/config）。markdown-it 插件族与 md-reader 生产依赖一致（仓库 package.json 实抓）。CM6/mermaid 为 Layer 1 既有物。unverified=0。
- REALITY: already-done n/a — greenfield（尚无 git 仓库与代码，T1 才 init）。
- REALITY: surface-check pass — 计划点名的命令/API 逐一验证如上；无 miss。
- REALITY: binding-decisions pass — 设计文档全部约束决策（UTF-8 only、ad-hoc 签名、墨阅/com.rendy.moyue、v1 无 tabs、会话恢复）均在计划 Global Constraints/任务中承载，无被覆盖或冲突。
- REALITY: numbers pass — 验收数值（≤2s/≤1s/≤0.5s/<15MB）均 [estimated]（来自 spec §7，验收时实测）；无 [measured] 假冒。
- REALITY: deferred-asks pass — 本计划无关联 issue；P2 清单即显式延期项，已在 spec §2。
- REALITY: pr-count n/a — 单分支顺序实施（Native 执行建议单 wave），无拆 PR 计划。

**事实修正**（不改行为，记录即可）：T13 文件关联落地为 `tauri.conf.json → bundle.fileAssociations`（ext: md/markdown/mkd/mdx，role: `Viewer`）；T3 `grant_asset_scope` 依赖 tauri crate 默认 feature `protocol-asset`（脚手架默认开启）。

**B. 复杂度门**：触发（~25 文件、多服务）。功能削减提议：无（范围已经设计文档逐条批准，无可延期项）。结构：D3 → **A) Original arrangement**（用户批准，文件与任务 1:1）。

Scope record: `feature answers: 无削减; structure: A (D3); accepted scope: 原计划范围不变; pending remedies: R1–R4`。结论：**scope accepted as-is**。

## Decision ledger

### R1: 渲染管线单一入口（消除 T6/T8 接口漂移）
Finding: F1 [P2] (confidence: 9/10) plans T6 `renderToHtml(src, fileDir): string`（同步返回字符串）vs T8/T9 需 container+异步（mermaid 动态 import、复制按钮注入 DOM）。
Plan baseline: T6 同步字符串入口，T8/T9 各自改 pipeline.ts。
Runtime evidence: 无代码（greenfield）；接口不一致为文本事实（两处引文如上）。
Comparison grid:

| Choice | Current | A 采纳 mountDoc | B 保持现状 |
|---|---|---|---|
| 管线入口 | 漂移 | `mountDoc(container, src, fileDir, theme): Promise<void>` 单一异步入口（render→图片重写→innerHTML→mermaid→复制按钮），T11 滚动恢复 await 后执行 | T8/T9 实现者自行补参数，漂移留给执行者 |
| 涉及文件 | — | T6/T8/T9/T11 计划文本各 1-2 行 | 0 |

Question D4: 见下。Header: 管线入口。Options:
A) 采纳 mountDoc 统一入口 (recommended) — 修复接口漂移，滚动恢复时序一并解决；改动仅计划文本数行
B) 保持 renderToHtml — 不改文本，执行者自行弥合两任务差异，有做错方向的风险
State: approved
Actual answer: A (D4)
Accepted scope: 计划文本 T1/T6/T8/T11/T12 修订为 mountDoc 单一异步入口（已应用）；滚动恢复 await 后执行
History: 无

### R2: watcher 自写回环抑制（保存后不触发自动刷新/冲突弹窗）
Finding: F2 [P2] (confidence: 8/10) T12 保存写盘必然触发 fs-change(modify)；`decideReload(kind, isDirty)` 无 mtime 参数，自写会被当作外部修改。
Plan baseline: T12 提到「mtime 基线」但接口未包含。
Runtime evidence: 无代码；notify 行为为已知事实。
Comparison grid:

| Choice | Current | A 采纳 mtime 比对 | B 保持 |
|---|---|---|---|
| 自写抑制 | 未定义 | Rust 事件载荷加 mtime；`decideReload(kind, isDirty, savedMtime?, eventMtime?)` 相等即 ignore | 保存后偶发重载/冲突弹窗闪烁 |
| 涉及文件 | — | T11/T12 各 +1 行 | 0 |

Question D5: 见下。Header: 自写回环。Options:
A) 采纳 mtime 比对 (recommended) — 消除保存后闪变，属完整性修复
B) 保持现状 — 靠事件先后时序侥幸规避，存在实际回归面
State: approved
Actual answer: A (D5)
Accepted scope: fs-change 载荷加 mtime；decideReload 加 mtime 相等→ignore（T11/T12 已应用）
History: 无

### R3: watch 范围收敛（不全树监听）
Finding: F3 [P3] (confidence: 7/10) 工作区模式整树 watch，大目录（含 node_modules 类子树）CPU/fd 开销不可控。
Plan baseline: T11「工作区则挂载整树」。
Comparison grid:

| Choice | Current | A 收敛到文件+父目录 | B 保持整树 |
|---|---|---|---|
| 监听范围 | 整树 | 当前文件+其父目录；树内其他变更靠已有的懒加载/切换时刷新 | 全树实时，代价随目录规模增长 |

Question D6: 见下。Header: 监听范围。Options:
A) 收敛监听 (recommended) — 阅读器主诉求是当前文件自动刷新，树刷新走懒加载已够
B) 保持整树 — 文件树实时性最好，大目录有性能风险
State: approved
Actual answer: A (D6)
Accepted scope: 监听收敛为当前文件+父目录（T11 已应用）
History: 无

### R4: CSP 显式设置
Finding: F4 [P3] (confidence: 7/10) 计划未提 CSP；Tauri 模板默认 csp null。已有防线：markdown-it html:false + asset scope 运行时授权，但 spec §3 安全模型值得一行显式 CSP。
Comparison grid:

| Choice | Current | A 加 CSP 行 | B 保持 null |
|---|---|---|---|
| CSP | null（模板默认） | T1 增 `app.security.csp`（`default-src 'self'; img-src 'self' asset: http://asset.localhost; style-src 'self' 'unsafe-inline'`） | 依赖 html:false + scope |
| 涉及文件 | — | T1 +1 行 | 0 |

Question D7: 见下。Header: CSP。Options:
A) 显式设置 CSP (recommended) — 与 spec 安全约束对齐，成本一行
B) 保持模板默认 — 依赖现有两道防线
State: approved
Actual answer: A (D7)
Accepted scope: T1 增加 app.security.csp 一行（已应用）
History: 无

## Review Sections（四节评审）

### 1. Architecture — 3 项发现，全部已处置

- F1 [P2] (9/10) 计划 T6 vs T8/T9 — `renderToHtml` 同步字符串与 mermaid/复制按钮的 DOM+异步需求矛盾 → R1/D4 采纳 `mountDoc` 统一入口。Dispositions: accepted (D4)
- F2 [P2] (8/10) T11/T12 — 保存自写触发 fs-change 回环，`decideReload` 无 mtime 参数 → R2/D5 采纳 mtime 比对。Dispositions: accepted (D5)
- F4 [P3] (7/10) 全计划 — 未设 CSP，模板默认 null → R4/D7 采纳显式 CSP。Dispositions: accepted (D7)
- 边界与数据流：Rust 命令层薄（4 命令+watcher）、渲染核心纯 TS 与框架解耦、两视图共管线，耦合面清晰；asset scope 运行时授权符合 spec §3；`bundle.fileAssociations`（role: Viewer）与 `protocol-asset` feature 已核实。
- 生产失败推演：保存时磁盘满/权限 → `write_text_file` Err（含路径）→ EditorView 走 T6 `setError` 模式呈现，非静默 ✓。

### 2. Code quality — 无新发现

模块结构即 R1 修订后的形态；共享代码（renderer core 两视图复用）为既定设计且满足复用标准（真实两处调用方 + 行为一致）；文件与任务 1:1（D3 用户批准）。Dispositions: n/a

### 3. Test review — 评审图如下，GAPS: 0

```
CODE PATHS（单元，vitest/cargo）                        USER FLOWS（T15 手动验收承接）
[+] T3 commands read/write/list                        [+] 双击/拖拽/树点击打开 [→MANUAL]
  └── [★★★ TESTED] cargo: 正常/UTF-8错/不存在/roundtrip   [+] 文件树导航/切换 [→MANUAL]
[+] T4 render/slug                                     [+] ⌘S 保存写回重开验证 [→MANUAL]
  └── [★★★ TESTED] GFM/alert/未闭合/标题id/去重           [+] 外部修改 ≤0.5s 刷新 [→MANUAL]
[+] T5 images                                          [+] 冲突对话框两分支 [→MANUAL]
  └── [★★★ TESTED] 相对/跳过http/中文空格路径              [+] 主题切换无闪白 [→MANUAL]
[+] T8 mermaid（mock 动态 import）                      [+] 关联双击/单实例/拖放 [→MANUAL]
  └── [★★ TESTED] 检测/降级/theme 映射（真实渲染归 MANUAL）
[+] T9 highlight/copy [★★ TESTED]
[+] T10 activeFromOffsets [★★★ TESTED]
[+] T11 decideReload 七分支 [★★★] / start_watcher cargo [★★ TESTED]
[+] T12 headingAtLine [★★★ TESTED]
[ ] T13/T14/T15 集成与打包 — 构建门槛 + MANUAL-QA（spec §5.4 精确先例批准，不引入 E2E 框架）

COVERAGE: 计划内可单测路径 11/11 有测试 | 用户流程 8/8 由手动验收承接 | GAPS: 0
```

回归规则（IRON RULE）：greenfield 无既有行为，n/a。LLM/eval 范围：无。

### 4. Performance — 1 项发现，已处置

- F3 [P3] (7/10) 工作区全树 watch 大目录开销不可控 → R3/D6 收敛为当前文件+父目录。Dispositions: accepted (D6)
- 其余核查：mermaid 首块触发动态 import（零成本文档不加载）✓；hljs 用 lib/common 子集 ✓；树懒加载 ✓；markdown-it 同步渲染以 100KB 文档为验收口径（spec §7 [estimated]）✓。

## NOT in scope

spec §2 P2 清单（lightbox 增强、KaTeX、emoji、导出 HTML、打印、滚动记忆、多 tabs）、E2E 测试框架、Windows/Linux 打包、网页 .md——均显式延期，理由见 spec。

## What already exists

md-reader（Chrome 插件形态，本计划 markdown-it 插件族与其生产依赖同源）；Tauri 官方插件 dialog/opener/single-instance；notify-debouncer-mini；CM6/mermaid/highlight.js/markdown-it 全部 Layer 1 既有物，无自造轮子。渲染管线为新代码但只做组装。

## Diagrams

```
打开/切换文件:
  双击|拖拽|树点击|最近 → openFile → [Rust] grantAssetScope + readTextFile
    → renderMarkdown → resolveImageSrcs → mountDoc(innerHTML→mermaid→copyBtn)
    → watch_paths(当前文件+父目录)

文件变更:
  notify(200ms) → fs-change{path,kind,mtime} → debounce300 → decideReload
    ├─ ignore（mtime==基线 或 create）
    ├─ reload（reader 或 editor 干净）→ 重入 openFile → await mountDoc → restoreScroll
    ├─ ask（editor dirty）→ 冲突对话框（重载/保留我的）
    └─ error（remove）→ 错误页（含路径）

编辑:
  CM6 ─debounce500→ mountDoc(预览) ；滚动同步 headingAtLine ↔ heading id
  ⌘S → writeTextFile → 快照/mtime 基线更新（Err→setError）
```

## Failure modes

| 失败 | 处置 | 用户所见 |
|---|---|---|
| 非 UTF-8/不存在/无权限读取 | T3 Err 含路径 → T6 setError | 明确错误页，非白屏 ✓ |
| 坏 markdown（未闭合块） | T4 不抛异常降级渲染 | 部分渲染 ✓ |
| mermaid 语法错误 | T8 块级降级源码+提示 | 其余内容正常 ✓ |
| 保存失败（磁盘满/权限） | Result Err → setError | 明确报错 ✓ |
| 当前文件被外部删除 | decideReload→error | 错误页 ✓ |
| 保存后自写事件 | mtime 相等→ignore | 无闪变 ✓ |

Critical gaps（无测试且无错误处理且静默）: **0**

## Worktree parallelization strategy

Sequential implementation, no parallelization opportunity.（T1→T15 接口层层依赖，单模块线性）

## Implementation Tasks

_No new tasks from Scope Challenge._（R1–R4 已作为计划文本修订直接应用并经用户批准）
_No new tasks from Architecture._ _No new tasks from Code Quality._ _No new tasks from Test._ _No new tasks from Performance._

## Suppressed findings

（无——本评审无 confidence<5 被抑制项）

## Unresolved decisions

无。

## Completion summary

- Step 0: Scope Challenge — scope accepted as-is（D3 结构选 Original）
- Reality rows: 7/7 applicable rows emitted（PLAN_REALITY），0 unverified premises
- Architecture Review: 3 issues found（F1/F2/F4，全部 accepted）
- Code Quality Review: 0 issues found
- Test Review: diagram produced, 0 gaps identified（手动验收承接为 spec 先例批准）
- Performance Review: 1 issue found（F3 accepted）
- NOT in scope: written · What already exists: written
- TODOS.md updates: 0 items（无遗留）
- Failure modes: 0 critical gaps flagged
- Unresolved decisions: 0 in this review
- Outside voice: codex 不可用（未安装）；本宿主无 Plan 子代理类型 → unavailable（OUTSIDE_VOICE_UNAVAILABLE），无外部交叉评审覆盖
- Parallelization: 1 lane, 0 parallel / 1 sequential
- Lake Score: 4/4（D4–D7 全部选择 10/10 推荐项）
- Approval readiness: PASS（R1: D4, R2: D5, R3: D6, R4: D7）

# Design Review（plan-design-review · 2026-10-26）

目标同上（本文件）。视觉稿：DESIGN_NOT_AVAILABLE（本机无 OpenAI key）→ 纯文本评审。Outside design voices：未运行（opt-in 问题未获应答；codex 未安装）。用户未应答期间，**所有修复仅为提案（待决），未写入上方任务区**。

## Pass 1 信息架构 — 6/10（修复后预估 9）

布局/层级/工具栏内容已明确；缺当前文件 wayfinding。

- 发现 1.1 [P2]（confidence 9，引文：T2 工具栏清单无文件名位置；READ 规则 "Wayfinding is a feature"）——阅读中不知道自己在看哪个文件/在哪。
  - 1A（推荐）工具栏中央显示当前文件名（次级文本，点击 = reveal in Finder）
  - 1B 阅读区文档标题上方路径面包屑
  - 1C 不做
  **State: 已批准（见下方批答记录）**

## Pass 2 状态覆盖 — 5/10（预估 9）

空态（Welcome 三入口）✓、错误页（含路径）✓、冲突对话框 ✓ 均已 spec；加载态全缺。

- 发现 2.1 [P2]（confidence 8）——mermaid 渲染中（复杂图 >1s）、树展开、大文档打开瞬间均无占位规格，页面会跳。
  - 2A（推荐）三处占位：mermaid 块保留原尺寸盒+完成淡入（T8 +1 行）；树展开行内 spinner 200ms 延迟显示（T7 +1 行）；打开文件正文区骨架行，内容就绪替换（T6 +1 行）
  - 2B 仅做 mermaid 占位
  **State: 已批准（见下方批答记录）**

## Pass 3 旅程与情感弧 — 7/10（storyboard 入档）

| 步 | 用户做 | 感受 | 计划支撑 |
|---|---|---|---|
| 1 | 双击 .md | 即时满足 | ≤1s/2s 预算 ✓ |
| 2 | 阅读长文 | 平静沉浸 | 排版 token（待 4.2）|
| 3 | 侧栏漫游 | 好奇探索 | 懒加载树 ✓ |
| 4 | 看 mermaid | 恍然理解 | 主题联动 ✓；占位待 2.1 |
| 5 | 切编辑改写 | 掌控 | ⌘S/实时预览/滚动同步 ✓ |
| 6 | 文件被外部改 | 无扰刷新 | watcher+滚动保持+冲突对话 ✓ |
| 7 | 重开应用 | 回到原地 | 会话恢复 ✓ |

无独立新缺口（断点均被 1.1/2.1/4.x 覆盖）。No issues, moving on.

## Pass 4 具体性 / AI 味 — 4/10（预估 9）

分类 **HYBRID**：外壳 OPERATE（App UI 规则），阅读面 READ（度量/wayfinding）。硬拒绝命中：**0**（无卡片栅格/hero/轮播/渐变）。

Litmus：1 品牌可辨 YES（墨阅+墨滴标识 spec）；2 视觉锚点 YES（文档本身）；3 仅标题可扫 YES（TOC）；4 一区一职 YES；5 卡片必要性 N/A（零卡片路线）；6 动效 NOT SPEC'D；7 去阴影仍高级 YES。

- 发现 4.1 [P1]（confidence 9，Universal 规则禁默认字体栈作正文）——中文阅读器正文字体未决策，这是产品灵魂。
  - 4A（推荐）正文衬线栈 `"Songti SC", "Noto Serif CJK SC", serif`（macOS 自带宋体，书页感，零包体）；UI/侧栏/工具栏 `"PingFang SC", system-ui`；代码 `ui-monospace`。P2 可再议打包子集化霞鹜文楷
  - 4B 打包 LXGW WenKai Screen（+~8MB，逼近/超出 15MB 预算，需子集化）
  - 4C 正文也用 PingFang（全 sans，最素）
  **State: 已批准（见下方批答记录）**
- 发现 4.2 [P1]（confidence 9，"排版即产品"却零数值）——排版 token 缺失。
  - 4A（推荐）具体 token：正文 17px/行高 1.8/段距 0.9em/栏宽 `max-width: 42em`（CJK 舒适度量）；h1 28px·700·上 2.2em 下 0.6em；h2 22px·600·上 1.8em 下 0.5em；h3 19px·600·上 1.5em 下 0.4em；代码块 13.5px；侧栏/工具栏/TOC 13px；标题上方间距>下方 ✓（READ 规则）
  - 4B 只写相对比例（em 基），字号留实现者
  **State: 已批准（见下方批答记录）**
- 发现 4.3 [P3]（confidence 7，litmus 6 NOT SPEC'D）——动效未定。
  - 4A（推荐）仅两处 authored motion：文件切换正文 120ms ease-out 淡入；mermaid 渲染完成淡入。其余无动效
  - 4B 完全无动效
  **State: 已批准（见下方批答记录）**

## Pass 5 设计系统对齐 — 5/10（预估 9）

无 DESIGN.md（0B 已记，建议后续 /design-consultation 沉淀）。计划自身 token 未列清单。

- 发现 5.1 [P1]（confidence 9，Universal "Define CSS variables for color system"；T2 仅写"全套 CSS 变量"未列值）——色板未定，实现者必现蓝紫 slop。
  - 5A（推荐）朱砂 accent 方案（契合「墨/印」身份，避开蓝紫）：
    亮：`--bg #FAF9F7 / --bg-side #F3F1ED / --fg #1C1A17 / --fg-2 #5C574F / --fg-3 #8A857C / --line #E5E1DA / --accent #C5393D / --accent-weak #F7E9E7 / --code-bg #F4F2EE`
    暗：`--bg #191714 / --bg-side #201D19 / --fg #E8E4DD / --fg-2 #A6A099 / --fg-3 #6E6963 / --line #33302B / --accent #D96A5E / --accent-weak #3A2A28 / --code-bg #242220`
    对比度：fg 14.8:1/12.4:1，fg-2 ≥4.5:1 ✓；`--sel` = accent 33% 透明
  - 5B 由用户另给色板方向
  **State: 已批准（见下方批答记录）**

## Pass 6 响应式与无障碍 — 3/10（预估 9）

移动端 N/A（桌面 App，intentional exclusion）。

- 发现 6.1 [P2]（confidence 9）——最小窗口尺寸与窄窗行为未定。
  - 6A（推荐）min 720×480；TOC ≤820px 自动隐藏（工具栏按钮唤出）；文件树 ≤640px 隐藏（按钮唤出）
  - 6B 只定 min 尺寸，折叠不做
  **State: 已批准（见下方批答记录）**
- 发现 6.2 [P1]（confidence 9）——快捷键集未定（仅 ⌘S/Esc 已定），图标按钮无无障碍标签。
  - 6A（推荐）快捷键集：⌘O 打开文件 / ⇧⌘O 打开文件夹 / ⌘E 阅读↔编辑 / ⌘T 主题循环 / ⌘S 保存（已有）/ Esc 关 lightbox·对话框（已有）/ 树 ↑↓↔↵ 导航 / 全局 focus 环 accent 2px 可见；图标按钮 `aria-label`（中文，入 ui-strings）
  - 6B 只加 ⌘O/⌘E 最小集
  **State: 已批准（见下方批答记录）**

## Pass 7 遗留决策

- 7.1 [P3] 编辑分栏：固定 50/50 vs 可拖。7A（推荐）可拖分隔条（5px 命中区），宽度持久化 `moyue.split`；7B 固定 50/50。**State: 已批准（见下方批答记录）**
- 7.2 Outside design voices：skipped（未获 opt-in；不阻塞）。

## 批答记录（2026-10-26 用户经可视化确认页 + 文字确认）

- 1.1 → **1A** 工具栏中央文件名 + 点击 reveal in Finder
- 2.1 → **2A** 三处加载占位（mermaid 骨架/树 spinner/正文骨架行）
- 4.1 → **4A** 宋体衬线栈 `"Songti SC","Noto Serif CJK SC",serif`；UI PingFang（确认页选择衬线）
- 4.2 → **4A** 具体 token，确认页微调后确认 **17px / 行高 1.8 / 栏宽 42em**
- 4.3 → **4A** 仅两处淡入（文件切换正文、mermaid 完成）
- 5.1 → **B 墨青**（用户选择，非推荐的 5A 朱砂）：accent #237A6F/#56B3A4，全套变量见 T2
- 6.1 → **6A** 最小 720×480；TOC ≤820px、文件树 ≤640px 自动隐藏
- 6.2 → **6A** 快捷键全集 + 树方向键 + aria-label + focus 环
- 7.1 → 默认 **50%**，可拖 **25–75%**，持久化 `moyue.split`（确认页拖动验证）
- 8.1（用户追加并更正）→ **目录（TOC）面板与文件树侧栏支持折叠/展开**（工具栏按钮 + 持久化 + 窄窗自动隐藏）；**编辑分栏不折叠**（用户更正原文「编辑分栏」为「目录栏」）

全部修订已应用至 T2/T6/T7/T8/T10/T12 与 Global Constraints；决策共 10 项（含 1 项用户更正）。

## Design Review Completion Summary（终版）

```
+====================================================================+
|         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
+====================================================================+
| System Audit         | 无 DESIGN.md/CLAUDE.md/TODOS.md；UI 范围确认 |
| Step 0               | 初评 4/10；焦点=A；经可视化确认页确认         |
| Pass 1  (Info Arch)  | 6/10 → 9/10（1.1=1A 已应用）                 |
| Pass 2  (States)     | 5/10 → 9/10（2.1=2A 已应用）                 |
| Pass 3  (Journey)    | 7/10 → 8/10（storyboard 入档）               |
| Pass 4  (AI Slop)    | 4/10 → 9/10（4.1-4.3 已应用，4.1 用户选衬线） |
| Pass 5  (Design Sys) | 5/10 → 9/10（5.1=B 墨青，用户选择）           |
| Pass 6  (Responsive) | 3/10 → 9/10（6.1/6.2 已应用）                |
| Pass 7  (Decisions)  | 10 resolved, 0 deferred（含用户更正 8.1）    |
+--------------------------------------------------------------------+
| NOT in scope         | written（移动端、DESIGN.md 沉淀、编辑分栏折叠）|
| What already exists  | written（无既有 UI；md-reader 主题仅参考）     |
| TODOS.md updates     | 0 items                                      |
| Approved Mockups     | 0 designer 稿（无 OpenAI key）· 宿主可视化页确认 |
| Decisions made       | 10 added to plan（见批答记录）                |
| Decisions deferred   | 0                                            |
| Overall design score | 3/10 → 8/10（下限为 Pass 3 的 8 分）          |
+====================================================================+
```

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | 未运行（范围经 brainstorming 全程用户批准） |
| Outside Review | codex（未安装）/ Plan 子代理（宿主不提供） | Independent 2nd opinion | 0 | unavailable | OUTSIDE_VOICE_UNAVAILABLE |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES OPEN | 4 issues, 0 critical gaps（全部已修订入计划并经用户批准 D4–D7） |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 3/10 → 8/10, 10 decisions（含用户可视化选择与更正） |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | 未运行 |

- **OUTSIDE COVERAGE:** codex 未安装、Plan 子代理宿主不提供 → missing coverage；design outside voices skipped（未获 opt-in）。
- **VERDICT:** ENG + DESIGN COMPLETE — 计划可实施（4 项工程修订 + 10 项设计决策全部应用并经用户批准）。
NO UNRESOLVED DECISIONS
