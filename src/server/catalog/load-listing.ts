import "server-only";
import type { ListingParams } from "@/validation/catalog";
import { getProductListing } from "./listing";
import { queryProductListing, resolveCategoryIds } from "./listing-query";
import type { CatalogLocale, ProductListing } from "./types";

/**
 * Browsing is cached (shared by all visitors). Searching is never cached,
 * because typed text is unbounded and would fill the cache.
 */
export async function loadListing(
  params: ListingParams,
  categorySlug: string | null,
  locale: CatalogLocale,
): Promise<ProductListing | null> {
  if (!params.q) return getProductListing(params, categorySlug, locale);

  let categoryIds: string[] | null = null;
  if (categorySlug) {
    categoryIds = await resolveCategoryIds(categorySlug);
    if (!categoryIds) return null;
  }
  return queryProductListing(params, locale, categoryIds);
}