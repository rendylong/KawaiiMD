<script lang="ts">
  import { activeTab } from "../state/app.svelte";
  import { activeFromOffsets } from "../dom/scroll";

  let panel: HTMLElement | undefined = $state();
  let readerEl: HTMLElement | null = null;
  let raf = 0;

  $effect(() => {
    readerEl = panel?.closest(".app")?.querySelector<HTMLElement>(".reader") ?? null;
  });

  function onReaderScroll(): void {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const doc = activeTab()?.doc;
      if (!readerEl || !doc) return;
      const offsets = doc.toc.map((t) => {
        const el = readerEl?.querySelector<HTMLElement>(`[id="${t.id}"]`);
        return el ? el.offsetTop : 0;
      });
      const active = activeFromOffsets(offsets, readerEl.scrollTop + 90);
      if (!panel) return;
      panel.querySelectorAll<HTMLElement>("a[data-toc]").forEach((a, i) => {
        a.classList.toggle("cur", i === active);
      });
    });
  }

  $effect(() => {
    readerEl?.addEventListener("scroll", onReaderScroll, { passive: true });
    return () => readerEl?.removeEventListener("scroll", onReaderScroll);
  });

  function jump(id: string): void {
    readerEl?.querySelector(`[id="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
</script>

<div class="toc-panel" bind:this={panel}>
  <div class="c-h">本页目录</div>
  {#each activeTab()?.doc?.toc ?? [] as t (t.id)}
    <a
      href="#{t.id}"
      data-toc
      class:lv3={t.level >= 3}
      style="padding-left: {10 + Math.max(0, t.level - 1) * 14}px"
      onclick={(e) => {
        e.preventDefault();
        jump(t.id);
      }}>{t.text}</a
    >
  {/each}
</div>
