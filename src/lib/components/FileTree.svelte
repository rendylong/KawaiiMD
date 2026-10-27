<script lang="ts">
  import { tick } from "svelte";
  import { app, createFileAt, openFile } from "../state/app.svelte";
  import { convertFileSrc, dirname, listDir, revealInFinder } from "../fs/tauri";
  import { classifyEntry, filterNodes, sortEntries } from "../fs/entries";
  import { finalizeName, nextUntitled, validateName, type NameIssue } from "../fs/new-file";
  import { nextStickyRoot } from "../fs/tree-root";
  import { settings } from "../settings.svelte";
  import { S } from "../ui-strings";
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
  let stickyRoot = $state<string | null>(null);
  let creatingPath = $state<string | null>(null);
  let newName = $state("");
  let newErr = $state<string | null>(null);
  let busy = false;

  // 工作区优先；否则树根粘住首个挂载目录，仅当新文件在树外时迁移，
  // 避免点子目录文件后整棵树搬进子目录、上级不可返回。
  const rootPath = $derived(app.workspaceRoot ?? stickyRoot ?? (app.currentPath ? dirname(app.currentPath) : null));

  $effect(() => {
    const candidate = app.currentPath ? dirname(app.currentPath) : null;
    stickyRoot = nextStickyRoot(stickyRoot, candidate);
  });

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

  // app.creating 是新建入口的唯一真相：树内 ➕ 与工具栏 ⌘N 都写它，这里统一展开定位
  $effect(() => {
    const target = app.creating;
    if (target === null) {
      creatingPath = null;
      newErr = null;
      return;
    }
    void (async () => {
      if (target !== rootPath) await ensurePathVisible(target);
      if (app.creating === target) {
        creatingPath = target;
        newName = nextUntitled(siblingNames(target));
        newErr = null;
      }
    })();
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

  async function toggle(node: Node): Promise<void> {
    node.open = !node.open;
    if (!node.open) return;
    if (node.children.length === 0) {
      node.loading = true;
      const timer = setTimeout(() => {
        node.showSpin = true;
      }, 200);
      try {
        node.children = await loadChildren(node.path, node.depth + 1);
      } finally {
        clearTimeout(timer);
        node.loading = false;
        node.showSpin = false;
      }
    }
  }

  function findNode(path: string): Node | null {
    let found: Node | null = null;
    const walk = (list: Node[]) => {
      for (const n of list) {
        if (n.path === path) {
          found = n;
          return;
        }
        if (n.children.length) walk(n.children);
        if (found) return;
      }
    };
    walk(nodes);
    return found;
  }

  // 新建目标目录在树内但父链未加载时，从树根逐级加载并展开
  async function ensurePathVisible(dir: string): Promise<void> {
    const r = rootPath;
    if (!r || dir === r || !dir.startsWith(`${r}/`)) return;
    const segs = dir.slice(r.length + 1).split("/");
    let list = nodes;
    let parent = r;
    let depth = 0;
    for (const seg of segs) {
      const path = `${parent}/${seg}`;
      let node = list.find((n) => n.path === path);
      if (!node) {
        const fresh = await loadChildren(parent, depth);
        list.splice(0, list.length, ...fresh);
        node = list.find((n) => n.path === path);
        if (!node) return;
      }
      if (!node.isDir) return;
      node.open = true;
      if (node.children.length === 0) {
        node.loading = true;
        try {
          node.children = await loadChildren(node.path, depth + 1);
        } finally {
          node.loading = false;
        }
      }
      list = node.children;
      parent = path;
      depth += 1;
    }
  }

  async function reloadDir(dir: string): Promise<void> {
    const r = rootPath;
    if (!r) return;
    if (dir === r) {
      nodes = await loadChildren(r, 0);
      return;
    }
    const node = findNode(dir);
    if (node?.isDir) node.children = await loadChildren(node.path, node.depth + 1);
  }

  // 重名探测用未过滤的完整 children：文件系统里存在即冲突，与是否显示无关
  function siblingNames(dir: string | null): string[] {
    if (!dir) return [];
    if (dir === rootPath) return nodes.map((n) => n.name);
    return findNode(dir)?.children.map((c) => c.name) ?? [];
  }

  function mapIssue(issue: NameIssue | null): string | null {
    if (issue === null) return null;
    if (issue === "empty") return S.nameEmpty;
    if (issue === "invalid") return S.nameInvalid;
    return `“${finalizeName(newName.trim())}”${S.nameExists}`;
  }

  function autofocusName(el: HTMLInputElement): void {
    const dot = el.value.lastIndexOf(".");
    el.focus();
    el.setSelectionRange(0, dot > 0 ? dot : el.value.length);
  }

  function onNameInput(e: Event): void {
    newName = (e.currentTarget as HTMLInputElement).value;
    newErr = mapIssue(validateName(newName, siblingNames(creatingPath)));
  }

  function onNameKeydown(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      e.preventDefault();
      const issue = validateName(newName, siblingNames(creatingPath));
      if (issue) {
        newErr = mapIssue(issue);
        const el = e.currentTarget as HTMLInputElement;
        el.classList.remove("shake");
        void el.offsetWidth;
        el.classList.add("shake");
        return;
      }
      void submitCreate();
    } else if (e.key === "Escape") {
      e.preventDefault();
      app.creating = null;
    }
  }

  // blur 语义与 Finder 一致：合法即提交、非法视作放弃
  function onNameBlur(): void {
    if (!creatingPath || busy) return;
    if (validateName(newName, siblingNames(creatingPath))) app.creating = null;
    else void submitCreate();
  }

  async function submitCreate(): Promise<void> {
    const dir = creatingPath;
    if (!dir) return;
    busy = true;
    try {
      const r = await createFileAt(dir, newName);
      if (r.ok) {
        await reloadDir(dir);
        await tick();
        container?.querySelector(".t-item.active")?.scrollIntoView({ block: "nearest" });
      } else if (r.error) {
        newErr = r.error;
      }
      // 用户在脏确认点了取消：保留编辑行与已输入名称
    } finally {
      busy = false;
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

{#snippet editingRow(parentDepth: number)}
  <div class="t-row">
    <div class="edit-item" style="padding-left: {8 + (parentDepth + 1) * 14}px">
      <span class="tw" aria-hidden="true"></span>
      <Icon name="fileText" />
      <input
        class="new-name"
        value={newName}
        aria-label={S.newFileName}
        spellcheck="false"
        use:autofocusName
        oninput={onNameInput}
        onkeydown={onNameKeydown}
        onblur={onNameBlur}
      />
    </div>
    {#if newErr}
      <div class="t-err" role="alert">{newErr}</div>
    {/if}
  </div>
{/snippet}

{#snippet row(node: Node)}
  <div class="t-row">
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
    {#if node.isDir}
      <button
        type="button"
        class="row-add"
        aria-label={S.newFileInDir}
        onclick={() => (app.creating = node.path)}
        onmousedown={(e) => e.preventDefault()}
      ><Icon name="plus" size={13} /></button>
    {/if}
  </div>
  {#if node.open && (node.children.length > 0 || creatingPath === node.path)}
    {#if creatingPath === node.path}{@render editingRow(node.depth)}{/if}
    {#each filterNodes(node.children, settings.showAllFiles) as child (child.path)}
      {@render row(child)}
    {/each}
  {/if}
{/snippet}

<div class="file-tree" role="tree" tabindex="0" bind:this={container} onkeydown={onKeydown} aria-label="文件树">
  <div class="t-head">
    <span class="t-head-name">{rootPath?.split("/").pop() ?? ""}</span>
    {#if rootPath}
      <button
        type="button"
        class="head-add"
        aria-label={S.newFileInDir}
        onclick={() => (app.creating = rootPath)}
        onmousedown={(e) => e.preventDefault()}
      ><Icon name="plus" size={13} /></button>
    {/if}
  </div>
  {#if creatingPath === rootPath}{@render editingRow(-1)}{/if}
  {#each filterNodes(nodes, settings.showAllFiles) as node (node.path)}
    {@render row(node)}
  {/each}
</div>
