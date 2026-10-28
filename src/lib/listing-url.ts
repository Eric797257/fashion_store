import { defaultSort, type ListingParams } from "../validation/catalog";

/** Builds a listing URL that only contains the settings that differ from the defaults. */
export function listingHref(
  basePath: string,
  params: ListingParams,
  overrides: Partial<ListingParams> = {},
): string {
  const m = { ...params, ...overrides };
  const sort = m.sort === "relevance" && !m.q ? "newest" : m.sort;
  const query = new URLSearchParams();

  if (m.q) query.set("q", m.q);
  if (sort !== defaultSort(m.q)) query.set("sort", sort);
  if (m.min !== undefined) query.set("min", String(m.min));
  if (m.max !== undefined) query.set("max", String(m.max));
  if (m.inStock) query.set("inStock", "1");
  for (const v of m.brand) query.append("brand", v);
  for (const v of m.audience) query.append("audience", v);
  for (const v of m.color) query.append("color", v);
  for (const v of m.size) query.append("size", v);
  if (m.page > 1) query.set("page", String(m.page));

  const qs = query.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function hasActiveFilters(params: ListingParams): boolean {
  return (
    params.min !== undefined ||
    params.max !== undefined ||
    params.inStock ||
    params.brand.length > 0 ||
    params.color.length > 0 ||
    params.size.length > 0 ||
    params.audience.length > 0
  );
}

/** Overrides that remove every filter but keep the search text. */
export function clearFilters(): Partial<ListingParams> {
  return {
    min: undefined,
    max: undefined,
    inStock: false,
    brand: [],
    color: [],
    size: [],
    audience: [],
    page: 1,
  };
}

/** True for any page that should not be indexed by Google. */
export function isRefinedView(params: ListingParams): boolean {
  return Boolean(params.q) || hasActiveFilters(params) || params.sort !== defaultSort(params.q);
}

/** The clean URL that refined views point to as their canonical page. */
export function canonicalListingHref(basePath: string, params: ListingParams): string {
  return listingHref(basePath, params, {
    ...clearFilters(),
    q: undefined,
    sort: "newest",
    page: params.page,
  });
}