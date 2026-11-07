import { toMinor } from "./money";

export type CouponFailure =
  | "INACTIVE"
  | "NOT_STARTED"
  | "EXPIRED"
  | "USAGE_LIMIT"
  | "USER_LIMIT"
  | "MIN_ORDER"
  | "NOT_APPLICABLE";

export interface CouponRules {
  code: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  maxDiscountAmount: number | null;
  minOrderAmount: number | null;
  usageLimit: number | null;
  usageLimitPerUser: number | null;
  usedCount: number;
  excludeSaleItems: boolean;
  startsAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  /** If either list has entries, the code only applies to those products / categories. */
  productIds: string[];
  categoryIds: string[];
}

export interface CouponLine {
  id: string;
  productId: string;
  categoryId: string;
  grossMinor: number;
  onSale: boolean;
}

export type CouponEvaluation =
  | { ok: true; discountMinor: number; eligibleLineIds: string[] }
  | { ok: false; reason: CouponFailure; minOrderMinor?: number };

export function evaluateCoupon(
  coupon: CouponRules,
  lines: CouponLine[],
  context: {
    now: Date;
    /** How often this customer used the code. null = unknown (a guest). Checked again at checkout. */
    userRedemptions: number | null;
  },
): CouponEvaluation {
  if (!coupon.isActive) return { ok: false, reason: "INACTIVE" };
  if (coupon.startsAt && coupon.startsAt > context.now) return { ok: false, reason: "NOT_STARTED" };
  if (coupon.expiresAt && coupon.expiresAt < context.now) return { ok: false, reason: "EXPIRED" };
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, reason: "USAGE_LIMIT" };
  }
  if (
    coupon.usageLimitPerUser !== null &&
    context.userRedemptions !== null &&
    context.userRedemptions >= coupon.usageLimitPerUser
  ) {
    return { ok: false, reason: "USER_LIMIT" };
  }

  // The minimum is measured on the goods before any discount
  if (coupon.minOrderAmount !== null) {
    const goods = lines.reduce((sum, l) => sum + l.grossMinor, 0);
    const minimum = toMinor(coupon.minOrderAmount);
    if (goods < minimum) return { ok: false, reason: "MIN_ORDER", minOrderMinor: minimum };
  }

  const restricted = coupon.productIds.length > 0 || coupon.categoryIds.length > 0;
  const eligible = lines.filter((l) => {
    if (coupon.excludeSaleItems && l.onSale) return false;
    if (!restricted) return true;
    return coupon.productIds.includes(l.productId) || coupon.categoryIds.includes(l.categoryId);
  });

  const base = eligible.reduce((sum, l) => sum + l.grossMinor, 0);
  if (base <= 0) return { ok: false, reason: "NOT_APPLICABLE" };

  let discount =
    coupon.discountType === "PERCENTAGE"
      ? Math.round((base * coupon.value) / 100)
      : toMinor(coupon.value);

  if (coupon.discountType === "PERCENTAGE" && coupon.maxDiscountAmount !== null) {
    discount = Math.min(discount, toMinor(coupon.maxDiscountAmount));
  }
  discount = Math.min(discount, base); // never more than the items cost

  if (discount <= 0) return { ok: false, reason: "NOT_APPLICABLE" };
  return { ok: true, discountMinor: discount, eligibleLineIds: eligible.map((l) => l.id) };
}