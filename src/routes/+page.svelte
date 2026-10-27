<script lang="ts">
  import { onMount } from "svelte";
  import { S } from "$lib/ui-strings";
  import { resolvedTheme, setThemeMode, setTocCollapsed, setTreeCollapsed, settings } from "$lib/settings.svelte";
  import { app, openFile, openFolder, restoreSession, saveCurrent, switchMode, wireFsChange } from "$lib/state/app.svelte";
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

  function toggleTheme(): void {
    // 直接按当前生效主题翻转：旧的 system→light→dark 三态循环在 system=light 时
    // 第一次点击无可见变化（正是"要点两次"的根因）
    setThemeMode(resolvedTheme() === "dark" ? "light" : "dark");
  }

  async function onOpenFile(): Promise<void> {
    const p = await pickFile();
    if (p) await openFile(p);
  }

  async function onOpenFolder(): Promise<void> {
    const p = await pickFolder();
    if (p) await openFolder(p);
  }

  // 「当前目录」：当前文件所在目录；无文件时用工作区根。皆无则入口禁用。
  function newFileTargetDir(): string | null {
    return app.currentPath ? dirname(app.currentPath) : app.workspaceRoot;
  }

  function onNewFile(): void {
    const dir = newFileTargetDir();
    if (!dir) return;
    // 命名行在文件树中就地出现，树收起时先展开
    if (settings.treeCollapsed) setTreeCollapsed(false);
    app.creating = dir;
  }

  function basename(path: string | null): string {
    if (!path) return "";
    return path.split("/").pop() ?? "";
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape" && settingsOpen) {
      settingsOpen = false;
      return;
    }
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === "t") {
      e.preventDefault();
      toggleTheme();
    } else if (k === "o") {
      e.preventDefault();
      if (e.shiftKey) void onOpenFolder();
      else void onOpenFile();
    } else if (k === "e" && app.doc) {
      e.preventDefault();
      switchMode();
    } else if (k === "s" && app.mode === "edit") {
      e.preventDefault();
      void saveCurrent();
    } else if (k === "n") {
      e.preventDefault();
      onNewFile();
    }
  }

  onMount(() => {
    void (async () => {
      await wireFsChange();
      await restoreSession();
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      // Tauri v2 注册 onCloseRequested 即拦截原生关闭：统一显式决定后 destroy
      await win.onCloseRequested(async (e) => {
        e.preventDefault();
        if (app.dirty) {
          const ok = await confirmDiscard(S.dirtyClose);
          if (!ok) return;
        }
        await win.destroy();
      });
    })();
  });

  // 点击弹层与齿轮之外的任意处关闭设置（齿轮自身 onclick 会切换开合，跳过）
  function onWindowMousedown(e: MouseEvent): void {
    if (!settingsOpen) return;
    const t = e.target as HTMLElement;
    if (t.closest(".settings-pop, .tb-actions .gear")) return;
    settingsOpen = false;
  }
</script>

<svelte:window onkeydown={onKeydown} onmousedown={onWindowMousedown} />

<div class="app">
  <header class="tb" data-tauri-drag-region>
    <div class="logo" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 16 16">
        <path
          d="M8 1.5C5.5 5 3.5 7.2 3.5 9.8a4.5 4.5 0 0 0 9 0C12.5 7.2 10.5 5 8 1.5Z"
          fill="var(--accent)"
        />
      </svg>
      <span>{S.appName}</span>
    </div>
    <div class="tb-title" data-tauri-drag-region>
      <button
        type="button"
        class="tb-file"
        title={S.revealInFinder}
        onclick={() => app.currentPath && void revealInFinder(app.currentPath).catch(() => {})}
      >{basename(app.currentPath)}</button>
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
      <button type="button" aria-label={S.themeHint} data-tip={S.themeHint} onclick={toggleTheme}>
        <Icon name={resolvedTheme() === "dark" ? "sun" : "moon"} raw strokeWidth={2} />
      </button>
      <button
        type="button"
        class="mode"
        aria-label={app.mode === "edit" ? S.toRead : S.toEdit}
        data-tip={app.mode === "edit" ? S.toRead : S.toEdit}
        onclick={switchMode}
      >
        <Icon name="pencilLine" raw strokeWidth={2} />
        <span>{app.mode === "edit" ? S.readMode : S.editMode}</span>
        {#if app.dirty}<span class="dirty-dot" aria-label="未保存"></span>{/if}
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
  {#if app.error && app.mode === "edit"}
    <div class="save-banner" role="alert">{S.saveFailedBanner}：{app.error}</div>
  {/if}
  <div class="main">
    {#if !settings.treeCollapsed}
      <aside class="side tree" aria-label="文件树">
        <FileTree />
      </aside>
    {/if}
    <section class="reader" use:overlayScrollbar>
      {#if app.currentPath === null && app.error === null}
        <Welcome />
      {:else if app.mode === "edit"}
        <EditorView />
      {:else}
        <ReaderView />
      {/if}
    </section>
    {#if !settings.tocCollapsed && app.mode === "read"}
      <aside class="side toc" aria-label="文档目录">
        <TocPanel />
      </aside>
    {/if}
  </div>
</div>

{#if app.conflictPath}
  <div class="conflict-overlay" role="alertdialog" aria-label={S.conflictTitle}>
    <div class="conflict-box">
      <div class="c-title">{S.conflictTitle}</div>
      <div class="c-path">{app.conflictPath}</div>
      <div class="c-actions">
        <button
          type="button"
          class="pri"
          onclick={() => {
            const p = app.conflictPath;
            app.conflictPath = null;
            if (p) void openFile(p, { force: true });
          }}>{S.conflictReload}</button
        >
        <button type="button" onclick={() => (app.conflictPath = null)}>{S.conflictKeep}</button>
      </div>
    </div>
  </div>
{/if}

<Lightbox />
