// macOS 风格悬浮滚动指示条：隐藏原生滚动条，滚动时淡入、停顿后淡出。
// 几何计算独立成纯函数，便于回归测试（见 overlay-scrollbar.test.ts）。
import type { Action } from "svelte/action";

export interface ThumbMetrics {
  /** 指示条高度（px） */
  thumbH: number;
  /** 指示条顶点在视口内的最大位移（px） */
  maxThumbTop: number;
}

/** 内容不足一屏时返回 null（不可滚动则不显示指示条） */
export function thumbMetrics(viewportH: number, contentH: number, minThumbH = 28): ThumbMetrics | null {
  if (!(viewportH > 0) || contentH <= viewportH) return null;
  const proportional = (viewportH * viewportH) / contentH;
  const thumbH = Math.min(viewportH, Math.max(minThumbH, proportional));
  return { thumbH, maxThumbTop: viewportH - thumbH };
}

/** 指示条顶点在视口内的 y 偏移 */
export function thumbTopForScroll(
  scrollTop: number,
  viewportH: number,
  contentH: number,
  thumbH: number,
): number {
  const maxScroll = contentH - viewportH;
  const maxThumbTop = viewportH - thumbH;
  if (maxScroll <= 0 || maxThumbTop <= 0) return 0;
  return Math.min(maxThumbTop, Math.max(0, (scrollTop / maxScroll) * maxThumbTop));
}

/** 指示条每移动 1px 对应的滚动距离（拖拽映射） */
export function scrollPerThumbPx(viewportH: number, contentH: number, thumbH: number): number {
  const maxScroll = contentH - viewportH;
  const maxThumbTop = viewportH - thumbH;
  if (maxThumbTop <= 0) return 1;
  return maxScroll / maxThumbTop;
}

const FADE_DELAY = 700;

export const overlayScrollbar: Action<HTMLElement> = (node) => {
  const thumb = document.createElement("div");
  thumb.className = "scroll-thumb";
  node.appendChild(thumb);

  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let dragging = false;
  let startClientY = 0;
  let startScrollTop = 0;
  let pxToScroll = 1;

  function render(): void {
    const m = thumbMetrics(node.clientHeight, node.scrollHeight);
    if (!m) {
      thumb.classList.remove("show");
      return;
    }
    const top = thumbTopForScroll(node.scrollTop, node.clientHeight, node.scrollHeight, m.thumbH);
    thumb.style.height = `${m.thumbH}px`;
    // 绝对定位 top:0 锚定内容顶端，需叠加 scrollTop 抵消滚动位移
    thumb.style.transform = `translateY(${node.scrollTop + top}px)`;
  }

  function show(): void {
    clearTimeout(hideTimer);
    thumb.classList.add("show");
    if (!dragging) hideTimer = setTimeout(() => thumb.classList.remove("show"), FADE_DELAY);
  }

  function onScroll(): void {
    render();
    show();
  }

  function onPointerDown(e: PointerEvent): void {
    e.preventDefault();
    dragging = true;
    thumb.classList.add("drag");
    thumb.setPointerCapture(e.pointerId);
    startClientY = e.clientY;
    startScrollTop = node.scrollTop;
    const m = thumbMetrics(node.clientHeight, node.scrollHeight);
    pxToScroll = m ? scrollPerThumbPx(node.clientHeight, node.scrollHeight, m.thumbH) : 1;
    show();
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging) return;
    node.scrollTop = startScrollTop + (e.clientY - startClientY) * pxToScroll;
    render();
  }

  function onPointerUp(e: PointerEvent): void {
    if (!dragging) return;
    dragging = false;
    thumb.classList.remove("drag");
    thumb.releasePointerCapture(e.pointerId);
    show();
  }

  node.addEventListener("scroll", onScroll, { passive: true });
  thumb.addEventListener("pointerdown", onPointerDown);
  thumb.addEventListener("pointermove", onPointerMove);
  thumb.addEventListener("pointerup", onPointerUp);
  thumb.addEventListener("pointercancel", onPointerUp);
  // 视口尺寸变化（窗口缩放）后重算；不可滚动时收起指示条
  const ro = new ResizeObserver(render);
  ro.observe(node);
  render();

  return {
    destroy() {
      clearTimeout(hideTimer);
      ro.disconnect();
      node.removeEventListener("scroll", onScroll);
      thumb.removeEventListener("pointerdown", onPointerDown);
      thumb.removeEventListener("pointermove", onPointerMove);
      thumb.removeEventListener("pointerup", onPointerUp);
      thumb.removeEventListener("pointercancel", onPointerUp);
      thumb.remove();
    },
  };
};
