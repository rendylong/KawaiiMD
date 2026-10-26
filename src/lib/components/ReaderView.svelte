<script lang="ts">
  import { app, openFile } from "../state/app.svelte";
  import { dirname, openExternalUrl, revealInFinder } from "../fs/tauri";
  import { mountDoc } from "../markdown/pipeline";
  import { linkAction } from "../markdown/links";
  import { resolvedTheme } from "../settings.svelte";

  let container: HTMLElement | undefined = $state();
  let gen = 0;

  $effect(() => {
    const src = app.docSource;
    const path = app.currentPath;
    const theme = resolvedTheme();
    if (!container || !src || !path) return;
    const my = ++gen;
    const el = container;
    void mountDoc(el, src, dirname(path), theme).then(() => {
      if (my !== gen) return;
      el.classList.remove("doc-fade");
      void el.offsetWidth;
      el.classList.add("doc-fade");
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
    if (!href || !app.currentPath) return;
    const action = linkAction(href, dirname(app.currentPath));
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

{#if app.error}
  <div class="error-page" role="alert">{app.error}</div>
{:else if app.loading}
  <div class="doc skeleton" aria-busy="true">
    <div class="sk-line" style="width: 38%"></div>
    <div class="sk-line" style="width: 92%"></div>
    <div class="sk-line" style="width: 85%"></div>
    <div class="sk-line" style="width: 60%"></div>
  </div>
{:else if app.doc}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="doc" role="presentation" bind:this={container} onclick={onDocClick}></div>
{/if}
