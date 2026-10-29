"use server";

import { z } from "zod";
import { allowRequest } from "@/lib/memory-rate-limit";
import { getAccess } from "@/server/auth/access";
import { setWishlistedForUser } from "./service";

const inputSchema = z.object({
  productId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  wanted: z.boolean(),
});

export type WishlistActionResult =
  | { ok: true; wishlisted: boolean }
  | {
      ok: false;
      error: "UNAUTHENTICATED" | "INVALID" | "NOT_FOUND" | "LIMIT" | "RATE_LIMITED" | "FAILED";
    };

/** Save or remove a product for the signed-in customer. The wishlist is always their own. */
export async function setWishlisted(productId: string, wanted: boolean): Promise<WishlistActionResult> {
  const parsed = inputSchema.safeParse({ productId, wanted });
  if (!parsed.success) return { ok: false, error: "INVALID" };

  // The user comes from the session. Nothing about identity is read from the request body.
  const access = await getAccess();
  if (!access) return { ok: false, error: "UNAUTHENTICATED" };

  if (!allowRequest(`wishlist:${access.userId}`, 60, 60_000)) {
    return { ok: false, error: "RATE_LIMITED" };
  }

  try {
    const result = await setWishlistedForUser(access.userId, parsed.data.productId, parsed.data.wanted);
    return result.ok ? { ok: true, wishlisted: result.wishlisted } : result;
  } catch (error) {
    console.error("[wishlist] update failed:", error instanceof Error ? error.message : "unknown error");
    return { ok: false, error: "FAILED" };
  }
}