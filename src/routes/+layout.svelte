<script lang="ts">
  import "../app.css";
  import "../lib/theme.css";
  import { resolvedTheme, watchSystemTheme } from "$lib/settings.svelte";

  let { children } = $props();

  $effect(() => {
    document.documentElement.dataset.theme = resolvedTheme();
  });

  $effect(() => {
    return watchSystemTheme(() => {
      document.documentElement.dataset.theme = resolvedTheme();
    });
  });
</script>

{@render children()}
