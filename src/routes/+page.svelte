<script lang="ts">
  import { onMount } from "svelte";
  import { S } from "$lib/ui-strings";
  import { resolvedTheme, setThemeMode, setTocCollapsed, setTreeCollapsed, settings } from "$lib/settings.svelte";
  import { app, openFile, openFolder, restoreSession, saveCurrent, switchMode, wireFsChange } from "$lib/state/app.svelte";
  import { confirmDiscard, dirname, pickFile, pickFolder, revealInFinder } from "$lib/fs/tauri";
  import Icon from "$lib/components/Icon.svelte";
  import ReaderView from "$lib/components/ReaderView.svelte";
  import Welcome from "$lib/components/Welcome.svelte";
  import FileTree from "$lib/components/FileTree.svelte";
  import TocPanel from "$lib/components/TocPanel.svelte";
  import EditorView from "$lib/components/EditorView.svelte";
  import Lightbox from "$lib/components/Lightbox.svelte";

  function cycleTheme(): void {
    setThemeMode(settings.themeMode === "system" ? "light" : settings.themeMode === "light" ? "dark" : "system");
  }

  async function onOpenFile(): Promise<void> {
    const p = await pickFile();
    if (p) await openFile(p);
  }

  async function onOpenFolder(): Promise<void> {
    const p = await pickFolder();
    if (p) await openFolder(p);
  }

  function basename(path: string | null): string {
    if (!path) return "";
    return path.split("/").pop() ?? "";
  }

  function onKeydown(e: KeyboardEvent): void {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === "t") {
      e.preventDefault();
      cycleTheme();
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
</script>

<svelte:window onkeydown={onKeydown} />

<div class="app">
  <header class="tb">
    <div class="logo">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M8 1.5C5.5 5 3.5 7.2 3.5 9.8a4.5 4.5 0 0 0 9 0C12.5 7.2 10.5 5 8 1.5Z"
          fill="var(--accent)"
        />
      </svg>
      <span>{S.appName}</span>
    </div>
    <button
      type="button"
      class="tb-file"
      title={S.revealInFinder}
      onclick={() => app.currentPath && void revealInFinder(app.currentPath).catch(() => {})}
    >{basename(app.currentPath)}</button>
    <div class="tb-actions">
      <button
        type="button"
        aria-label={S.toggleTree}
        aria-pressed={settings.treeCollapsed}
        onclick={() => setTreeCollapsed(!settings.treeCollapsed)}
      ><Icon name="panelLeft" /></button>
      <button
        type="button"
        aria-label={S.toggleToc}
        aria-pressed={settings.tocCollapsed}
        onclick={() => setTocCollapsed(!settings.tocCollapsed)}
      ><Icon name="listTree" /></button>
      <button type="button" aria-label={S.openFileHint} onclick={onOpenFile}><Icon name="fileText" /></button>
      <button type="button" aria-label={S.openFolderHint} onclick={onOpenFolder}><Icon name="folderOpen" /></button>
      <button type="button" aria-label={S.themeHint} onclick={cycleTheme}>
        <Icon name={resolvedTheme() === "dark" ? "sun" : "moon"} />
      </button>
      <button
        type="button"
        class="mode"
        aria-label={app.mode === "edit" ? S.toRead : S.toEdit}
        onclick={switchMode}
      >
        <Icon name="pencilLine" />
        <span>{app.mode === "edit" ? S.readMode : S.editMode}</span>
        {#if app.dirty}<span class="dirty-dot" aria-label="未保存"></span>{/if}
      </button>
    </div>
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
    <section class="reader">
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
