import { db } from "../../lib/db";
import { fetchRows, toCard } from "./listing-query";
import type { CatalogLocale, ProductCardData } from "./types";

/** Same category first, ordered by sales. Fills up from the rest of the shop if needed. */
export async function queryRelatedProducts(
  productId: string,
  categoryId: string,
  locale: CatalogLocale,
  limit = 4,
): Promise<ProductCardData[]> {
  const order = [{ soldCount: "desc" as const }, { createdAt: "desc" as const }];

  const sameCategory = await db.product.findMany({
    where: { status: "ACTIVE", categoryId, id: { not: productId } },
    orderBy: order,
    take: limit,
    select: { id: true },
  });
  let ids = sameCategory.map((p) => p.id);

  if (ids.length < limit) {
    const more = await db.product.findMany({
      where: { status: "ACTIVE", id: { notIn: [productId, ...ids] } },
      orderBy: order,
      take: limit - ids.length,
      select: { id: true },
    });
    ids = [...ids, ...more.map((p) => p.id)];
  }
  if (ids.length === 0) return [];

  const rows = await fetchRows(ids);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const now = new Date();
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toCard(row, locale, now)] : [];
  });
}