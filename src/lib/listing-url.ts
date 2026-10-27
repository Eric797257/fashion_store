import type { ListingParams } from "@/validation/catalog";

/** Builds a listing URL that only contains the settings that differ from the defaults. */
export function listingHref (
  basePath: string,
  params: ListingParams,
  overrides: Partial<ListingParams> = {},
): string {
  const merged = { ...params, ...overrides };
  const query = new URLSearchParams();

  if (merged.sort !== "newest") query.set("sort", merged.sort);
  if (merged.min !== undefined) query.set("min", String(merged.min));
  if (merged.max !== undefined) query.set("max", String(merged.max));
  if (merged.inStock) query.set("inStock", "1");
  if (merged.page > 1) query.set("page", String(merged.page));

  const qs = query.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function hasActiveFilters(params: ListingParams): boolean {
  return params.min !== undefined || params.max !== undefined || params.inStock;
}