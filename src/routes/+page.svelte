<script lang="ts">
  import { S } from "$lib/ui-strings";
  import { resolvedTheme, setThemeMode, settings } from "$lib/settings.svelte";
  import Icon from "$lib/components/Icon.svelte";

  function cycleTheme(): void {
    setThemeMode(settings.themeMode === "system" ? "light" : settings.themeMode === "light" ? "dark" : "system");
  }

  function onKeydown(e: KeyboardEvent): void {
    if (!(e.metaKey || e.ctrlKey)) return;
    if (e.key.toLowerCase() === "t") {
      e.preventDefault();
      cycleTheme();
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
    <div class="tb-file" title={S.revealInFinder}></div>
    <div class="tb-actions">
      <button type="button" aria-label={S.toggleTree}><Icon name="panelLeft" /></button>
      <button type="button" aria-label={S.openFileHint}><Icon name="fileText" /></button>
      <button type="button" aria-label={S.openFolderHint}><Icon name="folderOpen" /></button>
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
    <section class="reader" aria-label="阅读区"></section>
    <aside class="side toc" aria-label="文档目录"></aside>
  </div>
</div>
