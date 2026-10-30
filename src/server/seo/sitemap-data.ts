import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/server/catalog/cache-tags";
import { CONTENT_SLUGS } from "@/server/catalog/content-query";

export interface SitemapData {
  products: { slug: string; updatedAt: string }[];
  categories: { slug: string; updatedAt: string }[];
  pages: string[];
}

export async function getSitemapData(): Promise<SitemapData> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.products, CACHE_TAGS.categories, CACHE_TAGS.content);

  const [products, categories, pages] = await Promise.all([
    db.product.findMany({
      where: { status: "ACTIVE" },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 40_000, // a sitemap file holds at most 50,000 URLs
    }),
    db.category.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    }),
    db.contentPage.findMany({
      where: { slug: { in: [...CONTENT_SLUGS] } },
      select: { slug: true },
    }),
  ]);

  return {
    products: products.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt.toISOString() })),
    categories: categories.map((c) => ({ slug: c.slug, updatedAt: c.updatedAt.toISOString() })),
    pages: pages.map((p) => p.slug),
  };
}