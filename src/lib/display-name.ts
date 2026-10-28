/** "Aye Chan Myae" becomes "Aye M." Reviews never show a full name. Returns "" if there is none. */
export function publicReviewerName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  if (!last) return first;
  const initial = Array.from(last)[0] ?? "";
  return `${first} ${initial}.`;
}