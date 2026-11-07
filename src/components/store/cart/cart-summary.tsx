"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, useTransition } from "react";
import { CouponBox } from "@/components/store/cart/coupon-box";
import { buttonVariants, Button } from "@/components/ui/button";
import { CHECKOUT_ENABLED } from "@/config/features";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { estimateShipping, type ShippingOption } from "@/server/cart/actions";
import type { CouponView } from "@/server/cart/service";
import type { ShippingRegion } from "@/server/queries/shipping";

export interface SummaryTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  /** Goods + tax - discount. Shipping is added on screen once a township is chosen. */
  total: number;
}

export function CartSummary({
  totals,
  coupon,
  tax,
  zones,
  hasIssues,
  itemCount,
}: {
  totals: SummaryTotals;
  coupon: CouponView | null;
  tax: { enabled: boolean; ratePercent: number; label: string };
  zones: ShippingRegion[];
  hasIssues: boolean;
  itemCount: number;
}) {
  const t = useTranslations("Cart");
  const [pending, startTransition] = useTransition();
  const [zoneId, setZoneId] = useState("");
  const [options, setOptions] = useState<ShippingOption[] | null>(null);
  const [chosen, setChosen] = useState<string>("");
  const [estimateError, setEstimateError] = useState(false);

  function pickZone(next: string) {
    setZoneId(next);
    setOptions(null);
    setChosen("");
    setEstimateError(false);
    if (!next) return;

    startTransition(async () => {
      const result = await estimateShipping(next);
      if (!result.ok) {
        setEstimateError(true);
        return;
      }
      setOptions(result.options);
      setChosen(result.options[0]?.code ?? "");
    });
  }

  const option = options?.find((o) => o.code === chosen) ?? null;
  const shippingFee = option?.fee ?? 0;
  // Display only. Checkout recalculates every number on the server.
  const total = totals.total + shippingFee;

  const row = "flex items-center justify-between gap-4 text-sm";

  return (
    <aside
      aria-labelledby="summary-title"
      className="space-y-6 rounded-xl border border-border bg-card p-6 lg:sticky lg:top-40"
    >
      <h2 id="summary-title" className="font-sans text-lg font-semibold">
        {t("summaryTitle")} <span className="font-normal text-muted-foreground">· {t("itemsCount", { count: itemCount })}</span>
      </h2>

      <CouponBox coupon={coupon} />

      <section aria-labelledby="estimate-title" className="space-y-3">
        <h3 id="estimate-title" className="font-sans text-sm font-semibold">
          {t("estimateTitle")}
        </h3>
        <label htmlFor="township" className="sr-only">
          {t("chooseTownship")}
        </label>
        <select
          id="township"
          value={zoneId}
          onChange={(e) => pickZone(e.target.value)}
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          <option value="">{t("chooseTownship")}</option>
          {zones.map((region) => (
            <optgroup key={region.region} label={region.region}>
              {region.townships.map((tw) => (
                <option key={tw.id} value={tw.id}>
                  {tw.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <div aria-live="polite" className="space-y-2">
          {pending && <p className="text-sm text-muted-foreground">…</p>}
          {estimateError && <p className="text-sm text-destructive">{t("estimateFailed")}</p>}
          {options && options.length === 0 && <p className="text-sm text-muted-foreground">{t("noMethods")}</p>}
          {options && options.length > 0 && (
            <ul className="space-y-2">
              {options.map((o) => (
                <li key={o.code}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm has-[:checked]:border-primary">
                    <input
                      type="radio"
                      name="shipping-method"
                      value={o.code}
                      checked={chosen === o.code}
                      onChange={() => setChosen(o.code)}
                      className="mt-1 accent-[var(--primary)]"
                    />
                    <span className="flex-1">
                      <span className="block font-medium">{o.name}</span>
                      <span className="block text-muted-foreground">
                        {o.etaMinDays === o.etaMaxDays
                          ? t("etaSame", { days: o.etaMinDays })
                          : t("eta", { min: o.etaMinDays, max: o.etaMaxDays })}
                        {o.codAvailable ? ` · ${t("codAvailable")}` : ""}
                      </span>
                    </span>
                    <span className="font-medium">{o.free ? t("shippingFree") : formatMoney(o.fee)}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <dl className="space-y-3 border-t border-border pt-4">
        <div className={row}>
          <dt>{t("subtotal")}</dt>
          <dd>{formatMoney(totals.subtotal)}</dd>
        </div>

        {totals.discountTotal > 0 && coupon?.status === "APPLIED" && (
          <div className={cn(row, "text-success")}>
            <dt>{t("discount", { code: coupon.code })}</dt>
            <dd>−{formatMoney(totals.discountTotal)}</dd>
          </div>
        )}

        <div className={row}>
          <dt>{t("shipping")}</dt>
          <dd>
            {option ? (option.free ? t("shippingFree") : formatMoney(option.fee)) : t("shippingAtCheckout")}
          </dd>
        </div>

        {tax.enabled && (
          <div className={row}>
            <dt>{t("tax", { label: tax.label, rate: tax.ratePercent })}</dt>
            <dd>{formatMoney(totals.taxTotal)}</dd>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 border-t border-border pt-4 text-lg font-semibold">
          <dt>{t("total")}</dt>
          <dd>{formatMoney(total)}</dd>
        </div>
      </dl>

      <p className="text-xs text-muted-foreground">{t("totalNote")}</p>

      <div className="space-y-2">
        {CHECKOUT_ENABLED && !hasIssues ? (
          <Link
            href="/checkout"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-12 w-full bg-primary text-primary-foreground hover:bg-primary-hover",
            )}
          >
            {t("checkout")}
          </Link>
        ) : (
          <Button type="button" size="lg" disabled className="h-12 w-full">
            {t("checkout")}
          </Button>
        )}
        {!CHECKOUT_ENABLED && <p className="text-sm text-muted-foreground">{t("checkoutSoon")}</p>}
        {CHECKOUT_ENABLED && hasIssues && <p className="text-sm text-destructive">{t("checkoutBlocked")}</p>}
      </div>
    </aside>
  );
}