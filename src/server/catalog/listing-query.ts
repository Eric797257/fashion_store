import { Prisma } from "../../generated/prisma/client";
import { localized } from "../../i18n/localized";
import { db } from "../../lib/db";
import { LISTING_PAGE_SIZE, type ListingParams, type SortOption } from "../../validation/catalog";
import { resolvePrice } from "./pricing";
import { summarizeStock } from "./stock";
import type { CatalogLocale, ProductCardData, ProductListing } from "./types";

const NEW_PRODUCT_DAYS = 14;
const MAX_COLOR_SWATCHES = 5;

const col = (alias: string, name: string) => Prisma.raw(`${alias}."${name}"`);

const P = {
  id: col("p", "id"),
  status: col("p", "status"),
  categoryId: col("p", "category_id"),
  price: col("p", "price"),
  salePrice: col("p", "sale_price"),
  saleStartsAt: col("p", "sale_starts_at"),
  saleEndsAt: col("p", "sale_ends_at"),
  publishedAt: col("p", "published_at"),
  createdAt: col("p", "created_at"),
  soldCount: col("p", "sold_count"),
  ratingAverage: col("p", "rating_average"),
  ratingCount: col("p", "rating_count"),
};

const V = {
  productId: col("v", "product_id"),
  isActive: col("v", "is_active"),
  stockOnHand: col("v", "stock_on_hand"),
  stockReserved: col("v", "stock_reserved"),
};

// Same rule as resolvePrice() in pricing.ts
const EFFECTIVE_PRICE = Prisma.sql`(CASE WHEN ${P.salePrice} IS NOT NULL AND ${P.salePrice} < ${P.price} AND (${P.saleStartsAt} IS NULL OR ${P.saleStartsAt} <= NOW()) AND (${P.saleEndsAt} IS NULL OR ${P.saleEndsAt} >= NOW()) THEN ${P.salePrice} ELSE ${P.price} END)`;

// The sort comes from this fixed list, never from user text
const ORDER_BY: Record<SortOption, Prisma.Sql> = {
  newest: Prisma.sql`${P.publishedAt} DESC NULLS LAST, ${P.createdAt} DESC`,
  "price-asc": Prisma.sql`${EFFECTIVE_PRICE} ASC`,
  "price-desc": Prisma.sql`${EFFECTIVE_PRICE} DESC`,
  popular: Prisma.sql`${P.soldCount} DESC, ${P.createdAt} DESC`,
  rating: Prisma.sql`${P.ratingAverage} DESC, ${P.ratingCount} DESC, ${P.createdAt} DESC`,
};

function buildWhere(params: ListingParams, categoryIds: string[] | null): Prisma.Sql {
  const conditions: Prisma.Sql[] = [Prisma.sql`${P.status} = 'ACTIVE'`];

  if (categoryIds) {
    conditions.push(
      categoryIds.length > 0
        ? Prisma.sql`${P.categoryId} IN (${Prisma.join(categoryIds)})`
        : Prisma.sql`FALSE`,
    );
  }
  if (params.min !== undefined) conditions.push(Prisma.sql`${EFFECTIVE_PRICE} >= ${params.min}`);
  if (params.max !== undefined) conditions.push(Prisma.sql`${EFFECTIVE_PRICE} <= ${params.max}`);
  if (params.inStock) {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "product_variants" v WHERE ${V.productId} = ${P.id} AND ${V.isActive} = true AND ${V.stockOnHand} - ${V.stockReserved} > 0)`,
    );
  }

  return Prisma.join(conditions, " AND ");
}

/** The category's own id plus its active sub-categories, or null if it doesn't exist. */
export async function resolveCategoryIds(slug: string): Promise<string[] | null> {
  const category = await db.category.findFirst({
    where: { slug, isActive: true },
    select: { id: true, children: { where: { isActive: true }, select: { id: true } } },
  });
  if (!category) return null;
  return [category.id, ...category.children.map((c) => c.id)];
}

export async function fetchRows(ids: string[]) {
  return db.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      slug: true,
      name: true,
      nameMy: true,
      price: true,
      salePrice: true,
      saleStartsAt: true,
      saleEndsAt: true,
      publishedAt: true,
      ratingAverage: true,
      ratingCount: true,
      category: { select: { slug: true, name: true, nameMy: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 2, select: { url: true, alt: true } },
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          color: true,
          colorHex: true,
          stockOnHand: true,
          stockReserved: true,
          lowStockThreshold: true,
          isActive: true,
        },
      },
    },
  });
}

type ProductRow = Awaited<ReturnType<typeof fetchRows>>[number];

export function toCard(p: ProductRow, locale: CatalogLocale, now: Date): ProductCardData {
  const name = localized(p.name, p.nameMy, locale);
  const price = resolvePrice(
    {
      price: Number(p.price),
      salePrice: p.salePrice === null ? null : Number(p.salePrice),
      saleStartsAt: p.saleStartsAt,
      saleEndsAt: p.saleEndsAt,
    },
    now,
  );

  const colors = new Map<string, string | null>();
  for (const v of p.variants) if (!colors.has(v.color)) colors.set(v.color, v.colorHex);

  const toImage = (img: { url: string; alt: string | null } | undefined) =>
    img ? { url: img.url, alt: img.alt ?? name } : null;

  const ageMs = p.publishedAt ? now.getTime() - p.publishedAt.getTime() : Infinity;

  return {
    id: p.id,
    slug: p.slug,
    name,
    categoryName: localized(p.category.name, p.category.nameMy, locale),
    categorySlug: p.category.slug,
    image: toImage(p.images[0]),
    hoverImage: toImage(p.images[1]),
    price: price.price,
    compareAtPrice: price.compareAtPrice,
    onSale: price.onSale,
    percentOff: price.percentOff,
    stockStatus: summarizeStock(p.variants).status,
    colors: [...colors]
      .slice(0, MAX_COLOR_SWATCHES)
      .map(([colorName, hex]) => ({ name: colorName, hex })),
    ratingAverage: Number(p.ratingAverage),
    ratingCount: p.ratingCount,
    isNew: ageMs < NEW_PRODUCT_DAYS * 24 * 60 * 60 * 1000,
  };
}

export async function queryProductListing(
  params: ListingParams,
  locale: CatalogLocale,
  categoryIds: string[] | null,
): Promise<ProductListing> {
  const where = buildWhere(params, categoryIds);

  const [countRow] = await db.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*)::bigint AS total FROM "products" p WHERE ${where}`;
  const total = Number(countRow?.total ?? 0);

  const totalPages = Math.max(1, Math.ceil(total / LISTING_PAGE_SIZE));
  const page = Math.min(params.page, totalPages);
  const offset = (page - 1) * LISTING_PAGE_SIZE;

  const idRows = await db.$queryRaw<{ id: string }[]>`
    SELECT ${P.id} AS id FROM "products" p
    WHERE ${where}
    ORDER BY ${ORDER_BY[params.sort]}, ${P.id} ASC
    LIMIT ${LISTING_PAGE_SIZE} OFFSET ${offset}`;

  const ids = idRows.map((r) => r.id);
  if (ids.length === 0) {
    return { items: [], total, page, pageSize: LISTING_PAGE_SIZE, totalPages };
  }

  const rows = await fetchRows(ids);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const now = new Date();
  const items = ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toCard(row, locale, now)] : [];
  });

  return { items, total, page, pageSize: LISTING_PAGE_SIZE, totalPages };
}