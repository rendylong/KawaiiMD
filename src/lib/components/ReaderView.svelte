<script lang="ts">
  import { activeTab, app, openFile } from "../state/app.svelte";
  import { dirname, openExternalUrl, revealInFinder } from "../fs/tauri";
  import { mountDoc } from "../markdown/pipeline";
  import { linkAction } from "../markdown/links";
  import { resolvedTheme } from "../settings.svelte";

  let container: HTMLElement | undefined = $state();
  let gen = 0;
  let restoredForId: number | -1 = -1;

  $effect(() => {
    const tab = activeTab();
    void tab?.id;
    void tab?.docVersion;
    const src = tab?.docSource;
    const path = tab?.path;
    const theme = resolvedTheme();
    if (!container || !src || !path) return;
    const my = ++gen;
    const el = container;
    void mountDoc(el, src, dirname(path), theme).then(() => {
      if (my !== gen) return;
      el.classList.remove("doc-fade");
      void el.offsetWidth;
      el.classList.add("doc-fade");
      // 滚动位置只在「换标签」时恢复；同标签重载（外部修改）不动滚动，
      // 那由 fs-change 流程的标题锚点恢复负责，两套恢复互不覆盖
      if (tab && tab.id !== restoredForId) {
        restoredForId = tab.id;
        const reader = el.closest<HTMLElement>(".reader");
        if (reader) reader.scrollTop = tab.scrollTop;
      }
    });
  });

  function onDocClick(e: MouseEvent): void {
    const el = e.target as HTMLElement;
    if (el.tagName === "IMG") {
      app.lightboxSrc = (el as HTMLImageElement).src;
      return;
    }
    const a = el.closest("a");
    if (!a) return;
    const href = a.getAttribute("href");
    const tab = activeTab();
    if (!href || !tab?.path) return;
    const action = linkAction(href, dirname(tab.path));
    if (action.type === "anchor") {
      e.preventDefault();
      container?.querySelector(`[id="${action.target}"]`)?.scrollIntoView({ behavior: "smooth" });
    } else if (action.type === "external") {
      e.preventDefault();
      void openExternalUrl(action.target).catch(() => {});
    } else if (action.type === "md") {
      e.preventDefault();
      void openFile(action.target);
    } else {
      e.preventDefault();
      void revealInFinder(action.target).catch(() => {});
    }
  }
</script>

{#if activeTab()?.error}
  <div class="error-page" role="alert">{activeTab()?.error}</div>
{:else if activeTab()?.loading}
  <div class="doc skeleton" aria-busy="true">
    <div class="sk-line" style="width: 38%"></div>
    <div class="sk-line" style="width: 92%"></div>
    <div class="sk-line" style="width: 85%"></div>
    <div class="sk-line" style="width: 60%"></div>
  </div>
{:else if activeTab()?.doc}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="doc" role="presentation" bind:this={container} onclick={onDocClick}></div>
{/if}
