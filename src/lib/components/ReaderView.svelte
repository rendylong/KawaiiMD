<script lang="ts">
  import { app } from "../state/app.svelte";

  let container: HTMLElement | undefined = $state();

  $effect(() => {
    if (container && app.doc) {
      container.innerHTML = app.doc.html;
      container.classList.remove("doc-fade");
      void container.offsetWidth;
      container.classList.add("doc-fade");
    }
  });
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
  <div class="doc" bind:this={container}></div>
{/if}
