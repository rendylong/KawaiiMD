<script lang="ts">
  import { app } from "../state/app.svelte";

  let zoomed = $state(false);

  function close(): void {
    app.lightboxSrc = null;
    zoomed = false;
  }

  function onKeydown(e: KeyboardEvent): void {
    if (app.lightboxSrc && e.key === "Escape") close();
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if app.lightboxSrc}
  <button
    type="button"
    class="lb-overlay"
    aria-label="点击或按 Esc 关闭，滚轮缩放"
    onclick={close}
    onwheel={(e) => {
      e.preventDefault();
      zoomed = !zoomed;
    }}
  >
    <img class:zoomed src={app.lightboxSrc} alt="" />
  </button>
{/if}
