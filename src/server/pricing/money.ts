export const MINOR_PER_MAJOR = 100;

/** Prices are Decimal(14,2). Everything is calculated as whole minor units. */
export const toMinor = (major: number) => Math.round(major * MINOR_PER_MAJOR);
export const fromMinor = (minor: number) => minor / MINOR_PER_MAJOR;

/**
 * Splits `total` across `weights` so the parts add up EXACTLY (largest remainder).
 * With total <= sum(weights), no part is ever larger than its own weight.
 * BigInt keeps it exact even for very large carts.
 */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);

  const T = BigInt(total);
  const S = BigInt(sum);
  const parts = weights.map((w) => (T * BigInt(w)) / S);
  const rems = weights.map((w) => (T * BigInt(w)) % S);

  let left = Number(T - parts.reduce((a, b) => a + b, BigInt(0)));
  const order = rems
    .map((rem, i) => ({ rem, i }))
    .sort((a, b) => (a.rem > b.rem ? -1 : a.rem < b.rem ? 1 : a.i - b.i));

  const result = parts.map((p) => Number(p));
  for (const { i } of order) {
    if (left <= 0) break;
    result[i] = (result[i] ?? 0) + 1;
    left--;
  }
  return result;
}