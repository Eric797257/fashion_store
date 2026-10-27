import { z } from "zod";

export const SORT_OPTIONS = ["newest", "price-asc", "price-desc", "popular", "rating"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const LISTING_PAGE_SIZE = 12;

// "" or missing means "not set". Anything invalid also means "not set".
const optionalMoney = z
  .preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().int().min(0).max(100_000_000).optional(),
  )
  .catch(undefined);

export const listingParamsSchema = z.object({
  sort: z.enum(SORT_OPTIONS).catch("newest"),
  page: z.coerce.number().int().min(1).max(500).catch(1),
  min: optionalMoney,
  max: optionalMoney,
  inStock: z
    .preprocess((v) => v === "1" || v === "true" || v === "on", z.boolean())
    .catch(false),
});

export type ListingParams = z.infer<typeof listingParamsSchema>;

type RawParams = Record<string, string | string[] | undefined>;

/** Turns URL search params into safe, validated filters. Never throws. */
export function parseListingParams(raw: RawParams): ListingParams {
  const first = (key: string) => {
    const value = raw[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const parsed = listingParamsSchema.parse({
    sort: first("sort"),
    page: first("page"),
    min: first("min"),
    max: first("max"),
    inStock: first("inStock"),
  });

  // A reversed price range is a typo, not an error
  if (parsed.min !== undefined && parsed.max !== undefined && parsed.min > parsed.max) {
    return { ...parsed, min: parsed.max, max: parsed.min };
  }
  return parsed;
}