# KawaiiMD

本地 Markdown 阅读器（macOS，Tauri v2 + Svelte 5）。

- 双击/拖拽/文件树打开 `.md` `.markdown` `.mkd` `.mdx`，GFM 全语法渲染
- Mermaid 图表（明暗联动、骨架占位、失败降级）
- 文件夹树懒加载 + 文档目录（TOC）+ 代码高亮复制
- 编辑模式：分栏实时预览、自动保存（⌘S 立即写回）、按标题锚点滚动同步
- 外部修改自动刷新（≤0.5s、滚动保持、冲突对话框）
- 亮/暗主题（墨青色板）、宋体衬线正文、会话恢复

## 开发

```bash
pnpm install
pnpm tauri dev     # 开发运行
pnpm vitest run    # 前端单测
pnpm check         # svelte-check
pnpm tauri build   # 打包 dmg（ad-hoc 签名，仅自用）
```

Rust 侧测试：`cd src-tauri && cargo test`。

要求：Node ≥ 20、pnpm、Rust stable、Xcode CLT（本机 SDK 27.0 与 clang 不兼容时见 `src-tauri/.cargo/config.toml` 的 SDKROOT 固定）。

## 文档

- 设计：`docs/superpowers/specs/2026-10-26-markdown-reader-app-design.md`
- 实施计划与评审记录：`docs/superpowers/plans/2026-10-26-kawaimd-markdown-reader.md`
- 手动验收清单：`MANUAL-QA.md`
