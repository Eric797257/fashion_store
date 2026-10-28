import { z } from "zod";
import { cleanText, normalizeQuery } from "../lib/search-terms";

export const SORT_OPTIONS = [
  "relevance",
  "newest",
  "price-asc",
  "price-desc",
  "popular",
  "rating",
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const BROWSE_SORTS: readonly SortOption[] = [
  "newest",
  "price-asc",
  "price-desc",
  "popular",
  "rating",
];
export const SEARCH_SORTS: readonly SortOption[] = ["relevance", ...BROWSE_SORTS];

export const AUDIENCE_VALUES = ["women", "men", "unisex", "kids"] as const;
export type AudienceValue = (typeof AUDIENCE_VALUES)[number];
export const audienceToEnum = (value: AudienceValue) =>
  value.toUpperCase() as "WOMEN" | "MEN" | "UNISEX" | "KIDS";

export const LISTING_PAGE_SIZE = 12;
export const MAX_FACET_VALUES = 10;

export interface ListingParams {
  q: string | undefined;
  sort: SortOption;
  page: number;
  min: number | undefined;
  max: number | undefined;
  inStock: boolean;
  brand: string[];
  color: string[];
  size: string[];
  audience: AudienceValue[];
}

/** Relevance when searching, newest when browsing. */
export const defaultSort = (q: string | undefined): SortOption => (q ? "relevance" : "newest");

// "" or missing means "not set". Anything invalid also means "not set".
const optionalMoney = z
  .preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().int().min(0).max(100_000_000).optional(),
  )
  .catch(undefined);

const scalarSchema = z.object({
  sort: z.enum(SORT_OPTIONS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).catch(1),
  min: optionalMoney,
  max: optionalMoney,
  inStock: z
    .preprocess((v) => v === "1" || v === "true" || v === "on", z.boolean())
    .catch(false),
});

type RawParams = Record<string, string | string[] | undefined>;

const BRAND_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function allValues(raw: RawParams, key: string): string[] {
  const value = raw[key];
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

/** Free text such as colour or size names: cleaned, de-duplicated, capped. */
function cleanFacetText(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = cleanText(value);
    const key = text.toLowerCase();
    if (!text || Array.from(text).length > 40 || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= MAX_FACET_VALUES) break;
  }
  return out;
}

function cleanBrands(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()))]
    .filter((v) => v.length <= 60 && BRAND_SLUG.test(v))
    .slice(0, MAX_FACET_VALUES);
}

function cleanAudience(values: string[]): AudienceValue[] {
  const wanted = new Set(values.map((v) => v.trim().toLowerCase()));
  return AUDIENCE_VALUES.filter((a) => wanted.has(a));
}

/** Turns URL search params into safe, validated filters. Never throws. */
export function parseListingParams(raw: RawParams): ListingParams {
  const first = (key: string) => allValues(raw, key)[0];

  const scalars = scalarSchema.parse({
    sort: first("sort"),
    page: first("page"),
    min: first("min"),
    max: first("max"),
    inStock: first("inStock"),
  });

  const q = normalizeQuery(first("q"));

  let sort = scalars.sort ?? defaultSort(q);
  if (sort === "relevance" && !q) sort = "newest"; // nothing to be relevant to

  let { min, max } = scalars;
  // A reversed price range is a typo, not an error
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];

  return {
    q,
    sort,
    page: scalars.page,
    min,
    max,
    inStock: scalars.inStock,
    brand: cleanBrands(allValues(raw, "brand")),
    color: cleanFacetText(allValues(raw, "color")),
    size: cleanFacetText(allValues(raw, "size")),
    audience: cleanAudience(allValues(raw, "audience")),
  };
}