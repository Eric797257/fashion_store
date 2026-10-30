import { localized } from "../../i18n/localized";
import { db } from "../../lib/db";
import type { CatalogLocale } from "./types";

export interface BannerData {
  id: string;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string;
  imageUrl: string | null;
  imageAlt: string;
}

/** Banners that are switched on and inside their schedule. Hero first, then promos. */
export async function queryBanners(
  locale: CatalogLocale,
): Promise<{ hero: BannerData[]; promo: BannerData[] }> {
  const now = new Date();
  const rows = await db.banner.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 20,
  });

  const toData = (row: (typeof rows)[number]): BannerData => {
    const title = localized(row.title, row.titleMy, locale);
    return {
      id: row.id,
      title,
      subtitle: row.subtitle ? localized(row.subtitle, row.subtitleMy, locale) : null,
      ctaLabel: row.ctaLabel ? localized(row.ctaLabel, row.ctaLabelMy, locale) : null,
      ctaHref: row.ctaHref,
      imageUrl: row.imageUrl,
      imageAlt: row.imageAlt ?? title,
    };
  };

  return {
    hero: rows.filter((r) => r.placement === "HERO").map(toData),
    promo: rows.filter((r) => r.placement === "PROMO").map(toData),
  };
}

export interface TestimonialData {
  id: string;
  author: string;
  location: string | null;
  quote: string;
  rating: number;
}

export async function queryTestimonials(locale: CatalogLocale): Promise<TestimonialData[]> {
  const rows = await db.testimonial.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 6,
  });
  return rows.map((r) => ({
    id: r.id,
    author: r.authorName,
    location: r.authorLocation,
    quote: locale === "my" && r.quoteMy ? r.quoteMy : r.quote,
    rating: r.rating,
  }));
}