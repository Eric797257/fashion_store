import { localized } from "../../i18n/localized";
import { db } from "../../lib/db";
import { publicReviewerName } from "../../lib/display-name";
import { resolvePrice } from "./pricing";
import type { CatalogLocale } from "./types";

export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  brandName: string | null;
  category: {
    id: string;
    slug: string;
    name: string;
    parent: { slug: string; name: string } | null;
  };
  price: number;
  compareAtPrice: number | null;
  onSale: boolean;
  percentOff: number;
  saleEndsAt: string | null;
  images: { url: string; alt: string; color: string | null }[];
  variants: {
    id: string;
    sku: string;
    size: string;
    color: string;
    colorHex: string | null;
  }[];
  specs: { label: string; value: string }[];
  ratingAverage: number;
  ratingCount: number;
}

/** Public product by slug. Draft and archived products are never returned. */
export async function queryProductDetail(
  slug: string,
  locale: CatalogLocale,
): Promise<ProductDetail | null> {
  const p = await db.product.findFirst({
    where: { slug, status: "ACTIVE" },
    select: {
      id: true,
      slug: true,
      name: true,
      nameMy: true,
      description: true,
      descriptionMy: true,
      seoTitle: true,
      seoDescription: true,
      price: true,
      salePrice: true,
      saleStartsAt: true,
      saleEndsAt: true,
      ratingAverage: true,
      ratingCount: true,
      brand: { select: { name: true } },
      category: {
        select: {
          id: true,
          slug: true,
          name: true,
          nameMy: true,
          parent: { select: { slug: true, name: true, nameMy: true } },
        },
      },
      images: { orderBy: { sortOrder: "asc" }, select: { url: true, alt: true, color: true } },
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, sku: true, size: true, color: true, colorHex: true },
      },
      specs: { orderBy: { sortOrder: "asc" }, select: { label: true, value: true } },
    },
  });
  if (!p) return null;

  const name = localized(p.name, p.nameMy, locale);
  const price = resolvePrice({
    price: Number(p.price),
    salePrice: p.salePrice === null ? null : Number(p.salePrice),
    saleStartsAt: p.saleStartsAt,
    saleEndsAt: p.saleEndsAt,
  });

  return {
    id: p.id,
    slug: p.slug,
    name,
    description: locale === "my" && p.descriptionMy ? p.descriptionMy : p.description,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    brandName: p.brand?.name ?? null,
    category: {
      id: p.category.id,
      slug: p.category.slug,
      name: localized(p.category.name, p.category.nameMy, locale),
      parent: p.category.parent
        ? {
            slug: p.category.parent.slug,
            name: localized(p.category.parent.name, p.category.parent.nameMy, locale),
          }
        : null,
    },
    price: price.price,
    compareAtPrice: price.compareAtPrice,
    onSale: price.onSale,
    percentOff: price.percentOff,
    saleEndsAt: price.onSale && p.saleEndsAt ? p.saleEndsAt.toISOString() : null,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt ?? name, color: i.color })),
    variants: p.variants,
    specs: p.specs,
    ratingAverage: Number(p.ratingAverage),
    ratingCount: p.ratingCount,
  };
}

export interface LiveVariantStock {
  variantId: string;
  available: number;
  low: boolean;
}

/** Read fresh on every request. Never cache this. */
export async function queryLiveStock(productId: string): Promise<LiveVariantStock[]> {
  const rows = await db.productVariant.findMany({
    where: { productId, isActive: true },
    select: { id: true, stockOnHand: true, stockReserved: true, lowStockThreshold: true },
  });

  return rows.map((r) => {
    const available = Math.max(0, r.stockOnHand - r.stockReserved);
    return {
      variantId: r.id,
      available,
      low: available > 0 && available <= r.lowStockThreshold,
    };
  });
}

export interface ReviewSummary {
  average: number;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  reviews: {
    id: string;
    rating: number;
    title: string | null;
    body: string | null;
    /** Shortened public name, or "" when the reviewer has none. */
    author: string;
    verified: boolean;
    createdAt: string;
  }[];
}

/** Approved reviews only. */
export async function queryReviews(productId: string): Promise<ReviewSummary> {
  const [groups, latest] = await Promise.all([
    db.review.groupBy({
      by: ["rating"],
      where: { productId, status: "APPROVED" },
      _count: { _all: true },
    }),
    db.review.findMany({
      where: { productId, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        isVerifiedPurchase: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let count = 0;
  let sum = 0;
  for (const g of groups) {
    const rating = g.rating as 1 | 2 | 3 | 4 | 5;
    if (rating >= 1 && rating <= 5) {
      distribution[rating] = g._count._all;
      count += g._count._all;
      sum += rating * g._count._all;
    }
  }

  return {
    average: count > 0 ? sum / count : 0,
    count,
    distribution,
    reviews: latest.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      author: publicReviewerName(r.user.name),
      verified: r.isVerifiedPurchase,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}