<script lang="ts">
  import { EditorState } from "@codemirror/state";
  import { EditorView, keymap } from "@codemirror/view";
  import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
  import { markdown } from "@codemirror/lang-markdown";
  import { app, saveCurrent, updateSource } from "../state/app.svelte";
  import { dirname } from "../fs/tauri";
  import { mountDoc } from "../markdown/pipeline";
  import { resolvedTheme, setSplit, settings } from "../settings.svelte";
  import { headingAtLine } from "../editor/sync";
  import type { Doc } from "../types";

  let editorHost: HTMLElement;
  let previewHost: HTMLElement;
  let divider: HTMLElement;
  let previewTimer: ReturnType<typeof setTimeout> | undefined;
  let previewDoc: Doc | null = null;
  let programmaticScrollUntil = 0;

  const cmTheme = EditorView.theme({
    "&": { height: "100%", fontSize: "13.5px", backgroundColor: "var(--bg-side)", color: "var(--fg)" },
    ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.75" },
    ".cm-content": { padding: "20px 0 60vh" },
    ".cm-gutters": { display: "none" },
    "&.cm-focused": { outline: "none" },
  });

  async function refreshPreview(): Promise<void> {
    if (!previewHost || !app.currentPath || app.docSource === null) return;
    previewDoc = await mountDoc(previewHost, app.docSource, dirname(app.currentPath), resolvedTheme());
  }

  function schedulePreview(): void {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => void refreshPreview(), 500);
  }

  function syncPreviewToEditor(view: EditorView): void {
    if (!previewHost || !previewDoc) return;
    const topLine = view.state.doc.lineAt(view.lineBlockAtHeight(view.dom.scrollTop).from).number - 1;
    const heading = headingAtLine(previewDoc.headingLines, topLine);
    if (!heading) return;
    const el = previewHost.querySelector(`[id="${heading.id}"]`);
    if (!el) return;
    programmaticScrollUntil = Date.now() + 100;
    el.scrollIntoView({ behavior: "auto", block: "start" });
  }

  function syncEditorToPreview(view: EditorView): void {
    if (!previewHost || !previewDoc) return;
    if (Date.now() < programmaticScrollUntil) return;
    let curId: string | null = null;
    for (const t of previewDoc.toc) {
      const el = previewHost.querySelector<HTMLElement>(`[id="${t.id}"]`);
      const h = previewDoc.headingLines.find((x) => x.id === t.id);
      if (el && h && el.offsetTop <= previewHost.scrollTop + 90) curId = t.id;
    }
    const line = curId ? previewDoc.headingLines.find((h) => h.id === curId) : null;
    if (!line) return;
    programmaticScrollUntil = Date.now() + 100;
    const pos = view.state.doc.line(Math.min(line.line + 1, view.state.doc.lines)).from;
    view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: "start" }) });
  }

  let view = $state<EditorView | null>(null);

  $effect(() => {
    const src = app.docSource ?? "";
    const editor = new EditorView({
      state: EditorState.create({
        doc: src,
        extensions: [
          history(),
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
            { key: "Mod-s", preventDefault: true, run: () => (void saveCurrent(), true) },
          ]),
          markdown(),
          EditorView.lineWrapping,
          cmTheme,
          EditorView.updateListener.of((u) => {
            if (!u.docChanged) return;
            updateSource(u.state.doc.toString());
            schedulePreview();
          }),
        ],
      }),
      parent: editorHost,
    });
    view = editor;
    void refreshPreview();
    const onEditorScroll = () => syncPreviewToEditor(editor);
    const onPreviewScroll = () => syncEditorToPreview(editor);
    editor.dom.addEventListener("scroll", onEditorScroll, { passive: true });
    previewHost.addEventListener("scroll", onPreviewScroll, { passive: true });
    return () => {
      clearTimeout(previewTimer);
      editor.dom.removeEventListener("scroll", onEditorScroll);
      previewHost.removeEventListener("scroll", onPreviewScroll);
      editor.destroy();
      view = null;
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
