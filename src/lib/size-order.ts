const NAMED = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "2XL", "3XL", "4XL", "5XL"];

function rank(size: string): [number, number, string] {
  const upper = size.trim().toUpperCase();
  const named = NAMED.indexOf(upper);
  if (named >= 0) return [0, named, upper];
  if (/^[0-9]/.test(upper)) return [1, Number.parseFloat(upper) || 0, upper];
  if (upper === "FREE SIZE" || upper === "ONE SIZE") return [3, 0, upper];
  return [2, 0, upper];
}

/** XS, S, M, L, XL, then 30, 32, 34, then other names, then "Free Size". */
export function compareSizes(a: string, b: string): number {
  const ra = rank(a);
  const rb = rank(b);
  return ra[0] - rb[0] || ra[1] - rb[1] || ra[2].localeCompare(rb[2]);
}