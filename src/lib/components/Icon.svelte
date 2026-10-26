<script lang="ts">
  import { icons } from "./icons";

  let { name, size = 15 }: { name: string; size?: number } = $props();
  const def = $derived(icons[name]);
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if def}
    <path d={def.d} transform={def.transform} />
  {/if}
</svg>
