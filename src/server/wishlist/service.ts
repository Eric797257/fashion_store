import { Prisma } from "../../generated/prisma/client";
import { db } from "../../lib/db";

export const MAX_WISHLIST_ITEMS = 200;

export type SetWishlistedResult =
  | { ok: true; wishlisted: boolean }
  | { ok: false; error: "NOT_FOUND" | "LIMIT" };

const isDuplicate = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/** One wishlist per user. Safe when two requests create it at the same moment. */
async function ensureWishlist(userId: string): Promise<string> {
  const existing = await db.wishlist.findUnique({ where: { userId }, select: { id: true } });
  if (existing) return existing.id;

  try {
    return (await db.wishlist.create({ data: { userId }, select: { id: true } })).id;
  } catch (error) {
    if (!isDuplicate(error)) throw error;
    const created = await db.wishlist.findUnique({ where: { userId }, select: { id: true } });
    if (!created) throw error;
    return created.id;
  }
}

/**
 * Sets the product's saved state for this user. Idempotent: asking for the
 * state it already has changes nothing. The user id must come from the
 * server-side session, never from the browser.
 */
export async function setWishlistedForUser(
  userId: string,
  productId: string,
  wanted: boolean,
): Promise<SetWishlistedResult> {
  if (!wanted) {
    await db.wishlistItem.deleteMany({ where: { productId, wishlist: { userId } } });
    return { ok: true, wishlisted: false };
  }

  const product = await db.product.findFirst({
    where: { id: productId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!product) return { ok: false, error: "NOT_FOUND" };

  const wishlistId = await ensureWishlist(userId);

  const already = await db.wishlistItem.findUnique({
    where: { wishlistId_productId: { wishlistId, productId } },
    select: { id: true },
  });
  if (already) return { ok: true, wishlisted: true };

  const count = await db.wishlistItem.count({ where: { wishlistId } });
  if (count >= MAX_WISHLIST_ITEMS) return { ok: false, error: "LIMIT" };

  try {
    await db.wishlistItem.create({ data: { wishlistId, productId } });
  } catch (error) {
    // A parallel request saved the same product first. That is the state we wanted.
    if (!isDuplicate(error)) throw error;
  }
  return { ok: true, wishlisted: true };
}