import { Prisma } from "../../generated/prisma/client";
import { localized } from "../../i18n/localized";
import { db } from "../../lib/db";
import { compareSizes } from "../../lib/size-order";
import {
  AUDIENCE_VALUES,
  LISTING_PAGE_SIZE,
  audienceToEnum,
  type AudienceValue,
  type ListingParams,
  type SortOption,
} from "../../validation/catalog";
import { resolvePrice } from "./pricing";
import { findSearchCandidates } from "./search-candidates";
import { summarizeStock } from "./stock";
import type { CatalogLocale, Facets, ProductCardData, ProductListing } from "./types";

const NEW_PRODUCT_DAYS = 14;
const MAX_COLOR_SWATCHES = 5;

// ---------------------------------------------------------------------------
// Real database column names. The Prisma schema maps camelCase fields to
// snake_case columns, and RAW SQL must use the column names. If you ever rename
// a column, change it here and nowhere else.
// ---------------------------------------------------------------------------
const col = (alias: string, name: string) => Prisma.raw(`${alias}."${name}"`);

const P = {
  id: col("p", "id"),
  status: col("p", "status"),
  categoryId: col("p", "category_id"),
  brandId: col("p", "brand_id"),
  audience: col("p", "audience"),
  isFeatured: col("p", "is_featured"),
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
  color: col("v", "color"),
  size: col("v", "size"),
  stockOnHand: col("v", "stock_on_hand"),
  stockReserved: col("v", "stock_reserved"),
};

// Same rule as resolvePrice() in pricing.ts
const EFFECTIVE_PRICE = Prisma.sql`(CASE WHEN ${P.salePrice} IS NOT NULL AND ${P.salePrice} < ${P.price} AND (${P.saleStartsAt} IS NULL OR ${P.saleStartsAt} <= NOW()) AND (${P.saleEndsAt} IS NULL OR ${P.saleEndsAt} >= NOW()) THEN ${P.salePrice} ELSE ${P.price} END)`;

// The sort comes from this fixed list, never from user text
const ORDER_BY: Record<Exclude<SortOption, "relevance">, Prisma.Sql> = {
  newest: Prisma.sql`${P.publishedAt} DESC NULLS LAST, ${P.createdAt} DESC`,
  "price-asc": Prisma.sql`${EFFECTIVE_PRICE} ASC`,
  "price-desc": Prisma.sql`${EFFECTIVE_PRICE} DESC`,
  popular: Prisma.sql`${P.soldCount} DESC, ${P.createdAt} DESC`,
  rating: Prisma.sql`${P.ratingAverage} DESC, ${P.ratingCount} DESC, ${P.createdAt} DESC`,
};

function orderBy(params: ListingParams, searchIds: string[] | null): Prisma.Sql {
  if (params.sort === "relevance") {
    // The candidate list is already ranked, so keep its order
    return searchIds && searchIds.length > 0
      ? Prisma.sql`array_position(ARRAY[${Prisma.join(searchIds)}]::text[], ${P.id}) ASC`
      : ORDER_BY.newest;
  }
  return ORDER_BY[params.sort];
}

/**
 * One variant must satisfy colour, size and stock TOGETHER.
 * "Navy" + "M" only matches products that really have a Navy/M variant.
 */
function variantExists(params: ListingParams, withColorAndSize: boolean): Prisma.Sql | null {
  const parts: Prisma.Sql[] = [Prisma.sql`${V.productId} = ${P.id}`, Prisma.sql`${V.isActive} = true`];
  let extra = 0;

  if (withColorAndSize && params.color.length > 0) {
    parts.push(Prisma.sql`LOWER(${V.color}) IN (${Prisma.join(params.color.map((c) => c.toLowerCase()))})`);
    extra++;
  }
  if (withColorAndSize && params.size.length > 0) {
    parts.push(Prisma.sql`LOWER(${V.size}) IN (${Prisma.join(params.size.map((s) => s.toLowerCase()))})`);
    extra++;
  }
  if (params.inStock) {
    parts.push(Prisma.sql`${V.stockOnHand} - ${V.stockReserved} > 0`);
    extra++;
  }

  if (extra === 0) return null;
  return Prisma.sql`EXISTS (SELECT 1 FROM "product_variants" v WHERE ${Prisma.join(parts, " AND ")})`;
}

/** withFacets=false is the "base" used for the option counts: everything except brand/colour/size/audience. */
function buildWhere(
  params: ListingParams,
  categoryIds: string[] | null,
  searchIds: string[] | null,
  withFacets: boolean,
): Prisma.Sql {
  const conditions: Prisma.Sql[] = [Prisma.sql`${P.status} = 'ACTIVE'`];

  if (categoryIds) {
    conditions.push(
      categoryIds.length > 0
        ? Prisma.sql`${P.categoryId} IN (${Prisma.join(categoryIds)})`
        : Prisma.sql`FALSE`,
    );
  }
  if (searchIds) {
    conditions.push(
      searchIds.length > 0 ? Prisma.sql`${P.id} IN (${Prisma.join(searchIds)})` : Prisma.sql`FALSE`,
    );
  }
  if (params.min !== undefined) conditions.push(Prisma.sql`${EFFECTIVE_PRICE} >= ${params.min}`);
  if (params.max !== undefined) conditions.push(Prisma.sql`${EFFECTIVE_PRICE} <= ${params.max}`);

  if (withFacets && params.brand.length > 0) {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "brands" b WHERE b."id" = ${P.brandId} AND b."slug" IN (${Prisma.join(params.brand)}))`,
    );
  }
  if (withFacets && params.audience.length > 0) {
    conditions.push(
      Prisma.sql`${P.audience}::text IN (${Prisma.join(params.audience.map(audienceToEnum))})`,
    );
  }

  const variant = variantExists(params, withFacets);
  if (variant) conditions.push(variant);

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

/** Option lists with counts. They ignore the visitor's own brand/colour/size/audience choices. */
async function queryFacets(
  params: ListingParams,
  categoryIds: string[] | null,
  searchIds: string[] | null,
): Promise<Facets> {
  const base = buildWhere(params, categoryIds, searchIds, false);
  const stockJoin = params.inStock
    ? Prisma.sql` AND ${V.stockOnHand} - ${V.stockReserved} > 0`
    : Prisma.empty;

  const [colorRows, sizeRows, brandRows, audienceRows] = await Promise.all([
    db.$queryRaw<{ name: string; n: bigint }[]>`
      SELECT MIN(${V.color}) AS name, COUNT(DISTINCT ${P.id}) AS n
      FROM "products" p
      JOIN "product_variants" v ON ${V.productId} = ${P.id} AND ${V.isActive} = true${stockJoin}
      WHERE ${base}
      GROUP BY LOWER(${V.color})
      ORDER BY n DESC, name ASC`,
    db.$queryRaw<{ name: string; n: bigint }[]>`
      SELECT MIN(${V.size}) AS name, COUNT(DISTINCT ${P.id}) AS n
      FROM "products" p
      JOIN "product_variants" v ON ${V.productId} = ${P.id} AND ${V.isActive} = true${stockJoin}
      WHERE ${base}
      GROUP BY LOWER(${V.size})`,
    db.$queryRaw<{ slug: string; name: string; n: bigint }[]>`
      SELECT b."slug" AS slug, MIN(b."name") AS name, COUNT(*) AS n
      FROM "products" p
      JOIN "brands" b ON b."id" = ${P.brandId}
      WHERE ${base}
      GROUP BY b."slug"
      ORDER BY n DESC, name ASC`,
    db.$queryRaw<{ value: string; n: bigint }[]>`
      SELECT ${P.audience}::text AS value, COUNT(*) AS n
      FROM "products" p
      WHERE ${base}
      GROUP BY ${P.audience}`,
  ]);

  // Swatch colours come from the variants themselves
  const names = colorRows.map((r) => r.name);
  const hexRows =
    names.length > 0
      ? await db.productVariant.findMany({
        where: { color: { in: names }, colorHex: { not: null } },
        distinct: ["color"],
        select: { color: true, colorHex: true },
      })
      : [];
  const hexByColor = new Map(hexRows.map((r) => [r.color, r.colorHex]));

  const audienceCount = new Map(audienceRows.map((r) => [r.value.toLowerCase(), Number(r.n)]));

  return {
    colors: colorRows.map((r) => ({ name: r.name, hex: hexByColor.get(r.name) ?? null, count: Number(r.n) })),
    sizes: sizeRows
      .map((r) => ({ name: r.name, count: Number(r.n) }))
      .sort((a, b) => compareSizes(a.name, b.name)),
    brands: brandRows.map((r) => ({ slug: r.slug, name: r.name, count: Number(r.n) })),
    audiences: AUDIENCE_VALUES.flatMap((value: AudienceValue) => {
      const count = audienceCount.get(value);
      return count ? [{ value, count }] : [];
    }),
  };
}

export async function queryProductListing(
  params: ListingParams,
  locale: CatalogLocale,
  categoryIds: string[] | null,
): Promise<ProductListing> {
  // Search narrows to a ranked list of candidate ids first
  const searchIds = params.q ? await findSearchCandidates(params.q) : null;

  const where = buildWhere(params, categoryIds, searchIds, true);

  const [countRow] = await db.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*)::bigint AS total FROM "products" p WHERE ${where}`;
  const total = Number(countRow?.total ?? 0);

  const totalPages = Math.max(1, Math.ceil(total / LISTING_PAGE_SIZE));
  const page = Math.min(params.page, totalPages);
  const offset = (page - 1) * LISTING_PAGE_SIZE;

  const [idRows, facets] = await Promise.all([
    db.$queryRaw<{ id: string }[]>`
      SELECT ${P.id} AS id FROM "products" p
      WHERE ${where}
      ORDER BY ${orderBy(params, searchIds)}, ${P.id} ASC
      LIMIT ${LISTING_PAGE_SIZE} OFFSET ${offset}`,
    queryFacets(params, categoryIds, searchIds),
  ]);

  const ids = idRows.map((r) => r.id);
  if (ids.length === 0) {
    return { items: [], total, page, pageSize: LISTING_PAGE_SIZE, totalPages, facets };
  }

  const rows = await fetchRows(ids);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const now = new Date();
  const items = ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toCard(row, locale, now)] : [];
  });

  return { items, total, page, pageSize: LISTING_PAGE_SIZE, totalPages, facets };
}

// Homepage shelves

export type Shelf = "featured" | "new" | "best" | "sale";

const SALE_ACTIVE = Prisma.sql`(${P.salePrice} IS NOT NULL AND ${P.salePrice} < ${P.price} AND (${P.saleStartsAt} IS NULL OR ${P.saleStartsAt} <= NOW()) AND (${P.saleEndsAt} IS NULL OR ${P.saleEndsAt} >= NOW()))`;

const SHELF_WHERE: Record<Shelf, Prisma.Sql> = {
  featured: Prisma.sql`${P.isFeatured} = true`,
  new: Prisma.sql`TRUE`,
  best: Prisma.sql`${P.soldCount} > 0`, // an honest "best seller" has actually sold
  sale: SALE_ACTIVE,
};

const SHELF_ORDER: Record<Shelf, Prisma.Sql> = {
  featured: Prisma.sql`${P.soldCount} DESC, ${P.createdAt} DESC`,
  new: ORDER_BY.newest,
  best: Prisma.sql`${P.soldCount} DESC, ${P.createdAt} DESC`,
  sale: Prisma.sql`(1 - ${EFFECTIVE_PRICE} / NULLIF(${P.price}, 0)) DESC, ${P.soldCount} DESC`,
};

/** A row of products for the homepage. Sold-out products are never shown. */
export async function queryShelf(
  shelf: Shelf,
  limit: number,
  locale: CatalogLocale,
): Promise<ProductCardData[]> {
  const idRows = await db.$queryRaw<{ id: string }[]>`
    SELECT ${P.id} AS id FROM "products" p
    WHERE ${P.status} = 'ACTIVE'
      AND ${SHELF_WHERE[shelf]}
      AND EXISTS (SELECT 1 FROM "product_variants" v WHERE ${V.productId} = ${P.id} AND ${V.isActive} = true AND ${V.stockOnHand} - ${V.stockReserved} > 0)
    ORDER BY ${SHELF_ORDER[shelf]}, ${P.id} ASC
    LIMIT ${limit}`;

  const ids = idRows.map((r) => r.id);
  if (ids.length === 0) return [];

  const rows = await fetchRows(ids);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const now = new Date();
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toCard(row, locale, now)] : [];
  });
}