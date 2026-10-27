<script lang="ts">
  import { onMount } from "svelte";
  import type { Window as TauriWindow } from "@tauri-apps/api/window";
  import { S } from "$lib/ui-strings";
  import {
    TOC_WIDTH_DEFAULT,
    TREE_WIDTH_DEFAULT,
    resolvedTheme,
    setThemeMode,
    setTocCollapsed,
    setTocWidth,
    setTreeCollapsed,
    setTreeWidth,
    settings,
  } from "$lib/settings.svelte";
  import {
    activeTab,
    activateTab,
    app,
    closeOtherTabs,
    closeTab,
    currentPath,
    flushAutosave,
    newTab,
    openFile,
    openFolder,
    restoreSession,
    saveCurrent,
    switchMode,
    wireFsChange,
  } from "$lib/state/app.svelte";
  import { cycleTabId, nthTabId, tabTitle } from "$lib/state/tabs";
  import { confirmDiscard, dirname, pickFile, pickFolder, revealInFinder } from "$lib/fs/tauri";
  import { overlayScrollbar } from "$lib/dom/overlay-scrollbar";
  import Icon from "$lib/components/Icon.svelte";
  import ReaderView from "$lib/components/ReaderView.svelte";
  import Welcome from "$lib/components/Welcome.svelte";
  import FileTree from "$lib/components/FileTree.svelte";
  import TocPanel from "$lib/components/TocPanel.svelte";
  import EditorView from "$lib/components/EditorView.svelte";
  import Lightbox from "$lib/components/Lightbox.svelte";
  import SettingsPanel from "$lib/components/SettingsPanel.svelte";

  let settingsOpen = $state(false);
  // 标签右键菜单（clientX/Y 已夹取，防止贴边溢出）
  let ctx = $state<{ x: number; y: number; tabId: number } | null>(null);
  let readerEl: HTMLElement | undefined = $state();
  let win: TauriWindow | null = null;

  const tab = $derived(activeTab());
  const ctxTab = $derived(app.tabs.find((t) => t.id === ctx?.tabId) ?? null);

  function toggleTheme(): void {
    // 直接按当前生效主题翻转：旧的 system→light→dark 三态循环在 system=light 时
    // 第一次点击无可见变化（正是"要点两次"的根因）
    setThemeMode(resolvedTheme() === "dark" ? "light" : "dark");
  }

  // ⌘O 是外部入口：新标签打开，不打断当前阅读
  async function onOpenFile(): Promise<void> {
    const p = await pickFile();
    if (p) await openFile(p, { newTab: true });
  }

  async function onOpenFolder(): Promise<void> {
    const p = await pickFolder();
    if (p) await openFolder(p);
  }

  // 「当前目录」：当前文件所在目录；无文件时用工作区根。皆无则入口禁用。
  function newFileTargetDir(): string | null {
    const cp = currentPath();
    return cp ? dirname(cp) : app.workspaceRoot;
  }

  function onNewFile(): void {
    const dir = newFileTargetDir();
    if (!dir) return;
    // 命名行在文件树中就地出现，树收起时先展开
    if (settings.treeCollapsed) setTreeCollapsed(false);
    app.creating = dir;
  }

  // —— 标签栏 ——

  function onTabClick(e: MouseEvent, id: number): void {
    const x = e.target instanceof Element ? e.target.closest(".tab-x") : null;
    if (x) {
      void closeTab(id);
      return;
    }
    activateTab(id);
  }

  function onTabAuxclick(e: MouseEvent, id: number): void {
    if (e.button === 1) {
      e.preventDefault();
      void closeTab(id);
    }
  }

  function onTabsDblclick(e: MouseEvent): void {
    if (e.target instanceof Element && e.target.closest(".tab, .tab-new")) return;
    e.preventDefault();
    newTab();
  }

  function onTabContext(e: MouseEvent, id: number): void {
    e.preventDefault();
    ctx = {
      x: Math.min(e.clientX, window.innerWidth - 190),
      y: Math.min(e.clientY, window.innerHeight - 180),
      tabId: id,
    };
  }

  function onCtxAction(action: "close" | "closeOthers" | "reveal" | "copy"): void {
    const c = ctx;
    ctx = null;
    if (!c) return;
    const t = app.tabs.find((x) => x.id === c.tabId);
    if (!t) return;
    if (action === "close") void closeTab(t.id);
    else if (action === "closeOthers") void closeOtherTabs(t.id);
    else if (action === "reveal" && t.path) void revealInFinder(t.path).catch(() => {});
    else if (action === "copy" && t.path) void navigator.clipboard?.writeText(t.path).catch(() => {});
  }

  // 阅读滚动实时记回当前标签（切标签可恢复；编辑滚动由 EditorView 自记）
  function onReaderScroll(): void {
    const t = activeTab();
    if (t && readerEl) t.scrollTop = readerEl.scrollTop;
  }

  // —— 侧栏拖宽（与编辑分栏同款 pointer capture；夹取与持久化在 settings） ——

  let sideResize: "tree" | "toc" | null = null;

  function onSideResizeDown(e: PointerEvent, which: "tree" | "toc"): void {
    sideResize = which;
    const el = e.currentTarget as HTMLElement;
    el.classList.add("drag");
    el.setPointerCapture(e.pointerId);
  }

  function onSideResizeMove(e: PointerEvent): void {
    if (!sideResize) return;
    const r = (e.currentTarget as HTMLElement).parentElement?.getBoundingClientRect();
    if (!r) return;
    // 树宽 = 指针到主区左缘；目录宽 = 指针到主区右缘
    if (sideResize === "tree") setTreeWidth(e.clientX - r.left);
    else setTocWidth(r.right - e.clientX);
  }

  function onSideResizeUp(e: PointerEvent): void {
    (e.currentTarget as HTMLElement).classList.remove("drag");
    sideResize = null;
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      if (settingsOpen) {
        settingsOpen = false;
        return;
      }
      if (ctx) {
        ctx = null;
        return;
      }
    }
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === "t") {
      e.preventDefault();
      // ⌘T 让位给新建标签（macOS 惯例），主题切换移至 ⇧⌘T
      if (e.shiftKey) toggleTheme();
      else newTab();
    } else if (k === "w") {
      e.preventDefault();
      // 关到零标签后 ⌘W 关窗（此时不可能还有未保存修改）
      if (app.tabs.length > 0 && app.activeId !== null) void closeTab(app.activeId);
      else void win?.destroy();
    } else if (k === "o") {
      e.preventDefault();
      if (e.shiftKey) void onOpenFolder();
      else void onOpenFile();
    } else if (k === "e" && tab) {
      e.preventDefault();
      switchMode();
    } else if (k === "s" && tab?.mode === "edit") {
      e.preventDefault();
      void saveCurrent();
    } else if (k === "n") {
      e.preventDefault();
      onNewFile();
    } else if (e.key === "[" || e.key === "]") {
      e.preventDefault();
      const id = cycleTabId(app.tabs, app.activeId, e.key === "]" ? 1 : -1);
      if (id !== null) activateTab(id);
    } else if (/^[1-9]$/.test(e.key)) {
      e.preventDefault();
      const id = nthTabId(app.tabs, Number(e.key));
      if (id !== null) activateTab(id);
    }
  }

  onMount(() => {
    void (async () => {
      await wireFsChange();
      await restoreSession();
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      win = getCurrentWindow();
      // Tauri v2 注册 onCloseRequested 即拦截原生关闭：统一显式决定后 destroy。
      // 自动保存：关窗前先落盘，全部成功直接关；有保存失败才回退确认
      await win.onCloseRequested(async (e) => {
        e.preventDefault();
        if (!(await flushAutosave())) {
          const ok = await confirmDiscard(S.dirtyClose);
          if (!ok) return;
        }
        await win!.destroy();
      });
    })();
  });

  // 点击弹层与齿轮之外的任意处关闭设置/右键菜单（齿轮自身 onclick 会切换开合，跳过）
  function onWindowMousedown(e: MouseEvent): void {
    const t = e.target as HTMLElement;
    if (ctx && !t.closest(".ctx-pop")) ctx = null;
    if (!settingsOpen) return;
    if (t.closest(".settings-pop, .tb-actions .gear")) return;
    settingsOpen = false;
  }
</script>

<svelte:window onkeydown={onKeydown} onmousedown={onWindowMousedown} />

<div class="app">
  <header class="tb" data-tauri-drag-region>
    <!-- 红绿灯右侧留空作拖拽区（不放 logo 与应用名） -->
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div class="tb-tabs" role="tablist" aria-label={S.tabsLabel} data-tauri-drag-region ondblclick={onTabsDblclick}>
      {#each app.tabs as t (t.id)}
        <button
          type="button"
          role="tab"
          class="tab"
          class:active={t.id === app.activeId}
          class:empty={!t.path}
          aria-selected={t.id === app.activeId}
          onclick={(e) => onTabClick(e, t.id)}
          onauxclick={(e) => onTabAuxclick(e, t.id)}
          oncontextmenu={(e) => onTabContext(e, t.id)}
        >
          <span class="tab-name">{tabTitle(t, S.newTabTitle)}</span>
          {#if t.conflict}
            <span class="tab-dot warn" title={S.conflictTitle}></span>
          {:else if t.dirty}
            <span class="tab-dot" title={S.dirtySwitch}></span>
          {/if}
          <span class="tab-x" aria-hidden="true"><Icon name="x" size={12} strokeWidth={2} /></span>
        </button>
      {/each}
      <button type="button" class="tab-new" aria-label={S.newTab} data-tip={S.newTabHint} onclick={newTab}>
        <Icon name="plus" raw strokeWidth={2} size={13} />
      </button>
    </div>
    <div class="tb-actions">
      <button
        type="button"
        aria-label={S.toggleTree}
        aria-pressed={settings.treeCollapsed}
        data-tip={S.toggleTree}
        onclick={() => setTreeCollapsed(!settings.treeCollapsed)}
      ><Icon name="panelLeft" raw strokeWidth={2} /></button>
      <button
        type="button"
        aria-label={S.toggleToc}
        aria-pressed={settings.tocCollapsed}
        data-tip={S.toggleToc}
        onclick={() => setTocCollapsed(!settings.tocCollapsed)}
      ><Icon name="listTree" raw strokeWidth={2} /></button>
      <button type="button" aria-label={S.openFileHint} data-tip={S.openFileHint} onclick={onOpenFile}><Icon name="fileText" raw strokeWidth={2} /></button>
      <button type="button" aria-label={S.openFolderHint} data-tip={S.openFolderHint} onclick={onOpenFolder}><Icon name="folderOpen" raw strokeWidth={2} /></button>
      <button
        type="button"
        aria-label={S.newFileHint}
        data-tip={newFileTargetDir() ? S.newFileHint : S.newFileNoTarget}
        disabled={!newFileTargetDir()}
        onclick={onNewFile}
      ><Icon name="filePlus" raw strokeWidth={2} /></button>
      <button type="button" aria-label={S.toggleTheme} data-tip={S.themeHint} onclick={toggleTheme}>
        <Icon name={resolvedTheme() === "dark" ? "sun" : "moon"} raw strokeWidth={2} />
      </button>
      <button
        type="button"
        class="mode"
        aria-label={tab?.mode === "edit" ? S.toRead : S.toEdit}
        data-tip={tab?.mode === "edit" ? S.toRead : S.toEdit}
        onclick={switchMode}
      >
        <Icon name="pencilLine" raw strokeWidth={2} />
        <span>{tab?.mode === "edit" ? S.readMode : S.editMode}</span>
        {#if tab?.dirty}<span class="dirty-dot" aria-label="未保存"></span>{/if}
      </button>
      <button
        type="button"
        class="gear"
        aria-label={S.settings}
        aria-expanded={settingsOpen}
        aria-haspopup="dialog"
        data-tip={S.settings}
        onclick={() => (settingsOpen = !settingsOpen)}
      ><Icon name="settings2" raw strokeWidth={2} /></button>
    </div>
    {#if settingsOpen}
      <SettingsPanel />
    {/if}
  </header>
  {#if tab?.error && tab.mode === "edit"}
    <div class="save-banner" role="alert">{S.saveFailedBanner}：{tab.error}</div>
  {/if}
  <div class="main">
    {#if !settings.treeCollapsed}
      <aside class="side tree" style="width: {settings.treeWidth}px" aria-label="文件树">
        <FileTree />
      </aside>
      <div
        class="side-resizer res-tree"
        role="separator"
        aria-label="拖动调整文件树宽度，双击复位"
        onpointerdown={(e) => onSideResizeDown(e, "tree")}
        onpointermove={onSideResizeMove}
        onpointerup={onSideResizeUp}
        onpointercancel={onSideResizeUp}
        ondblclick={() => setTreeWidth(TREE_WIDTH_DEFAULT)}
      ></div>
    {/if}
    <section class="reader" bind:this={readerEl} use:overlayScrollbar onscroll={onReaderScroll}>
      {#if !tab || (tab.path === null && !tab.error)}
        <Welcome />
      {:else if tab.mode === "edit"}
        <EditorView />
      {:else}
        <ReaderView />
      {/if}
    </section>
    {#if !settings.tocCollapsed && tab && tab.mode === "read" && tab.path !== null}
      <div
        class="side-resizer res-toc"
        role="separator"
        aria-label="拖动调整目录宽度，双击复位"
        onpointerdown={(e) => onSideResizeDown(e, "toc")}
        onpointermove={onSideResizeMove}
        onpointerup={onSideResizeUp}
        onpointercancel={onSideResizeUp}
        ondblclick={() => setTocWidth(TOC_WIDTH_DEFAULT)}
      ></div>
      <aside class="side toc" style="width: {settings.tocWidth}px" aria-label="文档目录">
        <TocPanel />
      </aside>
    {/if}
  </div>
</div>

{#if tab?.conflict}
  <div class="conflict-overlay" role="alertdialog" aria-label={S.conflictTitle}>
    <div class="conflict-box">
      <div class="c-title">{S.conflictTitle}</div>
      <div class="c-path">{tab.conflict}</div>
      <div class="c-actions">
        <button
          type="button"
          class="pri"
          onclick={() => {
            const p = tab.conflict;
            tab.conflict = null;
            if (p) void openFile(p, { force: true });
          }}>{S.conflictReload}</button
        >
        <button type="button" onclick={() => (tab.conflict = null)}>{S.conflictKeep}</button>
      </div>
    </div>
  </div>
{/if}

{#if ctx && ctxTab}
  <div class="ctx-pop" role="menu" style="left:{ctx.x}px; top:{ctx.y}px">
    <button type="button" role="menuitem" onclick={() => onCtxAction("close")}>{S.closeTab}</button>
    {#if app.tabs.length > 1}
      <button type="button" role="menuitem" onclick={() => onCtxAction("closeOthers")}>{S.closeOtherTabs}</button>
    {/if}
    {#if ctxTab.path}
      <button type="button" role="menuitem" onclick={() => onCtxAction("reveal")}>{S.revealInFinder}</button>
      <button type="button" role="menuitem" onclick={() => onCtxAction("copy")}>{S.copyPath}</button>
    {/if}
  </div>
{/if}

<Lightbox />
