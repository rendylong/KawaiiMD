<script lang="ts">
  import { S } from "$lib/ui-strings";
  import { resolvedTheme, setThemeMode, settings } from "$lib/settings.svelte";
  import { app, openFile, openFolder } from "$lib/state/app.svelte";
  import { pickFile, pickFolder } from "$lib/fs/tauri";
  import Icon from "$lib/components/Icon.svelte";
  import ReaderView from "$lib/components/ReaderView.svelte";
  import Welcome from "$lib/components/Welcome.svelte";

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
    }
  }
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
    <div class="tb-file" title={S.revealInFinder}>{basename(app.currentPath)}</div>
    <div class="tb-actions">
      <button type="button" aria-label={S.toggleTree}><Icon name="panelLeft" /></button>
      <button type="button" aria-label={S.openFileHint} onclick={onOpenFile}><Icon name="fileText" /></button>
      <button type="button" aria-label={S.openFolderHint} onclick={onOpenFolder}><Icon name="folderOpen" /></button>
      <button type="button" aria-label={S.themeHint} onclick={cycleTheme}>
        <Icon name={resolvedTheme() === "dark" ? "sun" : "moon"} />
      </button>
      <button type="button" class="mode" aria-label={S.toEdit}>
        <Icon name="pencilLine" />
        <span>{S.editMode}</span>
      </button>
    </div>
  </header>
  <div class="main">
    <aside class="side tree" aria-label="文件树"></aside>
    <section class="reader">
      {#if app.currentPath === null && app.error === null}
        <Welcome />
      {:else}
        <ReaderView />
      {/if}
    </section>
    <aside class="side toc" aria-label="文档目录"></aside>
  </div>
</div>
