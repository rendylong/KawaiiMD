export function activeFromOffsets(offsets: number[], scrollTop: number): number {
  let active = -1;
  for (let i = 0; i < offsets.length; i++) {
    if (offsets[i] <= scrollTop) active = i;
    else break;
  }
  return active;
}

export function restoreScroll(container: HTMLElement, headingId: string | null): void {
  if (!headingId) return;
  const el = container.querySelector(`[id="${headingId}"]`);
  el?.scrollIntoView({ behavior: "auto", block: "start" });
}
