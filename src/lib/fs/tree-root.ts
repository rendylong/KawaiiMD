export function nextStickyRoot(sticky: string | null, candidate: string | null): string | null {
  if (!candidate) return sticky;
  if (!sticky) return candidate;
  if (candidate === sticky || candidate.startsWith(`${sticky}/`)) return sticky;
  return candidate;
}
