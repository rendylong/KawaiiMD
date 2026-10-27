# AGENTS.md — KawaiiMD

本地 Markdown 阅读器（macOS，Tauri v2 + Svelte 5 + SvelteKit，pnpm）。双击/拖拽/文件树打开 md，GFM 渲染、Mermaid、编辑分栏预览、外部修改自动刷新。solo 项目，中文交流。

## 常用命令

```bash
pnpm install
pnpm tauri dev        # 开发运行（前端 1420 端口）
pnpm vitest run       # 前端单测（vitest + jsdom）
pnpm check            # svelte-check
cd src-tauri && cargo test   # Rust 侧测试
pnpm tauri build      # 打包 dmg（ad-hoc 签名，仅自用）
```

打包时 PATH 需含 `~/.cargo/bin`（tauri CLI 要调 cargo/rustc）。

## 环境坑（macOS / 本机）

- **SDKROOT 固定 26.5**：本机 CLT 27.0 SDK 的 tbd（arm64e.x1）与 clang/tapi 不兼容，已在 `src-tauri/.cargo/config.toml` 固定 `SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk`。**不要**用 `xcrun --show-sdk-path` 之类的动态取值替换它——会取到坏的 27.0。
- Node ≥ 20、pnpm、Rust stable。

## 架构地图

前端 `src/lib/`，Rust 壳 `src-tauri/src/`（lib.rs / commands.rs / watcher.rs，另有 main.rs 入口）。

| 路径 | 职责 |
|---|---|
| `lib/markdown/` | 渲染管线：pipeline（markdown-it 装配）、render、highlight（highlight.js）、mermaid（明暗联动/骨架/降级）、links、images、slug |
| `lib/state/` | app.svelte.ts 全局状态；reload.ts 外部修改刷新（滚动保持、冲突对话框） |
| `lib/fs/` | tauri.ts IPC 封装；entries.ts 树数据；tree-root.ts 粘性树根 |
| `lib/components/` | FileTree / ReaderView / EditorView（CodeMirror6 分栏预览）/ TocPanel / Lightbox / Welcome / Icon |
| `lib/components/icons.ts` | 树/界面图标的**实测墨水盒归一化**（见下） |
| `lib/dom/` | scroll.ts、overlay-scrollbar.ts（macOS 风格悬浮滚动指示条） |
| `lib/editor/sync.ts` | 编辑/预览按标题锚点滚动同步 |
| `src-tauri/src/commands.rs` | read_text_file / write_text_file / list_dir / grant_asset_scope |
| `src-tauri/src/watcher.rs` | notify-debouncer-mini 文件监听，watch_paths 命令 |

IPC 事件：Rust → 前端 `open-file`（单实例二次启动与 Finder 双击）。

## 平台坑（已固化方案，改动前先读）

每条都是实测多轮换来的，**修复时优先找深层根因，不要目测微调**（同一症状活过两轮修复就该换 systematic-debugging 思路，要测量证据）：

- **窗口关闭**：`onCloseRequested` 拦截后再 `destroy()`，需要 `core:window:allow-destroy` 权限（`core:default` 不含），已在 `src-tauri/capabilities/default.json` 加。
- **冷启动打开文件**：`RunEvent::Opened` 先于前端监听器注册到达 → Rust 侧用 `PENDING_OPEN` Mutex 暂存，前端就绪后调 `take_pending_open_file` 取走。macOS Finder 双击走 Apple Event（odoc），不进 argv。
- **Svelte 5**：编辑器组件不要让 `$effect` 追踪文档内容源（每键重建编辑器）——用 `docVersion` 计数 + `untrack`。文件树状态直接原地变异，不走不可变更。
- **Svelte 5 raw/代理引用（多标签实测踩坑）**：把 raw 对象 push 进 `$state` 数组后，元素一旦被读取过（find/some/map 等），$state 会接管该对象，此后对 raw 引用的写入**静默丢失**（现象诡谲：同一对象上有的字段生效有的不生效）。规则：凡是 push 后还要继续改写的对象，必须返回/持有从状态里读回的代理引用（如 `appendTab` 返回 `app.tabs[app.tabs.length - 1]`），不要外泄 makeTab 的原始产物。
- **树根粘性**：树根行用纯函数决策 + `nextStickyRoot` 粘住，防滚动时根行漂移抖动。
- **图标大小**：树/界面图标以实测墨水盒（ink-box）归一化——`icons.ts` 里解析器 + transform 烘焙，`icons.test.ts` 是回归测试。**动 icons.ts 必须跑 `pnpm vitest run icons`**。视觉不一致时先怀疑布局层（曾有两轮根因分别在：viewBox meet 等比缩放、flex 行内 svg 被长文件名挤压——后者修法是 `.t-item svg { flex: none }`）。
- **滚动条**：WKWebView 嵌套滚动区不跟随系统偏好，中间视图用 overlay-scrollbar Action（隐藏原生条 + 悬浮指示条，滚动淡入 / 700ms 淡出 / 可拖拽，`overlay-scrollbar.test.ts` 8 个几何测试）。侧栏未改造，不要顺手照搬。
- **SvelteKit 模板 + adapter-static**：`prepare` 里 `svelte-kit sync`；Tauri `frontendDist: ../build`。
- **`@mdit/plugin-alert` 是具名导出**，import 时注意。

## 修改约定

- 测试与源码同目录（`*.test.ts`）。提交前：`pnpm vitest run` + `cargo test`（src-tauri 下）+ `pnpm check` 全绿。
- 改 IPC 面（命令/事件/权限）时同步核对 `src-tauri/capabilities/default.json` 与 CSP（`tauri.conf.json`，asset 协议图片走 `asset:` / `http://asset.localhost`）。
- UI 文案集中在 `lib/ui-strings.ts`，中文。
- 主题色板（墨青）在 `lib/theme.css`，正文宋体衬线。

## 文档

- 设计 spec：`docs/superpowers/specs/2026-10-26-markdown-reader-app-design.md`
- 实施计划与评审记录：`docs/superpowers/plans/2026-10-26-kawaimd-markdown-reader.md`
- 手动验收清单：`MANUAL-QA.md`
