# Markdown 本地阅读器 App — 设计文档

- 日期：2026-10-26
- 状态：待用户批准
- 决策参与：rendy（需求与方向）、ZCode（技术方案）

## 1. 意图与动机

rendy 在 macOS 上有大量本地 markdown 文档（含 mermaid 架构图）需要阅读，期望：

1. 双击 `.md` 即可看到排版好的渲染页，而不是源码或「无法打开」；
2. 文中 mermaid 图表直接渲染成图；
3. 侧边能浏览**当前文件所在文件夹**的全部文件与子文件夹，点开即看；
4. 能编辑并保存（此需求是最终选择本地 App 形态的主要动因）。

最初按 Chrome 插件立项（参考 [md-reader/md-reader](https://github.com/md-reader/md-reader)），但 Chrome 扩展对本地文件只读、写回需绕 File System Access API 授权流转，且用户确认「只看本地 md」，故改选 **Tauri 本地 App**：读写文件、文件夹树、文件监听都是原生能力，编辑模式成本大幅下降，只需放弃「网页 .md 链接渲染」（用户已确认放弃）。

## 2. 目标 / 非目标 / 反目标

### 目标（v1 全部交付）

| # | 能力 | 说明 |
|---|------|------|
| G1 | 打开与渲染 | `.md / .markdown / .mkd / .mdx`（.mdx 按纯 markdown 处理，rendy 确认无 JSX）；GFM 全语法（表格、任务列表、删除线、脚注、alert 容器）；相对路径图片正常显示 |
| G2 | Mermaid | mermaid 全部图表类型；主题随明暗联动；渲染失败降级为源码块 + 错误提示，不崩页面 |
| G3 | 文件夹树 | 两种入口：打开单文件 → 自动挂载其所在目录为树；「打开文件夹」→ 工作区模式。子目录懒加载，当前文件高亮，点 `.md` 原地切换 |
| G4 | 编辑模式 | 分栏「编辑 + 实时预览」，**双栏按标题锚点粒度滚动同步**（rendy 选定）；`⌘S` 写回磁盘；预览复用阅读渲染器（一套渲染管线） |
| G5 | 主题 | 亮/暗，跟随系统 + 手动切换，代码高亮配色联动 |
| G6 | 阅读辅助 | 右侧 TOC（标题抽取、点击跳转）；代码块语法高亮 + 一键复制 |
| G7 | 自动刷新 | 文件被外部修改后自动重渲染（fs watcher 事件推送，非轮询） |
| G8 | 系统集成 | Finder 双击 .md 打开（文件关联）；单实例（重复打开文件转发到已有窗口）；最近文件列表；拖拽文件/文件夹到窗口打开 |
| G9 | 非 md 文件 | 图片 → 当前页内 lightbox 放大；PDF/其他 → 交给系统默认应用（`reveal` / opener） |

### 非目标（v1 明确不做）

- 网页上的 .md 链接渲染（Chrome 插件形态能力，已放弃）
- 多标签页（点文件树切换 + 最近文件即可，保持阅读器清爽）
- 云同步、收藏管理、插件市场、docx 导出
- Windows/Linux 打包（架构不设障，但 v1 只验证 macOS）

### 反目标（技术上实现了也算失败）

- 编辑功能把「打开即读」变重：默认进入阅读视图，编辑是显式切换
- 任何渲染异常导致白屏/崩溃（坏语法、超大文件、恶意嵌套都要降级）
- 打开一个 10KB 文档超过 1 秒

### P2（v1 不做，架构留位）

图片 lightbox 增强、KaTeX 数学公式、emoji、导出 HTML、打印、记住滚动位置、多标签页。

## 3. 约束

- **应用标识**：名称「墨阅」，bundle id `com.rendy.moyue`（ZCode 默认提案，rendy 未否决；改名成本在文件关联注册后变高，落地前可换）
- **平台**：macOS（darwin arm64）优先；Tauri 保持跨平台可能性
- **文件编码**：rendy 确认全部 UTF-8；读取遇非法 UTF-8 时优雅报错（明确提示哪个文件），不做 GBK 等多编码检测
- **分发**：仅自用——ad-hoc 签名 + 本地打包 dmg，不做 Developer ID 公证；将来要分发再补
- **开发环境**：Rust 工具链（rustup/cargo）+ Xcode Command Line Tools + Node ≥ 20 + pnpm
- **安全模型**：Tauri v2 ACL——asset protocol 与 fs scope 限定为「用户已打开的文件/目录」，不放开全盘
- **mermaid 只有 JS 实现**：必须在 WebView 侧渲染，Rust 端不做图表
- **包体积目标**：< 15MB（保持 Tauri 优势，不引入重依赖）

## 4. 方案选择记录

### 形态：Chrome 插件 vs 本地 App → **本地 App**

- 插件方案 C（content script 阅读 + 扩展页编辑）：能覆盖网页 .md，但编辑需 File System Access 授权流转，本地文件夹侧栏需解析 Chrome 内部目录列表 HTML（hack）
- 本地 App：编辑写回、文件夹树、文件监听全部原生；失去网页 .md（用户确认可放弃）
- 决策：rendy 确认「只看本地 md」→ App

### App 框架：Tauri v2 vs Electron vs SwiftUI → **Tauri v2**

- Tauri v2：Rust 后端 + 系统 WebView（macOS 为 WKWebView），包 ~10MB，内存低
- Electron：生态最全但包 150MB+、内存高
- SwiftUI 纯原生：mermaid 无原生实现，最终仍需嵌 WebView，白写一层
- 决策：rendy 选定 Tauri

### 前端框架 → **Svelte 5（runes）+ Vite + TypeScript**

rendy 选定（参考仓库同家族，代码量少、包小）。

### Markdown 引擎：markdown-it → **markdown-it + 官方插件家族**

- 同步渲染、快、插件生态成熟；md-reader 生产验证同路线（markdown-it@13 + task-lists/footnote/emoji/abbr/deflist/multimd-table/alert）
- 备选 remark/unified：偏 AST 工具链，异步管道，对本项目收益不抵复杂度
- 决策：ZCode 判断，属可替换层（renderer core 隔离在独立模块，将来可换）

### 代码高亮：highlight.js vs Shiki → **highlight.js**

- 同步渲染、主题切换 = 换一份 CSS，包小；Shiki 更漂亮但重且异步
- 决策：ZCode 判断

### 编辑器：CodeMirror 6 vs vditor/bytemd → **CodeMirror 6**

- CM6 只提供编辑器，预览复用本 App 阅读渲染器 → 样式永久一致、包最小
- vditor/bytemd 自带整套渲染器，与阅读样式割裂且体积大
- 决策：ZCode 判断

### 样式方案 → **手写 CSS + CSS 自定义属性做主题**

排版即产品，不引 Tailwind；主题 = `:root[data-theme]` 变量集。
决策：ZCode 判断

### 界面语言 → **zh-CN，字符串集中管理**

v1 只做中文，文案集中一处便于将来 i18n。决策：ZCode 判断

## 5. 架构

### 5.1 总体

```
┌─────────────────────── Rust (src-tauri) ───────────────────────┐
│ commands: pick_file/pick_folder · read_text · write_text       │
│           list_dir · reveal_in_finder · app_metadata           │
│ fs watcher (notify) ──emit──► 「fs-change」事件                 │
│ 文件关联(CFBundleDocumentTypes) + single-instance ─► 「open-file」│
└──────────────────────────── IPC ───────────────────────────────┘
                                  ↕
┌────────────────────── Svelte 5 前端 ───────────────────────────┐
│ renderer core（纯 TS 无框架依赖，两视图共用）                    │
│   markdown-it 实例 · 相对图片重写 · mermaid 后处理 · TOC 抽取     │
│ 视图层: FileTree │ ReaderView ⇄ EditorView │ TocPanel           │
│ 状态: 当前文件 path + mode(read|edit) + 主题 + 最近文件          │
└────────────────────────────────────────────────────────────────┘
```

### 5.2 UI 布局

```
┌────────────────────────────────────────────────┐
│ 工具栏：打开文件/文件夹 · 主题切换 · 阅读/编辑切换 │
├──────────┬──────────────────────────┬──────────┤
│  文件树   │     阅读区（排版核心）      │   TOC    │
│ （懒加载） │     / 编辑区（分栏）        │ （可折叠）│
└──────────┴──────────────────────────┴──────────┘
```

### 5.3 关键流程

**启动**（ZCode 决策）：恢复上次会话——上次打开的文件与文件夹树原样还原；无历史则显示空态欢迎页（打开文件 / 打开文件夹 / 最近文件三个入口）。

**打开文件**（双击关联 / 拖拽 / 树点击 / 最近文件）→ Rust 读文本 → renderer core 渲染 → watcher 挂载当前文件（工作区则挂载整树）→ 文件树定位高亮。

**外部修改**：`fs-change` → 前端防抖 300ms → 阅读视图：重读重渲染，滚动位置按最近标题锚定恢复；编辑视图：无未保存修改则自动重载，**有未保存修改弹冲突对话框**（重载外部版 / 保留我的）。

**保存**：`⌘S` → Rust `write_text` → 清除 dirty 标记 → 记录 mtime 基线（watcher 用）。

**Mermaid**：markdown 渲染完成后扫描 `code.language-mermaid` 块 → 首次遇到才动态 `import('mermaid')`（按需加载，不含 mermaid 的文档零成本）→ `mermaid.render` 主题映射 light→`default` / dark→`dark` → 失败则保留源码块并附错误信息。编辑实时预览时 mermaid 重渲染走 500ms 防抖。

**相对图片**：渲染阶段将相对 `src` 以当前文件目录解析为绝对路径 → `convertFileSrc()` 转 asset protocol URL（asset scope 已含工作区）。

### 5.4 测试策略

- renderer core（markdown→HTML、图片重写、TOC 抽取、mermaid 降级）用 **vitest** 单测——纯函数，好测
- Rust commands 薄，靠前端集成手测
- 手动验收清单见 §7

## 6. 里程碑（每个都可运行、可验证）

| # | 内容 |
|---|------|
| M1 | 脚手架：Tauri v2 + Svelte 5 + Vite + TS 跑通空窗口 |
| M2 | 打开单文件 + markdown-it 基础渲染 + 亮暗主题骨架 |
| M3 | 文件树（目录挂载 + 工作区模式 + 懒加载 + 切换导航） |
| M4 | mermaid + 代码高亮/复制 + TOC + alert/脚注等插件全量 |
| M5 | fs watcher 自动刷新 + 相对图片 + 外部修改冲突处理 |
| M6 | 编辑模式（CM6 分栏 + 实时预览 + ⌘S + dirty 状态） |
| M7 | 文件关联 + 单实例 + 拖拽 + 最近文件 + lightbox |
| M8 | 打磨（空态/错误态文案）+ 打包 dmg + 验收清单过一遍 |

## 7. 验收标准

- Finder 双击 .md：冷启动 ≤ 2s 出渲染页，热启动（已有实例）≤ 1s
- 100KB 文档滚动流畅不掉帧；含 5 张 mermaid 图的文档全部渲染 ≤ 2s
- 外部编辑器改文件并保存：≤ 0.5s 页面自动刷新，滚动位置基本保持
- 编辑后 `⌘S`：磁盘内容与所见一致，重开验证
- 亮暗切换无闪白；mermaid 图配色跟随切换
- 非法 markdown（未闭合代码块等）显示优雅降级，不白屏

## 8. 留给实现者的自由度

- markdown-it 插件具体清单与版本（脚注/任务列表/alert 必装，其余自定）
- 文件树在超大目录（>2000 项）时是否引入虚拟滚动
- pnpm/npm、目录命名等工程细节
- 错误提示与空态的具体文案
- Rust 端 crate 选择（watcher 用 tauri-plugin-fs 还是直接 notify）
- CRLF 换行保留策略、当前文件被外部删除后的树/视图处理、单文件模式下目录树的手动刷新时机
