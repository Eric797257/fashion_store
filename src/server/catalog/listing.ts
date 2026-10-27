import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { ListingParams } from "@/validation/catalog";
import { CACHE_TAGS } from "./cache-tags";
import { queryProductListing, resolveCategoryIds } from "./listing-query";
import type { CatalogLocale, ProductListing } from "./types";

/**
 * Cached by its arguments (filters, category, language). Returns null when the category
 * doesn't exist. Stock labels may be a few minutes old. Checkout always checks live stock.
 */
export async function getProductListing(
  params: ListingParams,
  categorySlug: string | null,
  locale: CatalogLocale,
): Promise<ProductListing | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.products, CACHE_TAGS.categories);

  let categoryIds: string[] | null = null;
  if (categorySlug) {
    categoryIds = await resolveCategoryIds(categorySlug);
    if (!categoryIds) return null;
  }

  return queryProductListing(params, locale, categoryIds);
}