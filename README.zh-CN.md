# KawaiiMD

简体中文 · **[English](README.md)**

简单、轻快、易用的 macOS 本地 Markdown 阅读器与编辑器。Typora 的免费开源替代。

<p align="center">
  <img src="docs/screenshots/reader-light.png" width="820" alt="KawaiiMD 阅读视图">
</p>
<p align="center">
  <img src="docs/screenshots/editor-split.png" width="400" alt="KawaiiMD 编辑分栏">&nbsp;&nbsp;
  <img src="docs/screenshots/reader-dark.png" width="400" alt="KawaiiMD 深色主题">
</p>

## 为什么选 KawaiiMD

- **免费且开源。** 没有序列号、没有激活、没有倒计时——Typora 收费的那部分，这里全都有，而且代码敞开。
- **真·轻量。** Rust 壳 + 系统 WebView，不捆绑 Chromium，整个安装包只有约 4 MB，启动一眨眼。
- **本地优先。** 文件夹就是资料库：不注册账号、不建数据库、没有导入步骤、没有锁定——文件永远是磁盘上普通的 `.md`。
- **为阅读而生的排版。** 中文正文宋体衬线、墨青色板，亮暗双主题，Mermaid 图表与代码高亮自动跟随主题。
- **写起来跟手。** 分栏实时预览，按标题锚点滚动同步（内建 CodeMirror 6），⌘S 与关窗自动保存。
- **不抢戏。** 多标签 + 会话恢复；文件被外部修改自动刷新（滚动位置保持、冲突先问再覆盖）；macOS 原生质感的悬浮标题栏与滚动条。

## 功能

- 双击 / 拖拽 / 文件树打开 `.md` `.markdown` `.mkd` `.mdx`，GFM 全语法（表格、任务列表、alert 提示框）
- Mermaid 图表——明暗联动、加载骨架占位、失败优雅降级
- 代码高亮 + 一键复制
- 文件夹树懒加载 + 仅 Markdown 过滤 + 目录（TOC）侧栏
- 外部修改监听：≤ 0.5s 自动刷新、滚动保持、冲突对话框
- 多标签（⌘T / ⌘W / ⌘1-9）、Finder 式就地新建文档（⌘N）、会话恢复
- 亮/暗主题（⇧⌘T）、宋体衬线正文

想快速上手？打开 `demo/` 文件夹，`漫游指南.md` 会带你过一遍全部效果。

## 安装

**源码构建**（预编译 DMG 稍后放到 Releases）：

```bash
pnpm install
pnpm tauri build   # 产出 src-tauri/target/release/bundle/dmg/*.dmg
```

要求 Node ≥ 20、pnpm、Rust stable、Xcode CLT。DMG 为 ad-hoc 签名，首次打开如遇 Gatekeeper 拦截，右键 → 打开。

## 开发

```bash
pnpm tauri dev     # 开发运行
pnpm vitest run    # 前端单测
pnpm check         # svelte-check
cd src-tauri && cargo test   # Rust 测试
```

技术栈：Tauri v2、Svelte 5 + SvelteKit、CodeMirror 6、markdown-it、Mermaid、highlight.js。

## 文档

- 设计 spec：`docs/superpowers/specs/2026-10-26-markdown-reader-app-design.md`
- 实施计划与评审记录：`docs/superpowers/plans/2026-10-26-kawaimd-markdown-reader.md`
- 手动验收清单：`MANUAL-QA.md`
- AI 协作约定：`AGENTS.md`

---

KawaiiMD · [@rendylong](https://github.com/rendylong)
