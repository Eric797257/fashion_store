import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "./cache-tags";
import { queryContactOverrides, queryContentPage, type ContentPageData } from "./content-query";
import {
  queryBanners,
  queryTestimonials,
  type BannerData,
  type TestimonialData,
} from "./home-query";
import { queryShelf, type Shelf } from "./listing-query";
import type { CatalogLocale, ProductCardData } from "./types";

export async function getBanners(
  locale: CatalogLocale,
): Promise<{ hero: BannerData[]; promo: BannerData[] }> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.banners);
  return queryBanners(locale);
}

export async function getTestimonials(locale: CatalogLocale): Promise<TestimonialData[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.testimonials);
  return queryTestimonials(locale);
}

export async function getShelf(
  shelf: Shelf,
  limit: number,
  locale: CatalogLocale,
): Promise<ProductCardData[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.products);
  return queryShelf(shelf, limit, locale);
}

export async function getContentPage(
  slug: string,
  locale: CatalogLocale,
): Promise<ContentPageData | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.content);
  return queryContentPage(slug, locale);
}

export async function getContactOverrides(): Promise<{ phone: string | null; email: string | null }> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.settings);
  return queryContactOverrides();
}