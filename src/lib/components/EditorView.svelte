<script lang="ts">
  import { untrack } from "svelte";
  import { EditorState } from "@codemirror/state";
  import { EditorView, keymap } from "@codemirror/view";
  import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
  import { markdown } from "@codemirror/lang-markdown";
  import { activeTab, saveCurrent, updateSource } from "../state/app.svelte";
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
    // 尾部余量默认按短文档给小值，fitTailPadding 对超视口的长文档升到 60vh
    ".cm-content": { padding: "20px 0 24px" },
    ".cm-gutters": { display: "none" },
    "&.cm-focused": { outline: "none" },
  });

  async function refreshPreview(): Promise<void> {
    const tab = activeTab();
    if (!previewHost || !tab?.path || tab.docSource === null) return;
    previewDoc = await mountDoc(previewHost, tab.docSource, dirname(tab.path), resolvedTheme());
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
    // 仅依赖标签身份与该标签的内容版本：切标签/外部重载才重建编辑器；
    // 击键只写 docSource，不触发本 effect（否则编辑器销毁重建、焦点丢失）。
    const tab = activeTab();
    void tab?.id;
    void tab?.docVersion;
    const src = untrack(() => tab?.docSource ?? "");

    // 分栏滚动同步需要「内容超过视口的文档」尾部留 60vh 过滚余量（最后一行才滚得到视口顶）；
    // 短文档（如刚新建的一行标题）留 60vh 只会变成大片空白和多出的滚动条。
    // 按内容自然高度是否超过编辑器视口动态决定尾 padding；内容或容器尺寸变化时重算。
    let fitQueued = false;
    function fitTailPadding(): void {
      fitQueued = false;
      const scroller = editor.dom.querySelector<HTMLElement>(".cm-scroller");
      const content = editor.dom.querySelector<HTMLElement>(".cm-content");
      if (!scroller || !content) return;
      const prev = content.style.paddingBottom;
      content.style.paddingBottom = "0px";
      const natural = scroller.scrollHeight; // 排除尾 padding 的内容自然高度
      content.style.paddingBottom = prev;
      const pad = natural > scroller.clientHeight ? "60vh" : "24px";
      if (prev !== pad) content.style.paddingBottom = pad;
    }
    function queueFit(): void {
      if (fitQueued) return;
      fitQueued = true;
      requestAnimationFrame(fitTailPadding);
    }

    const editor = new EditorView({
      state: EditorState.create({
        doc: src,
        // 新建文档从末尾接着写最自然；打开旧文档编辑通常也是文末追加
        selection: { anchor: src.length },
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
            queueFit();
          }),
        ],
      }),
      parent: editorHost,
    });
    view = editor;
    editor.focus();
    // 切回标签时恢复上次的编辑器滚动位置
    const sc = editor.dom.querySelector<HTMLElement>(".cm-scroller");
    if (sc && tab && tab.editScrollTop > 0) sc.scrollTop = tab.editScrollTop;
    queueFit();
    const ro = new ResizeObserver(() => queueFit());
    ro.observe(editor.dom);
    untrack(() => void refreshPreview());
    const onEditorScroll = () => syncPreviewToEditor(editor);
    const onPreviewScroll = () => syncEditorToPreview(editor);
    editor.dom.addEventListener("scroll", onEditorScroll, { passive: true });
    previewHost.addEventListener("scroll", onPreviewScroll, { passive: true });
    return () => {
      clearTimeout(previewTimer);
      ro.disconnect();
      editor.dom.removeEventListener("scroll", onEditorScroll);
      previewHost.removeEventListener("scroll", onPreviewScroll);
      // 销毁前把编辑滚动记回所属标签（切标签/重载后可恢复）
      const sc = editor.dom.querySelector<HTMLElement>(".cm-scroller");
      if (tab && sc) tab.editScrollTop = sc.scrollTop;
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
