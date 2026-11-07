import "dotenv/config";
import { MAX_QUANTITY_PER_LINE } from "../src/config/features";
import { consumeAttempt } from "../src/lib/db-rate-limit";
import { db } from "../src/lib/db";
import { TOKEN_PATTERN, hashToken, newToken } from "../src/lib/tokens";
import {
  addItem,
  findCartForRead,
  getOrCreateCart,
  loadCartView,
  mergeGuestIntoUser,
  reconcileCart,
  removeItem,
  setItemQuantity,
  countUnits,
} from "../src/server/cart/service";
import { priceCart, type PricingInput, type PricingLine } from "../src/server/pricing/cart-pricing";
import { evaluateCoupon, type CouponRules } from "../src/server/pricing/coupon";
import { allocate, toMinor } from "../src/server/pricing/money";
import { shippingFeeFor } from "../src/server/pricing/shipping";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const stamp = Date.now();
const PREFIX = `check-cart-${stamp}`;
let failed = false;

function report(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failed = true;
}

class Rollback extends Error {}

// ---------- helpers for the pure tests ----------
const rules = (over: Partial<CouponRules> = {}): CouponRules => ({
  code: "TEST", discountType: "PERCENTAGE", value: 10, maxDiscountAmount: null, minOrderAmount: null,
  usageLimit: null, usageLimitPerUser: null, usedCount: 0, excludeSaleItems: false,
  startsAt: null, expiresAt: null, isActive: true, productIds: [], categoryIds: [], ...over,
});

const line = (id: string, unit: number, qty: number, over: Partial<PricingLine> = {}): PricingLine => ({
  id, productId: `p-${id}`, categoryId: `c-${id}`, unitPrice: unit, regularPrice: unit,
  quantity: qty, isTaxable: true, ...over,
});

const price = (lines: PricingLine[], over: Partial<PricingInput> = {}) =>
  priceCart({
    lines, coupon: null, now: new Date(), tax: { enabled: false, ratePercent: 0 }, shippingFee: 0, ...over,
  });

const withCoupon = (r: CouponRules, userRedemptions: number | null = null) => ({ rules: r, userRedemptions });

/** The same rules the orders table enforces, in exact minor units. */
function identitiesHold(priced: ReturnType<typeof priceCart>): boolean {
  const m = priced.minor;
  const lineGross = priced.lines.reduce((s, l) => s + l.minor.gross, 0);
  const lineDiscount = priced.lines.reduce((s, l) => s + l.minor.discount, 0);
  const lineTax = priced.lines.reduce((s, l) => s + l.minor.tax, 0);
  return (
    m.subtotal === lineGross &&
    m.discountTotal === lineDiscount &&
    m.taxTotal === lineTax &&
    m.total === m.subtotal - m.discountTotal + m.shippingFee + m.taxTotal &&
    m.discountTotal <= m.subtotal &&
    priced.lines.every(
      (l) =>
        l.minor.net === l.minor.gross - l.minor.discount &&
        l.minor.discount >= 0 && l.minor.discount <= l.minor.gross &&
        l.minor.tax >= 0 && l.minor.net >= 0,
    )
  );
}

// A small deterministic random generator so a failure can be repeated
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

async function main() {
  // =====================================================================
  // Money maths (no database)
  // =====================================================================
  const split = allocate(100, [1, 1, 1]);
  report("A discount is shared so the parts add up exactly", split.reduce((a, b) => a + b, 0) === 100 && split.join() === "34,33,33");
  report("Nothing to share gives zeros", allocate(0, [5, 5]).join() === "0,0");

  const rand = rng(42);
  let allocationOk = true;
  for (let i = 0; i < 300; i++) {
    const weights = Array.from({ length: 1 + Math.floor(rand() * 6) }, () => 1 + Math.floor(rand() * 5_000_000));
    const total = Math.floor(rand() * weights.reduce((a, b) => a + b, 0));
    const parts = allocate(total, weights);
    if (parts.reduce((a, b) => a + b, 0) !== total || parts.some((p, i) => p < 0 || p > (weights[i] ?? 0))) allocationOk = false;
  }
  report("300 random splits: exact sum, never more than a line's value", allocationOk);

  const three = [line("a", 40000, 1), line("b", 25000, 2), line("c", 10000, 3)];
  const tenPercent = price(three, { coupon: withCoupon(rules()) });
  report(
    "10% off a 120,000 cart",
    tenPercent.subtotal === 120000 && tenPercent.discountTotal === 12000 && tenPercent.total === 108000 && identitiesHold(tenPercent),
  );

  const capped = price(three, { coupon: withCoupon(rules({ value: 50, maxDiscountAmount: 5000 })) });
  report("A percentage code respects its maximum", capped.discountTotal === 5000);

  const huge = price(three, { coupon: withCoupon(rules({ discountType: "FIXED_AMOUNT", value: 500000 })) });
  report("A fixed discount never makes the goods cost less than nothing", huge.discountTotal === 120000 && huge.total === 0 && identitiesHold(huge));

  const saleLine = line("s", 40000, 1, { regularPrice: 50000 });
  const noSale = price([saleLine, line("n", 20000, 1)], { coupon: withCoupon(rules({ excludeSaleItems: true })) });
  report("'Exclude sale items' leaves sale lines undiscounted", noSale.discountTotal === 2000 && noSale.lines[0]?.discount === 0);

  const byProduct = price(three, { coupon: withCoupon(rules({ productIds: ["p-b"] })) });
  report("A product restriction only discounts that product", byProduct.discountTotal === 5000 && byProduct.lines[0]?.discount === 0);
  const byCategory = price(three, { coupon: withCoupon(rules({ categoryIds: ["c-c"] })) });
  report("A category restriction only discounts that category", byCategory.discountTotal === 3000);
  const nothing = price(three, { coupon: withCoupon(rules({ productIds: ["p-zzz"] })) });
  report("A code that fits nothing in the cart is not applicable", nothing.coupon?.applied === false && nothing.coupon.reason === "NOT_APPLICABLE" && nothing.discountTotal === 0);

  const minOrder = price(three, { coupon: withCoupon(rules({ minOrderAmount: 200000 })) });
  report("Minimum order not reached", minOrder.coupon?.applied === false && minOrder.coupon.reason === "MIN_ORDER" && minOrder.coupon.minOrder === 200000);

  const ctx: { now: Date; userRedemptions: number | null } = { now: new Date(), userRedemptions: null };
  const lines1 = [{ id: "a", productId: "p", categoryId: "c", grossMinor: 10000, onSale: false }];
  const failure = (over: Partial<CouponRules>, c = ctx) => {
    const r = evaluateCoupon(rules(over), lines1, c);
    return r.ok ? "OK" : r.reason;
  };
  report("Inactive code", failure({ isActive: false }) === "INACTIVE");
  report("Code that has not started", failure({ startsAt: new Date(Date.now() + 86_400_000) }) === "NOT_STARTED");
  report("Expired code", failure({ expiresAt: new Date(Date.now() - 1000) }) === "EXPIRED");
  report("Used-up code", failure({ usageLimit: 5, usedCount: 5 }) === "USAGE_LIMIT");
  report("A customer who used it up", failure({ usageLimitPerUser: 1 }, { now: new Date(), userRedemptions: 1 }) === "USER_LIMIT");
  report("A guest is not blocked by the per-customer limit (checked again at checkout)", failure({ usageLimitPerUser: 1 }) === "OK");

  const taxed = price([line("t", 100000, 1), line("u", 20000, 1, { isTaxable: false })], {
    coupon: withCoupon(rules()), tax: { enabled: true, ratePercent: 5 }, shippingFee: 3500,
  });
  report(
    "Tax applies to taxable goods after the discount, and not to shipping",
    taxed.taxTotal === 4500 && taxed.total === 120000 - 12000 + 3500 + 4500 && identitiesHold(taxed),
    `tax ${taxed.taxTotal}, total ${taxed.total}`,
  );

  const exact = price([line("d", 33333.33, 3)]);
    report("Decimal prices stay exact (no floating point noise)", exact.minor.subtotal === 9999999 && exact.minor.total === 9999999);

  report(
    "Free shipping is judged on the goods after the discount",
    !shippingFeeFor({ fee: 2500, freeShippingOver: 80000 }, 79999).free &&
      shippingFeeFor({ fee: 2500, freeShippingOver: 80000 }, 80000).free &&
      shippingFeeFor({ fee: 2500, freeShippingOver: null }, 999999).fee === 2500,
  );

  let randomOk = true;
  let failures = 0;
  for (let i = 0; i < 400; i++) {
    const count = 1 + Math.floor(rand() * 5);
    const ls = Array.from({ length: count }, (_, k) => {
      const unit = Math.round((500 + rand() * 90000) * 100) / 100;
      const sale = rand() < 0.3;
      return line(`r${k}`, unit, 1 + Math.floor(rand() * 10), { regularPrice: sale ? unit * 1.25 : unit, isTaxable: rand() < 0.8 });
    });
    const coupon =
      rand() < 0.7
        ? withCoupon(rules({
            discountType: rand() < 0.5 ? "PERCENTAGE" : "FIXED_AMOUNT",
            value: rand() < 0.5 ? Math.round(rand() * 100) : Math.round(rand() * 80000),
            maxDiscountAmount: rand() < 0.3 ? 5000 : null,
            excludeSaleItems: rand() < 0.3,
          }))
        : null;
    const p = price(ls, { coupon, tax: { enabled: rand() < 0.6, ratePercent: [5, 7.5, 0][Math.floor(rand() * 3)] ?? 5 }, shippingFee: Math.round(rand() * 5000) });
    if (!identitiesHold(p)) { randomOk = false; failures++; }
  }
  report("400 random carts: every total identity holds exactly", randomOk, failures ? `${failures} failed` : "");

  // =====================================================================
  // The pricing result is accepted by the real database rules
  // =====================================================================
  const user1 = await db.user.create({ data: { id: `${PREFIX}-u1`, name: "Cart One", email: `${PREFIX}-u1@example.test`, emailVerified: true } });
  const user2 = await db.user.create({ data: { id: `${PREFIX}-u2`, name: "Cart Two", email: `${PREFIX}-u2@example.test`, emailVerified: true } });

  const orderBase = (key: string, userId?: string) => ({
    orderNumber: `${PREFIX}-${key}`.toUpperCase(), idempotencyKey: `${PREFIX}-idem-${key}`, userId: userId ?? null,
    paymentMethod: "COD" as const, customerName: "T", customerPhone: "+959000000000",
    shipRecipientName: "T", shipPhone: "+959000000000", shipRegion: "Yangon Region", shipTownship: "Bahan",
    shipAddressLine: "1 Test Street", shippingMethodCode: "check", shippingMethodName: "Check",
  });

  const sample = price(
    [line("o1", 33333.33, 3), line("o2", 12500, 2, { isTaxable: false }), line("o3", 7777.77, 5)],
    { coupon: withCoupon(rules({ value: 15, maxDiscountAmount: 7000 })), tax: { enabled: true, ratePercent: 5 }, shippingFee: 3500 },
  );
  let accepted = true;
  try {
    await db.$transaction(async (tx) => {
      await tx.order.create({
        data: {
          ...orderBase("pricing"),
          subtotal: sample.subtotal.toFixed(2), discountTotal: sample.discountTotal.toFixed(2),
          shippingFee: sample.shippingFee.toFixed(2), taxTotal: sample.taxTotal.toFixed(2), total: sample.total.toFixed(2),
          items: {
            create: sample.lines.map((l, i) => ({
              productName: `Line ${i}`, sku: `CHECK-${i}`, size: "M", color: "Black",
              unitPrice: l.unitPrice.toFixed(2), quantity: l.quantity,
              discountAmount: l.discount.toFixed(2), taxAmount: l.tax.toFixed(2), lineTotal: l.net.toFixed(2),
            })),
          },
        },
      });
      throw new Rollback();
    });
  } catch (error) {
    accepted = error instanceof Rollback;
  }
  report("An order built from the pricing engine passes every database rule", accepted);

  // =====================================================================
  // The cart service (temporary products)
  // =====================================================================
  const cat = await db.category.create({ data: { name: "Check Cart", slug: PREFIX } });
  const carts: string[] = [];

  const mk = (key: string, over: Record<string, unknown> = {}, variantOver: Record<string, unknown> = {}) =>
    db.product.create({
      data: {
        slug: `${PREFIX}-${key}`, name: `Cart ${key}`, categoryId: cat.id, status: "ACTIVE", publishedAt: new Date(), price: 40000,
        variants: { create: [{ sku: `${PREFIX}-${key}`.toUpperCase(), size: "M", color: "Black", stockOnHand: 50, ...variantOver }] },
        ...over,
      } as Parameters<typeof db.product.create>[0]["data"],
      include: { variants: true },
    });

  try {
    const pA = await mk("a"); // plenty of stock
    const pB = await mk("b", {}, { stockOnHand: 3 });
    const pC = await mk("c", {}, { stockOnHand: 0 });
    const pD = await mk("d", { status: "DRAFT" });
    const pE = await mk("e", {}, { isActive: false });
    const pF = await mk("f", { salePrice: 30000 });
    const vA = pA.variants[0]!.id, vB = pB.variants[0]!.id, vC = pC.variants[0]!.id;
    const vD = pD.variants[0]!.id, vE = pE.variants[0]!.id, vF = pF.variants[0]!.id;

    // ----- Guest cart token -----
    const token = newToken();
    const guestCart = await getOrCreateCart({ guestToken: token });
    carts.push(guestCart.id);
    const row = await db.cart.findUnique({ where: { id: guestCart.id } });
    report("A guest token is 43 random characters", TOKEN_PATTERN.test(token));
    report(
      "Only the HASH of the token is stored, and the cart expires in about 30 days",
      row?.guestTokenHash === hashToken(token) && row.guestTokenHash !== token &&
        row.expiresAt !== null && Math.abs(row.expiresAt.getTime() - (Date.now() + 30 * 86_400_000)) < 120_000,
    );
    report("Asking again returns the same cart", (await getOrCreateCart({ guestToken: token })).id === guestCart.id);
    report("A different token cannot see this cart", (await findCartForRead({ guestToken: newToken() })) === null);

    // ----- Adding -----
    const a1 = await addItem(guestCart.id, vA, 2);
    const a2 = await addItem(guestCart.id, vA, 3);
    report("Adding twice accumulates", a1.ok && a2.ok && a2.quantity === 5 && a2.added === 3);

    const aMax = await addItem(guestCart.id, vA, 9);
    report(`A line is capped at ${MAX_QUANTITY_PER_LINE} even with 50 in stock`, aMax.ok && aMax.quantity === MAX_QUANTITY_PER_LINE && aMax.capped);
    const aAgain = await addItem(guestCart.id, vA, 1);
    report("Adding more to a full line says so", !aAgain.ok && aAgain.error === "AT_LIMIT");

    const bAll = await addItem(guestCart.id, vB, 5);
    report("A line is capped at the stock available (3)", bAll.ok && bAll.quantity === 3 && bAll.capped);

    const c1 = await addItem(guestCart.id, vC, 1);
    report("A sold-out variant cannot be added", !c1.ok && c1.error === "OUT_OF_STOCK");
    const d1 = await addItem(guestCart.id, vD, 1);
    report("A draft product cannot be added", !d1.ok && d1.error === "NOT_FOUND");
    const e1 = await addItem(guestCart.id, vE, 1);
    report("An inactive variant cannot be added", !e1.ok && e1.error === "NOT_FOUND");
    const x1 = await addItem(guestCart.id, "does-not-exist", 1);
    report("An unknown variant cannot be added", !x1.ok && x1.error === "NOT_FOUND");

    // Reserved stock is not available
    const pG = await mk("g", {}, { stockOnHand: 6, stockReserved: 4 });
    const g1 = await addItem(guestCart.id, pG.variants[0]!.id, 5);
    report("Reserved units are not available", g1.ok && g1.quantity === 2);

    // ----- Ownership -----
    const otherCart = await getOrCreateCart({ userId: user1.id });
    carts.push(otherCart.id);
    const myItem = await db.cartItem.findFirst({ where: { cartId: guestCart.id, variantId: vA }, select: { id: true } });
    const stolen = await setItemQuantity(otherCart.id, myItem!.id, 1);
    await removeItem(otherCart.id, myItem!.id);
    const stillThere = await db.cartItem.findUnique({ where: { id: myItem!.id }, select: { quantity: true } });
    report("An item id from another cart is 'not found' and is left untouched", !stolen.ok && stolen.error === "NOT_FOUND" && stillThere?.quantity === MAX_QUANTITY_PER_LINE);

    // ----- Changing quantities -----
    const set = await setItemQuantity(guestCart.id, myItem!.id, 4);
    report("Setting a quantity works", set.ok && set.quantity === 4);
    const over = await setItemQuantity(guestCart.id, myItem!.id, 99);
    report("Setting more than allowed is lowered to the cap", over.ok && over.quantity === MAX_QUANTITY_PER_LINE && over.capped);
    await removeItem(guestCart.id, myItem!.id);
    await removeItem(guestCart.id, myItem!.id);
    report("Removing a line works, and twice is harmless", (await db.cartItem.count({ where: { id: myItem!.id } })) === 0);

    // ----- The cart view -----
    const viewCart = await getOrCreateCart({ userId: user2.id });
    carts.push(viewCart.id);
    await addItem(viewCart.id, vA, 2);
    await addItem(viewCart.id, vF, 1);
    let view = await loadCartView(viewCart.id, { locale: "en", userId: user2.id });
    const fLine = view.lines.find((l) => l.productId === pF.id);
    report(
      "The cart view uses current prices (including a sale) and exact totals",
      view.priced.subtotal === 2 * 40000 + 30000 && fLine?.onSale === true && fLine.unitPrice === 30000 && !view.hasIssues,
      `subtotal ${view.priced.subtotal}`,
    );
    report("The header count is the number of units", (await countUnits(viewCart.id)) === 3);

    // Price change shows immediately
    await db.product.update({ where: { id: pA.id }, data: { price: 45000 } });
    view = await loadCartView(viewCart.id, { locale: "en", userId: user2.id });
    report("A price change shows up immediately", view.priced.subtotal === 2 * 45000 + 30000);

    // ----- Stock changes after adding -----
    const stockCart = await getOrCreateCart({ guestToken: newToken() });
    carts.push(stockCart.id);
    await addItem(stockCart.id, vB, 3);
    await db.productVariant.update({ where: { id: vB }, data: { stockOnHand: 1 } });
    view = await loadCartView(stockCart.id, { locale: "en", userId: null });
    const reducedLine = view.lines[0];
    report(
      "Stock fell: the line is flagged and only the available quantity is charged",
      reducedLine?.issue === "REDUCED" && reducedLine.effectiveQuantity === 1 && view.priced.subtotal === 40000 && view.hasIssues,
    );
    const fixed = await reconcileCart(stockCart.id);
    view = await loadCartView(stockCart.id, { locale: "en", userId: null });
    report("'Update cart' lowers the quantity to the stock", fixed.reduced === 1 && view.lines[0]?.quantity === 1 && !view.hasIssues);

    await db.productVariant.update({ where: { id: vB }, data: { isActive: false } });
    view = await loadCartView(stockCart.id, { locale: "en", userId: null });
    report("A variant that stops being sold is 'unavailable' and costs nothing", view.lines[0]?.issue === "UNAVAILABLE" && view.priced.subtotal === 0);
    const removed = await reconcileCart(stockCart.id);
    report("'Update cart' removes it", removed.removed === 1 && (await countUnits(stockCart.id)) === 0);

    await db.productVariant.update({ where: { id: vB }, data: { isActive: true, stockOnHand: 3 } });
    await addItem(stockCart.id, vB, 1);
    await db.product.update({ where: { id: pB.id }, data: { status: "DRAFT" } });
    view = await loadCartView(stockCart.id, { locale: "en", userId: null });
    report("A product that is taken off sale is 'unavailable'", view.lines[0]?.issue === "UNAVAILABLE");
    await db.product.update({ where: { id: pB.id }, data: { status: "ACTIVE" } });

    // ----- Coupons against the database -----
    const code = `CHECKC${stamp}`;
    const coupon = await db.coupon.create({ data: { code, discountType: "PERCENTAGE", value: 10, usageLimit: 5, usageLimitPerUser: 1 } });
    view = await loadCartView(viewCart.id, { locale: "en", userId: user2.id, couponOverride: code.toLowerCase() });
    report("A code is accepted in any letter case and gives the right discount", view.coupon?.status === "APPLIED" && view.priced.discountTotal === 12000, `${view.priced.discountTotal}`);

    view = await loadCartView(viewCart.id, { locale: "en", userId: user2.id, couponOverride: "NOSUCHCODE" });
    report("An unknown code is just 'invalid'", view.coupon?.status === "INVALID" && view.coupon.reason === "INVALID" && view.priced.discountTotal === 0);

    view = await loadCartView(viewCart.id, { locale: "en", userId: user2.id, couponOverride: "bad code!" });
    report("A malformed code is 'invalid' without touching the database", view.coupon?.status === "INVALID" && view.coupon.reason === "INVALID");

    await db.coupon.update({ where: { id: coupon.id }, data: { usedCount: 5 } });
    view = await loadCartView(viewCart.id, { locale: "en", userId: user2.id, couponOverride: code });
    report("A used-up code looks exactly like an invalid one", view.coupon?.status === "INVALID" && view.coupon.reason === "INVALID");
    await db.coupon.update({ where: { id: coupon.id }, data: { usedCount: 0 } });

    const redemptionOrder = await db.order.create({
      data: { ...orderBase("redeemed", user1.id), subtotal: "1000", total: "900", discountTotal: "100" },
    });
    await db.couponRedemption.create({
      data: { couponId: coupon.id, orderId: redemptionOrder.id, userId: user1.id, customerPhone: "+959000000000", discountAmount: "100" },
    });
    const view1 = await loadCartView(viewCart.id, { locale: "en", userId: user1.id, couponOverride: code });
    const view2 = await loadCartView(viewCart.id, { locale: "en", userId: user2.id, couponOverride: code });
    const viewGuest = await loadCartView(viewCart.id, { locale: "en", userId: null, couponOverride: code });
    report(
      "The per-customer limit blocks only the customer who used it",
      view1.coupon?.status === "INVALID" && view1.coupon.reason === "USER_LIMIT" && view2.coupon?.status === "APPLIED" && viewGuest.coupon?.status === "APPLIED",
    );

    await db.coupon.update({ where: { id: coupon.id }, data: { minOrderAmount: 500000 } });
    view = await loadCartView(viewCart.id, { locale: "en", userId: user2.id, couponOverride: code });
    report("A minimum order is reported with the amount", view.coupon?.status === "INVALID" && view.coupon.reason === "MIN_ORDER" && view.coupon.minOrder === 500000);

    await db.cart.update({ where: { id: viewCart.id }, data: { couponCode: "GONE" } });
    view = await loadCartView(viewCart.id, { locale: "en", userId: user2.id });
    report("A stored code that no longer exists gives no discount and a warning", view.coupon?.status === "INVALID" && view.priced.discountTotal === 0);
    await db.cart.update({ where: { id: viewCart.id }, data: { couponCode: null } });

    // ----- Merge after sign-in -----
    const mergeUser = await db.user.create({ data: { id: `${PREFIX}-u3`, name: "Merge", email: `${PREFIX}-u3@example.test`, emailVerified: true } });
    const guestToken = newToken();
    const gCart = await getOrCreateCart({ guestToken });
    await addItem(gCart.id, vA, 8);
    await addItem(gCart.id, vF, 2);
    await db.cart.update({ where: { id: gCart.id }, data: { couponCode: "GUESTCODE" } });

    const uCart = await getOrCreateCart({ userId: mergeUser.id });
    carts.push(uCart.id);
    await addItem(uCart.id, vA, 5);

    const merged = await mergeGuestIntoUser(mergeUser.id, guestToken);
    const afterA = await db.cartItem.findUnique({ where: { cartId_variantId: { cartId: uCart.id, variantId: vA } } });
    const afterF = await db.cartItem.findUnique({ where: { cartId_variantId: { cartId: uCart.id, variantId: vF } } });
    const afterCart = await db.cart.findUnique({ where: { id: uCart.id } });
    report(
      "Merge adds quantities (capped), brings new items, and keeps the coupon when there was none",
      merged.merged === 2 && afterA?.quantity === MAX_QUANTITY_PER_LINE && afterF?.quantity === 2 && afterCart?.couponCode === "GUESTCODE",
    );
    report("The guest cart is gone after the merge", (await db.cart.findUnique({ where: { id: gCart.id } })) === null);
    report("A second merge (another tab) does nothing and does not double-count", (await mergeGuestIntoUser(mergeUser.id, guestToken)).merged === 0 && (await db.cartItem.findUnique({ where: { cartId_variantId: { cartId: uCart.id, variantId: vF } } }))?.quantity === 2);

    const t2 = newToken();
    const g2 = await getOrCreateCart({ guestToken: t2 });
    await addItem(g2.id, vF, 1);
    await db.cart.update({ where: { id: g2.id }, data: { couponCode: "OTHER" } });
    await mergeGuestIntoUser(mergeUser.id, t2);
    report("The signed-in cart's own coupon wins", (await db.cart.findUnique({ where: { id: uCart.id } }))?.couponCode === "GUESTCODE");

    const t3 = newToken();
    const g3 = await getOrCreateCart({ guestToken: t3 });
    await addItem(g3.id, vF, 1);
    await db.cart.update({ where: { id: g3.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const before = await countUnits(uCart.id);
    report("An expired guest cart is not merged", (await mergeGuestIntoUser(mergeUser.id, t3)).merged === 0 && (await countUnits(uCart.id)) === before);

    // ----- Expiry -----
    const t4 = newToken();
    const g4 = await getOrCreateCart({ guestToken: t4 });
    carts.push(g4.id);
    await addItem(g4.id, vA, 1);
    await db.cart.update({ where: { id: g4.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    report("An expired guest cart is invisible", (await findCartForRead({ guestToken: t4 })) === null);
    const reborn = await getOrCreateCart({ guestToken: t4 });
    report("Using an expired token starts an empty cart again", reborn.id === g4.id && (await countUnits(g4.id)) === 0);

    // ----- Attempt limiter -----
    const key = `${PREFIX}-limit`;
    const t0 = Date.now();
    const results = [
      await consumeAttempt(key, 3, 1000, t0),
      await consumeAttempt(key, 3, 1000, t0),
      await consumeAttempt(key, 3, 1000, t0),
      await consumeAttempt(key, 3, 1000, t0),
    ];
    const later = await consumeAttempt(key, 3, 1000, t0 + 1001);
    report("The shared attempt limiter allows 3, blocks the 4th, and resets after the window", results.join() === "true,true,true,false" && later);
    await db.rateLimit.deleteMany({ where: { key } });

    // =====================================================================
    // The real pages (needs the dev server and sample data)
    // =====================================================================
    try {
      const get = (path: string) => fetch(`${BASE}${path}`, { redirect: "manual", headers: { "x-forwarded-for": "203.0.113.9" } });

      const empty = await get("/cart");
      const emptyHtml = await empty.text();
      report("An empty cart page opens", empty.status === 200 && /<h1[^>]*>\s*Your cart is empty\s*<\/h1>/.test(emptyHtml), `status ${empty.status}`);
      report("The cart page is not indexed", /<meta[^>]*name="robots"[^>]*noindex/.test(emptyHtml));

      const product = await get("/products/sample-linen-shirt");
      const html = await product.text();
      const buttons = [...html.matchAll(/<button\b([^>]*)>((?:(?!<\/button>)[\s\S])*)<\/button>/g)];
      const addButton = buttons.find((m) => /Add to cart/.test(m[2] ?? ""));
      // A real HTML attribute, not a "disabled:" word inside the class list
      const isDisabled = (attributes: string) => /(?:^|\s)disabled(?:=|\s|$)/.test(attributes);

      report(
        "On a product page, 'Add to cart' is enabled",
        Boolean(addButton) && !isDisabled(addButton?.[1] ?? ""),
        !addButton
          ? `button not found, status ${product.status}`
          : html.includes("Online ordering is being set up")
            ? "the page still says ordering is closed: check CART_ENABLED in src/config/features.ts"
            : "",
      );
    } catch {
      console.log("ℹ️  Dev server not reachable. Skipped the page checks.");
    }
  } finally {
    await db.cart.deleteMany({ where: { id: { in: carts } } });
    await db.cart.deleteMany({ where: { userId: { startsWith: PREFIX } } });
    await db.order.deleteMany({ where: { orderNumber: { startsWith: PREFIX.toUpperCase() } } });
    await db.coupon.deleteMany({ where: { code: { startsWith: "CHECKC" } } });
    await db.product.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await db.category.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await db.user.deleteMany({ where: { id: { startsWith: PREFIX } } });
  }

  const left =
    (await db.product.count({ where: { slug: { startsWith: PREFIX } } })) +
    (await db.user.count({ where: { id: { startsWith: PREFIX } } })) +
    (await db.order.count({ where: { orderNumber: { startsWith: PREFIX.toUpperCase() } } }));
  report("No test data left behind", left === 0);
}

main()
  .catch((err) => {
    console.error(err);
    failed = true;
  })
  .finally(async () => {
    await db.$disconnect();
    process.exit(failed ? 1 : 0);
  });