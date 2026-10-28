export const MAX_QUERY_LENGTH = 80;
export const MAX_TERMS = 5;

/** Unicode-normalises, removes control characters and collapses whitespace. */
export function cleanText(input: string): string {
  const withoutControls = Array.from(input.normalize("NFC"))
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code < 32 || code === 127 ? " " : ch;
    })
    .join("");
  return withoutControls.replace(/\s+/g, " ").trim();
}

/** A safe search string, or undefined when there is nothing to search for. */
export function normalizeQuery(input: string | null | undefined): string | undefined {
  if (!input) return undefined;
  const cleaned = Array.from(cleanText(input)).slice(0, MAX_QUERY_LENGTH).join("").trim();
  return cleaned === "" ? undefined : cleaned;
}

/** The individual words of a normalised query (at most MAX_TERMS, no duplicates). */
export function queryTerms(q: string): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const term of q.split(" ")) {
    const key = term.toLowerCase();
    if (!term || seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
    if (terms.length >= MAX_TERMS) break;
  }
  return terms;
}

/** Makes % and _ mean themselves inside a LIKE pattern. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (match) => `\\${match}`);
}