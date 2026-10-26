<script lang="ts">
  import { app, openFile } from "../state/app.svelte";
  import { convertFileSrc, dirname, listDir, revealInFinder } from "../fs/tauri";
  import { classifyEntry, sortEntries } from "../fs/entries";
  import Icon from "./Icon.svelte";

  type Node = {
    name: string;
    path: string;
    isDir: boolean;
    depth: number;
    open: boolean;
    loading: boolean;
    showSpin: boolean;
    children: Node[];
  };

  let root = $state<{ path: string } | null>(null);
  let nodes = $state<Node[]>([]);
  let container: HTMLElement | undefined = $state();
  let spinnerTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const rootPath = $derived(app.workspaceRoot ?? (app.currentPath ? dirname(app.currentPath) : null));

  $effect(() => {
    const r = rootPath;
    if (r && root?.path !== r) {
      root = { path: r };
      nodes = [];
      void loadChildren(r, 0).then((children) => {
        nodes = children;
      });
    }
  });

  async function loadChildren(dir: string, depth: number): Promise<Node[]> {
    const entries = sortEntries(await listDir(dir));
    return entries.map((e) => ({
      name: e.name,
      path: `${dir}/${e.name}`,
      isDir: e.isDir,
      depth,
      open: false,
      loading: false,
      showSpin: false,
      children: [],
    }));
  }

  function findAndToggle(nodes: Node[], dir: Node): Node[] {
    return nodes.map((n) => {
      if (n === dir) return { ...n, open: !n.open };
      if (n.children.length > 0) return { ...n, children: findAndToggle(n.children, dir) };
      return n;
    });
  }

  async function toggle(node: Node): Promise<void> {
    const opening = !node.open;
    nodes = findAndToggle(nodes, node);
    if (!opening) return;
    if (node.children.length === 0) {
      node.loading = true;
      const timer = setTimeout(() => {
        node.showSpin = true;
      }, 200);
      spinnerTimers.set(node.path, timer);
      try {
        const children = await loadChildren(node.path, node.depth + 1);
        node.children = children;
      } finally {
        clearTimeout(timer);
        spinnerTimers.delete(node.path);
        node.loading = false;
        node.showSpin = false;
      }
    }
  }

  function iconFor(node: Node): string {
    const kind = classifyEntry(node.name, node.isDir);
    if (kind === "dir") return "folder";
    if (kind === "image") return "image";
    return "fileText";
  }

  function onNodeClick(node: Node): void {
    if (node.isDir) void toggle(node);
    else if (classifyEntry(node.name, false) === "markdown") void openFile(node.path);
    else if (classifyEntry(node.name, false) === "image") app.lightboxSrc = convertFileSrc(node.path);
    else void revealInFinder(node.path).catch(() => {});
  }

  function visibleNodes(list: Node[], out: Node[] = []): Node[] {
    for (const n of list) {
      out.push(n);
      if (n.open && n.children.length > 0) visibleNodes(n.children, out);
    }
    return out;
  }

  function onKeydown(e: KeyboardEvent): void {
    if (!container) return;
    const items = Array.from(container.querySelectorAll<HTMLElement>("[data-node]"));
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" && idx >= 0 && idx < items.length - 1) {
      e.preventDefault();
      items[idx + 1].focus();
    } else if (e.key === "ArrowUp" && idx > 0) {
      e.preventDefault();
      items[idx - 1].focus();
    } else if (e.key === "Enter" && idx >= 0) {
      e.preventDefault();
      items[idx].click();
    }
  }
</script>

{#snippet row(node: Node)}
  <button
    type="button"
    data-node
    class="t-item"
    class:active={app.currentPath === node.path}
    class:open={node.open}
    style="padding-left: {8 + node.depth * 14}px"
    onclick={() => onNodeClick(node)}
  >
    {#if node.isDir}
      <span class="tw" aria-hidden="true">{node.open ? "▾" : "▸"}</span>
    {:else}
      <span class="tw" aria-hidden="true"></span>
    {/if}
    <Icon name={iconFor(node)} />
    <span class="t-name">{node.name}</span>
    {#if node.showSpin}
      <span class="spin" aria-hidden="true"></span>
    {/if}
  </button>
  {#if node.open && node.children.length > 0}
    {#each node.children as child (child.path)}
      {@render row(child)}
    {/each}
  {/if}
{/snippet}

<div class="file-tree" role="tree" tabindex="0" bind:this={container} onkeydown={onKeydown} aria-label="文件树">
  <div class="t-head">{rootPath?.split("/").pop() ?? ""}</div>
  {#each nodes as node (node.path)}
    {@render row(node)}
  {/each}
</div>
