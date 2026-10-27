export interface PriceInput {
  price: number;
  salePrice: number | null;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
}

export interface PriceInfo {
  /** What the customer pays right now. */
  price: number;
  /** The regular price, only when a sale is active. */
  compareAtPrice: number | null;
  onSale: boolean;
  percentOff: number;
}

/**
 * A sale is active only when a lower sale price exists AND now is inside the sale window.
 * The listing SQL uses exactly the same rule (see listing-query.ts).
 * The server recalculates prices at checkout (Step 4). Never trust a price from the browser.
 */
export function resolvePrice(input: PriceInput, now: Date = new Date()): PriceInfo {
  const { price, salePrice, saleStartsAt, saleEndsAt } = input;

  const active =
    salePrice !== null &&
    salePrice < price &&
    (saleStartsAt === null || saleStartsAt <= now) &&
    (saleEndsAt === null || saleEndsAt >= now);

  if (!active || salePrice === null) {
    return { price, compareAtPrice: null, onSale: false, percentOff: 0 };
  }

  return {
    price: salePrice,
    compareAtPrice: price,
    onSale: true,
    percentOff: Math.max(1, Math.round((1 - salePrice / price) * 100)),
  };
}