import { Prisma } from "../../generated/prisma/client";
import { MAX_QUANTITY_PER_LINE } from "../../config/features";
import { localized } from "../../i18n/localized";
import { db } from "../../lib/db";
import { hashToken } from "../../lib/tokens";
import { resolvePrice } from "../catalog/pricing";
import type { CatalogLocale } from "../catalog/types";
import { priceCart, type PricedCart, type PricingLine } from "../pricing/cart-pricing";
import type { CouponRules } from "../pricing/coupon";

export const GUEST_CART_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type CartOwner = { userId: string } | { guestToken: string };

const isGuest = (owner: CartOwner): owner is { guestToken: string } => "guestToken" in owner;
const isDuplicate = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

// ---------------------------------------------------------------------------
// Finding and creating carts
// ---------------------------------------------------------------------------

/** Never creates anything. An expired guest cart counts as missing. */
export async function findCartForRead(owner: CartOwner, now = new Date()) {
  if (!isGuest(owner)) {
    return db.cart.findUnique({
      where: { userId: owner.userId },
      select: { id: true, couponCode: true },
    });
  }
  return db.cart.findFirst({
    where: { guestTokenHash: hashToken(owner.guestToken), expiresAt: { gt: now } },
    select: { id: true, couponCode: true },
  });
}

/** Finds the caller's cart or creates it. Safe when two requests create it at the same moment. */
export async function getOrCreateCart(owner: CartOwner, now = new Date()): Promise<{ id: string }> {
  if (!isGuest(owner)) {
    const existing = await db.cart.findUnique({ where: { userId: owner.userId }, select: { id: true } });
    if (existing) return existing;
    try {
      return await db.cart.create({ data: { userId: owner.userId }, select: { id: true } });
    } catch (error) {
      if (!isDuplicate(error)) throw error;
      const created = await db.cart.findUnique({ where: { userId: owner.userId }, select: { id: true } });
      if (!created) throw error;
      return created;
    }
  }

  const hash = hashToken(owner.guestToken);
  const expiresAt = new Date(now.getTime() + GUEST_CART_TTL_MS);

  const existing = await db.cart.findUnique({
    where: { guestTokenHash: hash },
    select: { id: true, expiresAt: true },
  });

  if (existing) {
    const expired = existing.expiresAt !== null && existing.expiresAt <= now;
    if (expired) await db.cartItem.deleteMany({ where: { cartId: existing.id } });
    await db.cart.update({
      where: { id: existing.id },
      data: { lastActiveAt: now, expiresAt, ...(expired ? { couponCode: null } : {}) },
    });
    return { id: existing.id };
  }

  try {
    return await db.cart.create({ data: { guestTokenHash: hash, expiresAt }, select: { id: true } });
  } catch (error) {
    if (!isDuplicate(error)) throw error;
    const created = await db.cart.findUnique({ where: { guestTokenHash: hash }, select: { id: true } });
    if (!created) throw error;
    return created;
  }
}

export async function countUnits(cartId: string): Promise<number> {
  const result = await db.cartItem.aggregate({ where: { cartId }, _sum: { quantity: true } });
  return result._sum.quantity ?? 0;
}

// ---------------------------------------------------------------------------
// Changing a cart. Every item lookup includes the cartId, so an id from
// another customer's cart is simply "not found".
// ---------------------------------------------------------------------------

export type AddResult =
  | { ok: true; quantity: number; added: number; capped: boolean }
  | { ok: false; error: "NOT_FOUND" | "OUT_OF_STOCK" | "AT_LIMIT" };

async function addItemOnce(cartId: string, variantId: string, quantity: number): Promise<AddResult> {
  const variant = await db.productVariant.findFirst({
    where: { id: variantId, isActive: true, product: { status: "ACTIVE" } },
    select: { stockOnHand: true, stockReserved: true },
  });
  if (!variant) return { ok: false, error: "NOT_FOUND" };

  const available = Math.max(0, variant.stockOnHand - variant.stockReserved);
  if (available === 0) return { ok: false, error: "OUT_OF_STOCK" };
  const cap = Math.min(available, MAX_QUANTITY_PER_LINE);

  return db.$transaction(async (tx) => {
    const key = { cartId_variantId: { cartId, variantId } };
    const existing = await tx.cartItem.findUnique({ where: key, select: { quantity: true } });
    const current = existing?.quantity ?? 0;

    if (current >= cap) return { ok: false, error: "AT_LIMIT" } as const;

    const next = Math.min(current + quantity, cap);
    await tx.cartItem.upsert({
      where: key,
      update: { quantity: next },
      create: { cartId, variantId, quantity: next },
    });
    return { ok: true, quantity: next, added: next - current, capped: current + quantity > cap } as const;
  });
}

export async function addItem(cartId: string, variantId: string, quantity: number): Promise<AddResult> {
  try {
    return await addItemOnce(cartId, variantId, quantity);
  } catch (error) {
    if (!isDuplicate(error)) throw error;
    return addItemOnce(cartId, variantId, quantity); // a parallel request created the line first
  }
}

export type SetQuantityResult =
  | { ok: true; quantity: number; capped: boolean }
  | { ok: false; error: "NOT_FOUND" | "OUT_OF_STOCK" };

export async function setItemQuantity(
  cartId: string,
  itemId: string,
  requested: number,
): Promise<SetQuantityResult> {
  const item = await db.cartItem.findFirst({
    where: { id: itemId, cartId },
    select: {
      id: true,
      variant: {
        select: {
          isActive: true,
          stockOnHand: true,
          stockReserved: true,
          product: { select: { status: true } },
        },
      },
    },
  });
  if (!item) return { ok: false, error: "NOT_FOUND" };

  const v = item.variant;
  const available =
    v.isActive && v.product.status === "ACTIVE" ? Math.max(0, v.stockOnHand - v.stockReserved) : 0;
  const cap = Math.min(available, MAX_QUANTITY_PER_LINE);
  if (cap < 1) return { ok: false, error: "OUT_OF_STOCK" };

  const quantity = Math.min(Math.max(1, requested), cap);
  const updated = await db.cartItem.updateMany({ where: { id: item.id, cartId }, data: { quantity } });
  if (updated.count === 0) return { ok: false, error: "NOT_FOUND" };
  return { ok: true, quantity, capped: requested > cap };
}

/** Safe to repeat. Removing something that isn't there is fine. */
export async function removeItem(cartId: string, itemId: string): Promise<void> {
  await db.cartItem.deleteMany({ where: { id: itemId, cartId } });
}

export async function setCoupon(cartId: string, code: string | null): Promise<void> {
  await db.cart.update({ where: { id: cartId }, data: { couponCode: code } });
}

/** Removes lines that can't be bought any more and lowers the rest to what is in stock. */
export async function reconcileCart(cartId: string): Promise<{ removed: number; reduced: number }> {
  const items = await db.cartItem.findMany({
    where: { cartId },
    select: {
      id: true,
      quantity: true,
      variant: {
        select: {
          isActive: true,
          stockOnHand: true,
          stockReserved: true,
          product: { select: { status: true } },
        },
      },
    },
  });

  let removed = 0;
  let reduced = 0;
  for (const item of items) {
    const v = item.variant;
    const buyable = v.isActive && v.product.status === "ACTIVE";
    const cap = buyable
      ? Math.min(Math.max(0, v.stockOnHand - v.stockReserved), MAX_QUANTITY_PER_LINE)
      : 0;

    if (cap < 1) {
      await db.cartItem.deleteMany({ where: { id: item.id, cartId } });
      removed++;
    } else if (item.quantity > cap) {
      await db.cartItem.updateMany({ where: { id: item.id, cartId }, data: { quantity: cap } });
      reduced++;
    }
  }
  return { removed, reduced };
}

// ---------------------------------------------------------------------------
// Merging a guest cart into the cart of a customer who just signed in
// ---------------------------------------------------------------------------

export async function mergeGuestIntoUser(
  userId: string,
  guestToken: string,
  now = new Date(),
): Promise<{ merged: number }> {
  const guest = await db.cart.findUnique({
    where: { guestTokenHash: hashToken(guestToken) },
    select: {
      id: true,
      couponCode: true,
      expiresAt: true,
      items: { select: { variantId: true, quantity: true } },
    },
  });
  if (!guest) return { merged: 0 };

  if (guest.expiresAt && guest.expiresAt <= now) {
    await db.cart.deleteMany({ where: { id: guest.id } });
    return { merged: 0 };
  }

  return db.$transaction(async (tx) => {
    // Claim the guest cart first. If another tab already merged it, there is nothing left to do.
    const claimed = await tx.cart.deleteMany({ where: { id: guest.id } });
    if (claimed.count === 0) return { merged: 0 };

    const userCart =
      (await tx.cart.findUnique({ where: { userId }, select: { id: true, couponCode: true } })) ??
      (await tx.cart.create({ data: { userId }, select: { id: true, couponCode: true } }));

    for (const item of guest.items) {
      const key = { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } };
      const existing = await tx.cartItem.findUnique({ where: key, select: { quantity: true } });
      const quantity = Math.min((existing?.quantity ?? 0) + item.quantity, MAX_QUANTITY_PER_LINE);
      await tx.cartItem.upsert({
        where: key,
        update: { quantity },
        create: { cartId: userCart.id, variantId: item.variantId, quantity },
      });
    }

    // The signed-in cart's own coupon wins
    if (!userCart.couponCode && guest.couponCode) {
      await tx.cart.update({ where: { id: userCart.id }, data: { couponCode: guest.couponCode } });
    }
    return { merged: guest.items.length };
  });
}

// ---------------------------------------------------------------------------
// The cart as the customer sees it
// ---------------------------------------------------------------------------

export type CartLineIssue = "UNAVAILABLE" | "OUT_OF_STOCK" | "REDUCED";

export interface CartLineView {
  itemId: string;
  variantId: string;
  productId: string;
  categoryId: string;
  slug: string;
  name: string;
  sku: string;
  size: string;
  color: string;
  imageUrl: string | null;
  imageAlt: string;
  unitPrice: number;
  regularPrice: number;
  onSale: boolean;
  isTaxable: boolean;
  /** What is stored in the cart. */
  quantity: number;
  /** What we will actually charge for: never more than is available. */
  effectiveQuantity: number;
  available: number;
  issue: CartLineIssue | null;
}

export type CouponView =
  | { status: "APPLIED"; code: string; discount: number }
  | {
      status: "INVALID";
      code: string;
      reason: "INVALID" | "USER_LIMIT" | "MIN_ORDER" | "NOT_APPLICABLE";
      minOrder?: number;
    };

export interface CartView {
  cartId: string;
  lines: CartLineView[];
  priced: PricedCart;
  coupon: CouponView | null;
  tax: { enabled: boolean; ratePercent: number; label: string };
  hasIssues: boolean;
  unitCount: number;
  payableCount: number;
}

/** Codes are stored upper-case. Anything that isn't a plausible code is rejected up front. */
export function normalizeCouponCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  return /^[A-Z0-9_-]{3,40}$/.test(code) ? code : null;
}

async function loadCoupon(code: string): Promise<{ id: string; rules: CouponRules } | null> {
  const c = await db.coupon.findUnique({
    where: { code },
    include: {
      products: { select: { productId: true } },
      categories: { select: { categoryId: true } },
    },
  });
  if (!c) return null;

  return {
    id: c.id,
    rules: {
      code: c.code,
      discountType: c.discountType,
      value: Number(c.value),
      maxDiscountAmount: c.maxDiscountAmount === null ? null : Number(c.maxDiscountAmount),
      minOrderAmount: c.minOrderAmount === null ? null : Number(c.minOrderAmount),
      usageLimit: c.usageLimit,
      usageLimitPerUser: c.usageLimitPerUser,
      usedCount: c.usedCount,
      excludeSaleItems: c.excludeSaleItems,
      startsAt: c.startsAt,
      expiresAt: c.expiresAt,
      isActive: c.isActive,
      productIds: c.products.map((p) => p.productId),
      categoryIds: c.categories.map((x) => x.categoryId),
    },
  };
}

export async function loadCartView(
  cartId: string,
  options: {
    locale: CatalogLocale;
    userId: string | null;
    now?: Date;
    /** Try this code instead of the stored one (used when applying a coupon). */
    couponOverride?: string | null;
  },
): Promise<CartView> {
  const now = options.now ?? new Date();

  const [cart, settings] = await Promise.all([
    db.cart.findUnique({
      where: { id: cartId },
      select: {
        couponCode: true,
        items: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            quantity: true,
            variant: {
              select: {
                id: true,
                sku: true,
                size: true,
                color: true,
                isActive: true,
                stockOnHand: true,
                stockReserved: true,
                product: {
                  select: {
                    id: true,
                    slug: true,
                    name: true,
                    nameMy: true,
                    status: true,
                    price: true,
                    salePrice: true,
                    saleStartsAt: true,
                    saleEndsAt: true,
                    isTaxable: true,
                    categoryId: true,
                    images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, alt: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.storeSettings.findUnique({ where: { id: "default" } }),
  ]);

  const lines: CartLineView[] = (cart?.items ?? []).map((item) => {
    const v = item.variant;
    const p = v.product;
    const name = localized(p.name, p.nameMy, options.locale);
    const price = resolvePrice(
      {
        price: Number(p.price),
        salePrice: p.salePrice === null ? null : Number(p.salePrice),
        saleStartsAt: p.saleStartsAt,
        saleEndsAt: p.saleEndsAt,
      },
      now,
    );

    const buyable = v.isActive && p.status === "ACTIVE";
    const available = buyable ? Math.max(0, v.stockOnHand - v.stockReserved) : 0;
    const cap = Math.min(available, MAX_QUANTITY_PER_LINE);
    const effectiveQuantity = Math.min(item.quantity, cap);

    const issue: CartLineIssue | null = !buyable
      ? "UNAVAILABLE"
      : available === 0
        ? "OUT_OF_STOCK"
        : item.quantity > cap
          ? "REDUCED"
          : null;

    const image = p.images[0];
    return {
      itemId: item.id,
      variantId: v.id,
      productId: p.id,
      categoryId: p.categoryId,
      slug: p.slug,
      name,
      sku: v.sku,
      size: v.size,
      color: v.color,
      imageUrl: image?.url ?? null,
      imageAlt: image?.alt ?? name,
      unitPrice: price.price,
      regularPrice: Number(p.price),
      onSale: price.onSale,
      isTaxable: p.isTaxable,
      quantity: item.quantity,
      effectiveQuantity,
      available,
      issue,
    };
  });

  const pricingLines: PricingLine[] = lines
    .filter((l) => l.effectiveQuantity > 0)
    .map((l) => ({
      id: l.itemId,
      productId: l.productId,
      categoryId: l.categoryId,
      unitPrice: l.unitPrice,
      regularPrice: l.regularPrice,
      quantity: l.effectiveQuantity,
      isTaxable: l.isTaxable,
    }));

  // Which coupon to look at
  const rawCode =
    options.couponOverride !== undefined ? options.couponOverride : (cart?.couponCode ?? null);
  const code = rawCode === null ? null : normalizeCouponCode(rawCode);

  let couponInput: { rules: CouponRules; userRedemptions: number | null } | null = null;
  let unknownCode: string | null = null;

  if (rawCode !== null) {
    const loaded = code ? await loadCoupon(code) : null;
    if (!loaded) {
      unknownCode = code ?? rawCode.trim().toUpperCase().slice(0, 40);
    } else {
      const perUser = loaded.rules.usageLimitPerUser !== null && options.userId !== null;
      couponInput = {
        rules: loaded.rules,
        userRedemptions: perUser
          ? await db.couponRedemption.count({ where: { couponId: loaded.id, userId: options.userId } })
          : null,
      };
    }
  }

  const tax = {
    enabled: settings?.taxEnabled ?? false,
    ratePercent: settings ? Number(settings.taxRate) : 0,
    label: settings?.taxLabel ?? "Tax",
  };

  const priced = priceCart({ lines: pricingLines, coupon: couponInput, now, tax, shippingFee: 0 });

  let coupon: CouponView | null = null;
  if (unknownCode !== null) {
    coupon = { status: "INVALID", code: unknownCode, reason: "INVALID" };
  } else if (priced.coupon?.applied) {
    coupon = { status: "APPLIED", code: priced.coupon.code, discount: priced.coupon.discount };
  } else if (priced.coupon) {
    const reason = priced.coupon.reason;
    coupon =
      reason === "USER_LIMIT" || reason === "NOT_APPLICABLE"
        ? { status: "INVALID", code: priced.coupon.code, reason }
        : reason === "MIN_ORDER"
          ? {
              status: "INVALID",
              code: priced.coupon.code,
              reason,
              minOrder: priced.coupon.minOrder ?? undefined,
            }
          : { status: "INVALID", code: priced.coupon.code, reason: "INVALID" }; // inactive, early, expired, used up
  }

  return {
    cartId,
    lines,
    priced,
    coupon,
    tax,
    hasIssues: lines.some((l) => l.issue !== null),
    unitCount: lines.reduce((s, l) => s + l.quantity, 0),
    payableCount: lines.reduce((s, l) => s + l.effectiveQuantity, 0),
  };
}