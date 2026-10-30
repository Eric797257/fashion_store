import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";
import { getSitemapData } from "@/server/seo/sitemap-data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const data = await getSitemapData();

  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/products`, changeFrequency: "daily", priority: 0.9 },
    ...data.categories.map((c) => ({
      url: `${base}/categories/${c.slug}`,
      lastModified: new Date(c.updatedAt),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...data.products.map((p) => ({
      url: `${base}/products/${p.slug}`,
      lastModified: new Date(p.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.4 },
    ...data.pages.map((slug) => ({
      url: `${base}/${slug}`,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}