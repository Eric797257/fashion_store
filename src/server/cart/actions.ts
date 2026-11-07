"use server";

import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, resolveLocale } from "@/i18n/locale";
import { consumeAttempt } from "@/lib/db-rate-limit";
import { allowRequest, clientIp } from "@/lib/memory-rate-limit";
import { TOKEN_PATTERN, hashToken, newToken } from "@/lib/tokens";
import { getAccess } from "@/server/auth/access";
import { db } from "@/lib/db";
import { shippingFeeFor } from "@/server/pricing/shipping";
import {
  addToCartSchema,
  couponCodeSchema,
  itemIdSchema,
  setQuantitySchema,
  zoneIdSchema,
} from "@/validation/cart";
import { CART_COOKIE, CART_COOKIE_MAX_AGE_S } from "./constants";
import { getReadOwner } from "./queries";
import {
  addItem,
  countUnits,
  findCartForRead,
  getOrCreateCart,
  loadCartView,
  mergeGuestIntoUser,
  normalizeCouponCode,
  reconcileCart,
  removeItem,
  setCoupon,
  setItemQuantity,
  type CartOwner,
} from "./service";

type Fail<E extends string> = { ok: false; error: E };

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: CART_COOKIE_MAX_AGE_S,
};

async function locale() {
  return resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}

/**
 * Who is changing the cart. A signed-in customer always uses their own cart. A guest gets a
 * random token cookie (created here, never accepted from the browser as an id).
 */
async function writeOwner(): Promise<
  { owner: CartOwner; userId: string | null } | { rateLimited: true }
> {
  const access = await getAccess();
  if (access) return { owner: { userId: access.userId }, userId: access.userId };

  const store = await cookies();
  let token = store.get(CART_COOKIE)?.value;

  if (!token || !TOKEN_PATTERN.test(token)) {
    const ip = clientIp(await headers());
    if (!(await consumeAttempt(`cart-create:${ip}`, 20, 60 * 60 * 1000))) return { rateLimited: true };
    token = newToken();
  }

  store.set(CART_COOKIE, token, cookieOptions); // creates it, or keeps it alive
  return { owner: { guestToken: token }, userId: null };
}

const ownerKey = (owner: CartOwner) =>
  "userId" in owner ? `u:${owner.userId}` : `g:${hashToken(owner.guestToken).slice(0, 16)}`;

function logFailure(name: string, error: unknown) {
  console.error(`[cart] ${name} failed:`, error instanceof Error ? error.message : "unknown error");
}

// ---------------------------------------------------------------------------

export type AddToCartResult =
  | { ok: true; quantity: number; added: number; capped: boolean }
  | Fail<"INVALID" | "NOT_FOUND" | "OUT_OF_STOCK" | "AT_LIMIT" | "RATE_LIMITED" | "FAILED">;

export async function addToCart(variantId: string, quantity: number): Promise<AddToCartResult> {
  const parsed = addToCartSchema.safeParse({ variantId, quantity });
  if (!parsed.success) return { ok: false, error: "INVALID" };

  try {
    const who = await writeOwner();
    if ("rateLimited" in who) return { ok: false, error: "RATE_LIMITED" };
    if (!allowRequest(`cart:${ownerKey(who.owner)}`, 120, 60_000)) return { ok: false, error: "RATE_LIMITED" };

    const cart = await getOrCreateCart(who.owner);
    return await addItem(cart.id, parsed.data.variantId, parsed.data.quantity);
  } catch (error) {
    logFailure("add", error);
    return { ok: false, error: "FAILED" };
  }
}

export type ChangeResult =
  | { ok: true; quantity?: number; capped?: boolean }
  | Fail<"INVALID" | "NOT_FOUND" | "OUT_OF_STOCK" | "RATE_LIMITED" | "FAILED">;

async function ownCart(): Promise<{ cartId: string } | Fail<"RATE_LIMITED" | "NOT_FOUND">> {
  const owner = await getReadOwner();
  if (!owner) return { ok: false, error: "NOT_FOUND" };
  if (!allowRequest(`cart:${ownerKey(owner)}`, 120, 60_000)) return { ok: false, error: "RATE_LIMITED" };
  const cart = await findCartForRead(owner);
  return cart ? { cartId: cart.id } : { ok: false, error: "NOT_FOUND" };
}

export async function setCartQuantity(itemId: string, quantity: number): Promise<ChangeResult> {
  const parsed = setQuantitySchema.safeParse({ itemId, quantity });
  if (!parsed.success) return { ok: false, error: "INVALID" };

  try {
    const cart = await ownCart();
    if ("ok" in cart) return cart;
    const result = await setItemQuantity(cart.cartId, parsed.data.itemId, parsed.data.quantity);
    return result.ok ? { ok: true, quantity: result.quantity, capped: result.capped } : result;
  } catch (error) {
    logFailure("set quantity", error);
    return { ok: false, error: "FAILED" };
  }
}

export async function removeCartItem(itemId: string): Promise<ChangeResult> {
  const parsed = itemIdSchema.safeParse({ itemId });
  if (!parsed.success) return { ok: false, error: "INVALID" };

  try {
    const cart = await ownCart();
    if ("ok" in cart) return cart;
    await removeItem(cart.cartId, parsed.data.itemId);
    return { ok: true };
  } catch (error) {
    logFailure("remove", error);
    return { ok: false, error: "FAILED" };
  }
}

export async function reconcileMyCart(): Promise<
  { ok: true; removed: number; reduced: number } | Fail<"NOT_FOUND" | "RATE_LIMITED" | "FAILED">
> {
  try {
    const cart = await ownCart();
    if ("ok" in cart) return cart;
    return { ok: true, ...(await reconcileCart(cart.cartId)) };
  } catch (error) {
    logFailure("reconcile", error);
    return { ok: false, error: "FAILED" };
  }
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

export type CouponResult =
  | { ok: true; code: string; discount: number }
  | { ok: false; error: "INVALID" | "USER_LIMIT" | "NOT_APPLICABLE" | "EMPTY_CART" | "RATE_LIMITED" | "FAILED"; minOrder?: never }
  | { ok: false; error: "MIN_ORDER"; minOrder: number };

export async function applyCoupon(code: string): Promise<CouponResult> {
  const parsed = couponCodeSchema.safeParse({ code });
  if (!parsed.success) return { ok: false, error: "INVALID" };

  try {
    // Counted in the database so every server shares the limit: codes can't be guessed
    const ip = clientIp(await headers());
    if (!(await consumeAttempt(`coupon:${ip}`, 20, 10 * 60 * 1000))) {
      return { ok: false, error: "RATE_LIMITED" };
    }

    const normalized = normalizeCouponCode(parsed.data.code);
    if (!normalized) return { ok: false, error: "INVALID" };

    const owner = await getReadOwner();
    const cart = owner ? await findCartForRead(owner) : null;
    if (!cart || !owner) return { ok: false, error: "EMPTY_CART" };

    const userId = "userId" in owner ? owner.userId : null;
    const view = await loadCartView(cart.id, { locale: await locale(), userId, couponOverride: normalized });

    if (view.payableCount === 0) return { ok: false, error: "EMPTY_CART" };

    const coupon = view.coupon;
    if (!coupon) return { ok: false, error: "INVALID" };

    if (coupon.status === "APPLIED") {
      await setCoupon(cart.id, coupon.code);
      return { ok: true, code: coupon.code, discount: coupon.discount };
    }
    if (coupon.reason === "MIN_ORDER") {
      return { ok: false, error: "MIN_ORDER", minOrder: coupon.minOrder ?? 0 };
    }
    return { ok: false, error: coupon.reason };
  } catch (error) {
    logFailure("apply coupon", error);
    return { ok: false, error: "FAILED" };
  }
}

export async function removeCoupon(): Promise<{ ok: true } | Fail<"NOT_FOUND" | "FAILED">> {
  try {
    const owner = await getReadOwner();
    const cart = owner ? await findCartForRead(owner) : null;
    if (!cart) return { ok: false, error: "NOT_FOUND" };
    await setCoupon(cart.id, null);
    return { ok: true };
  } catch (error) {
    logFailure("remove coupon", error);
    return { ok: false, error: "FAILED" };
  }
}

// ---------------------------------------------------------------------------
// Merging a guest cart after sign-in
// ---------------------------------------------------------------------------

export async function mergeGuestCart(): Promise<{ merged: number }> {
  try {
    const access = await getAccess();
    if (!access) return { merged: 0 };

    const store = await cookies();
    const token = store.get(CART_COOKIE)?.value;
    if (!token || !TOKEN_PATTERN.test(token)) return { merged: 0 };

    const result = await mergeGuestIntoUser(access.userId, token);
    store.delete(CART_COOKIE); // from now on the customer's own cart is used
    return result;
  } catch (error) {
    logFailure("merge", error);
    return { merged: 0 };
  }
}

// ---------------------------------------------------------------------------
// Shipping estimate
// ---------------------------------------------------------------------------

export interface ShippingOption {
  code: string;
  name: string;
  fee: number;
  free: boolean;
  etaMinDays: number;
  etaMaxDays: number;
  codAvailable: boolean;
}

export async function estimateShipping(
  zoneId: string,
): Promise<{ ok: true; options: ShippingOption[] } | Fail<"INVALID" | "FAILED">> {
  const parsed = zoneIdSchema.safeParse({ zoneId });
  if (!parsed.success) return { ok: false, error: "INVALID" };

  try {
    // The goods total after the discount decides "free shipping over X"
    let goodsAfterDiscount = 0;
    const owner = await getReadOwner();
    const cart = owner ? await findCartForRead(owner) : null;
    if (cart && owner) {
      const view = await loadCartView(cart.id, {
        locale: await locale(),
        userId: "userId" in owner ? owner.userId : null,
      });
      goodsAfterDiscount = view.priced.subtotal - view.priced.discountTotal;
    }

    const rates = await db.shippingRate.findMany({
      where: { zoneId: parsed.data.zoneId, zone: { isActive: true }, method: { isActive: true } },
      orderBy: { method: { sortOrder: "asc" } },
      select: {
        fee: true,
        freeShippingOver: true,
        method: {
          select: { code: true, name: true, etaMinDays: true, etaMaxDays: true, codAvailable: true },
        },
      },
    });

    return {
      ok: true,
      options: rates.map((r) => {
        const { fee, free } = shippingFeeFor(
          {
            fee: Number(r.fee),
            freeShippingOver: r.freeShippingOver === null ? null : Number(r.freeShippingOver),
          },
          goodsAfterDiscount,
        );
        return {
          code: r.method.code,
          name: r.method.name,
          fee,
          free,
          etaMinDays: r.method.etaMinDays,
          etaMaxDays: r.method.etaMaxDays,
          codAvailable: r.method.codAvailable,
        };
      }),
    };
  } catch (error) {
    logFailure("estimate shipping", error);
    return { ok: false, error: "FAILED" };
  }
}

export { countUnits as _countUnitsForTests };