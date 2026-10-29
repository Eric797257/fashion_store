import { db } from "../../lib/db";
import { localized } from "../../i18n/localized";
import { fetchRows, toCard } from "../catalog/listing-query";
import type { CatalogLocale, ProductCardData } from "../catalog/types";

/** Ids of saved products that can still be bought, newest first. */
export async function queryWishlistProductIds(userId: string): Promise<string[]> {
  const rows = await db.wishlistItem.findMany({
    where: { wishlist: { userId }, product: { status: "ACTIVE" } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { productId: true },
  });
  return rows.map((r) => r.productId);
}

export interface WishlistPageData {
  items: ProductCardData[];
  unavailable: { productId: string; name: string }[];
}

export async function queryWishlistItems(
  userId: string,
  locale: CatalogLocale,
): Promise<WishlistPageData> {
  const saved = await db.wishlistItem.findMany({
    where: { wishlist: { userId } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      productId: true,
      product: { select: { status: true, name: true, nameMy: true } },
    },
  });

  const activeIds = saved.filter((s) => s.product.status === "ACTIVE").map((s) => s.productId);
  const unavailable = saved
    .filter((s) => s.product.status !== "ACTIVE")
    .map((s) => ({
      productId: s.productId,
      name: localized(s.product.name, s.product.nameMy, locale),
    }));

  const rows = activeIds.length > 0 ? await fetchRows(activeIds) : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const now = new Date();
  const items = activeIds.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toCard(row, locale, now)] : [];
  });

  return { items, unavailable };
}