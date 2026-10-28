import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS, productSlugTag } from "./cache-tags";
import { queryProductDetail, queryReviews, type ProductDetail, type ReviewSummary } from "./detail-query";
import { queryRelatedProducts } from "./related-query";
import type { CatalogLocale, ProductCardData } from "./types";

export async function getProductDetail(
  slug: string,
  locale: CatalogLocale,
): Promise<ProductDetail | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.products, productSlugTag(slug));
  return queryProductDetail(slug, locale);
}

export async function getProductReviews(productId: string): Promise<ReviewSummary> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.reviews);
  return queryReviews(productId);
}

export async function getRelatedProducts(
  productId: string,
  categoryId: string,
  locale: CatalogLocale,
): Promise<ProductCardData[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.products);
  return queryRelatedProducts(productId, categoryId, locale, 4);
}