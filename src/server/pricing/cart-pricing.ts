import { evaluateCoupon, type CouponFailure, type CouponRules } from "./coupon";
import { allocate, fromMinor, toMinor } from "./money";

export interface PricingLine {
  id: string;
  productId: string;
  categoryId: string;
  /** What the customer pays per unit right now (sale price when a sale is active). */
  unitPrice: number;
  /** The regular price. Higher than unitPrice while a sale is active. */
  regularPrice: number;
  quantity: number;
  isTaxable: boolean;
}

export interface PricingInput {
  lines: PricingLine[];
  coupon: { rules: CouponRules; userRedemptions: number | null } | null;
  now: Date;
  tax: { enabled: boolean; ratePercent: number };
  shippingFee: number;
}

export interface PricedLine {
  id: string;
  quantity: number;
  unitPrice: number;
  gross: number;
  discount: number;
  net: number;
  tax: number;
  minor: { unit: number; gross: number; discount: number; net: number; tax: number };
}

export interface PricedCart {
  lines: PricedLine[];
  subtotal: number;
  discountTotal: number;
  shippingFee: number;
  taxTotal: number;
  total: number;
  /** Exact whole-unit amounts. These satisfy the same rules as the orders table. */
  minor: { subtotal: number; discountTotal: number; shippingFee: number; taxTotal: number; total: number };
  coupon:
    | { code: string; applied: true; discount: number }
    | { code: string; applied: false; reason: CouponFailure; minOrder: number | null }
    | null;
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export function priceCart(input: PricingInput): PricedCart {
  const base = input.lines.map((line) => {
    const unit = toMinor(line.unitPrice);
    return { line, unit, gross: unit * line.quantity };
  });
  const subtotal = sum(base.map((b) => b.gross));

  let discountTotal = 0;
  let eligible = new Set<string>();
  let coupon: PricedCart["coupon"] = null;

  if (input.coupon) {
    const { rules, userRedemptions } = input.coupon;
    const result = evaluateCoupon(
      rules,
      base.map((b) => ({
        id: b.line.id,
        productId: b.line.productId,
        categoryId: b.line.categoryId,
        grossMinor: b.gross,
        onSale: b.unit < toMinor(b.line.regularPrice),
      })),
      { now: input.now, userRedemptions },
    );

    if (result.ok) {
      discountTotal = result.discountMinor;
      eligible = new Set(result.eligibleLineIds);
      coupon = { code: rules.code, applied: true, discount: fromMinor(discountTotal) };
    } else {
      coupon = {
        code: rules.code,
        applied: false,
        reason: result.reason,
        minOrder: result.minOrderMinor !== undefined ? fromMinor(result.minOrderMinor) : null,
      };
    }
  }

  // The discount is shared across the eligible lines in proportion to their value
  const shares = allocate(
    discountTotal,
    base.map((b) => (eligible.has(b.line.id) ? b.gross : 0)),
  );

  const lines: PricedLine[] = base.map((b, i) => {
    const discount = shares[i] ?? 0;
    const net = b.gross - discount;
    const tax =
      input.tax.enabled && b.line.isTaxable
        ? Math.round((net * input.tax.ratePercent) / 100)
        : 0;
    return {
      id: b.line.id,
      quantity: b.line.quantity,
      unitPrice: fromMinor(b.unit),
      gross: fromMinor(b.gross),
      discount: fromMinor(discount),
      net: fromMinor(net),
      tax: fromMinor(tax),
      minor: { unit: b.unit, gross: b.gross, discount, net, tax },
    };
  });

  const taxTotal = sum(lines.map((l) => l.minor.tax));
  const shipping = toMinor(input.shippingFee);
  const total = subtotal - discountTotal + shipping + taxTotal;

  return {
    lines,
    subtotal: fromMinor(subtotal),
    discountTotal: fromMinor(discountTotal),
    shippingFee: fromMinor(shipping),
    taxTotal: fromMinor(taxTotal),
    total: fromMinor(total),
    minor: { subtotal, discountTotal, shippingFee: shipping, taxTotal, total },
    coupon,
  };
}