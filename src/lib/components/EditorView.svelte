<script lang="ts">
  import { EditorState } from "@codemirror/state";
  import { EditorView, keymap } from "@codemirror/view";
  import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
  import { markdown } from "@codemirror/lang-markdown";
  import { app, openFile, setError } from "../state/app.svelte";
  import { dirname, writeTextFile } from "../fs/tauri";
  import { mountDoc } from "../markdown/pipeline";
  import { resolvedTheme, setSplit, settings } from "../settings.svelte";
  import { headingAtLine } from "../editor/sync";
  import { S } from "../ui-strings";
  import type { Doc } from "../types";

  let editorHost: HTMLElement;
  let previewHost: HTMLElement;
  let divider: HTMLElement;
  let cm: EditorView | null = null;
  let snapshot = "";
  let previewDoc: Doc | null = null;
  let previewTimer: ReturnType<typeof setTimeout> | undefined;
  let programmaticScrollUntil = 0;

  const cmTheme = EditorView.theme({
    "&": { height: "100%", fontSize: "13.5px", backgroundColor: "var(--bg-side)", color: "var(--fg)" },
    ".cm-scroller": {
      fontFamily: "var(--font-mono)",
      lineHeight: "1.75",
    },
    ".cm-content": { padding: "20px 0 60vh" },
    ".cm-gutters": { display: "none" },
    "&.cm-focused": { outline: "none" },
  });

  async function refreshPreview(): Promise<void> {
    if (!cm || !previewHost || !app.currentPath) return;
    const src = cm.state.doc.toString();
    previewDoc = await mountDoc(previewHost, src, dirname(app.currentPath), resolvedTheme());
  }

  function schedulePreview(): void {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => void refreshPreview(), 500);
  }

  async function save(): Promise<boolean> {
    if (!cm || !app.currentPath) return true;
    const src = cm.state.doc.toString();
    try {
      app.savedMtime = await writeTextFile(app.currentPath, src);
      snapshot = src;
      app.dirty = false;
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }

  function syncPreviewToEditor(): void {
    if (!cm || !previewHost || !previewDoc) return;
    const topLine = cm.state.doc.lineAt(cm.lineBlockAtHeight(cm.dom.scrollTop).from).number - 1;
    const heading = headingAtLine(previewDoc.headingLines, topLine);
    if (!heading) return;
    const el = previewHost.querySelector(`[id="${heading.id}"]`);
    if (!el) return;
    programmaticScrollUntil = Date.now() + 100;
    el.scrollIntoView({ behavior: "auto", block: "start" });
  }

  function syncEditorToPreview(): void {
    if (!cm || !previewDoc) return;
    if (Date.now() < programmaticScrollUntil) return;
    let cur: { id: string; line: number } | null = null;
    previewDoc.toc.forEach((t) => {
      const el = previewHost?.querySelector<HTMLElement>(`[id="${t.id}"]`);
      const h = previewDoc?.headingLines.find((x) => x.id === t.id);
      if (el && h && el.offsetTop <= (previewHost?.scrollTop ?? 0) + 90) cur = { id: t.id, line: h.line };
    });
    if (!cur) return;
    const line = previewDoc.headingLines.find((h) => h.id === cur?.id);
    if (!line) return;
    programmaticScrollUntil = Date.now() + 100;
    const pos = cm.state.doc.line(Math.min(line.line + 1, cm.state.doc.lines)).from;
    cm.dispatch({ effects: EditorView.scrollIntoView(pos, { y: "start" }) });
  }

  $effect(() => {
    const src = app.docSource ?? "";
    snapshot = src;
    app.dirty = false;
    const view = new EditorView({
      state: EditorState.create({
        doc: src,
        extensions: [
          history(),
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
            { key: "Mod-s", preventDefault: true, run: () => (void save(), true) },
          ]),
          markdown(),
          EditorView.lineWrapping,
          cmTheme,
          EditorView.updateListener.of((u) => {
            if (!u.docChanged) return;
            app.dirty = u.state.doc.toString() !== snapshot;
            schedulePreview();
          }),
        ],
      }),
      parent: editorHost,
    });
    cm = view;
    void refreshPreview();
    view.dom.addEventListener("scroll", () => syncPreviewToEditor(), { passive: true });
    previewHost.addEventListener("scroll", () => syncEditorToPreview(), { passive: true });
    return () => {
      clearTimeout(previewTimer);
      view.destroy();
      cm = null;
    };
  });

  let dragging = false;

  function onDrag(e: PointerEvent): void {
    if (!dragging) return;
    const r = divider.parentElement?.getBoundingClientRect();
    if (!r) return;
    setSplit(((e.clientX - r.left) / r.width) * 100);
  }
</script>

<div class="edit-split">
  <div class="ed-src" bind:this={editorHost} style="flex-basis: {settings.split}%"></div>
  <div
    class="ed-divider"
    bind:this={divider}
    role="separator"
    aria-label="拖动调整分栏，双击复位"
    onpointerdown={(e) => {
      dragging = true;
      divider.classList.add("drag");
      divider.setPointerCapture(e.pointerId);
    }}
    onpointermove={onDrag}
    onpointerup={(e) => {
      dragging = false;
      divider.classList.remove("drag");
      divider.releasePointerCapture(e.pointerId);
    }}
    ondblclick={() => setSplit(50)}
  ></div>
  <div class="ed-prev-wrap">
    <div class="ed-prev doc" bind:this={previewHost}></div>
  </div>
</div>

{#if app.conflictPath}
  <div class="conflict-overlay" role="alertdialog" aria-label={S.conflictTitle}>
    <div class="conflict-box">
      <div class="c-title">{S.conflictTitle}</div>
      <div class="c-path">{app.conflictPath}</div>
      <div class="c-actions">
        <button
          type="button"
          class="pri"
          onclick={() => {
            const p = app.conflictPath;
            app.conflictPath = null;
            if (p) void openFile(p);
          }}>{S.conflictReload}</button
        >
        <button type="button" onclick={() => (app.conflictPath = null)}>{S.conflictKeep}</button>
      </div>
    </div>
  </div>
{/if}
