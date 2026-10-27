<script lang="ts">
  import { icons } from "./icons";

  // raw=true 跳过表内归一 transform，按 Lucide 原始几何渲染（工具栏/欢迎页用）
  let { name, size = 15, strokeWidth = 1.7, raw = false }: { name: string; size?: number; strokeWidth?: number; raw?: boolean } = $props();
  const def = $derived(icons[name]);
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if def}
    <path d={def.d} transform={raw ? undefined : def.transform} />
  {/if}
</svg>
