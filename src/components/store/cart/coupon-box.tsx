"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/money";
import { applyCoupon, removeCoupon } from "@/server/cart/actions";
import type { CouponView } from "@/server/cart/service";

const ERROR_KEY = {
  INVALID: "couponInvalid",
  USER_LIMIT: "couponUserLimit",
  NOT_APPLICABLE: "couponNotApplicable",
  EMPTY_CART: "couponEmpty",
  RATE_LIMITED: "couponRateLimited",
  FAILED: "couponFailed",
} as const;

export function CouponBox({ coupon }: { coupon: CouponView | null }) {
  const t = useTranslations("Cart");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await applyCoupon(code);
      if (result.ok) {
        setCode("");
      } else if (result.error === "MIN_ORDER") {
        setError(t("couponMinOrder", { amount: formatMoney(result.minOrder) }));
      } else {
        setError(t(ERROR_KEY[result.error]));
      }
      router.refresh();
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      await removeCoupon();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <h3 className="font-sans text-sm font-semibold">{t("couponTitle")}</h3>

      {coupon?.status === "APPLIED" && (
        <p
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-success/10 px-3 py-2 text-sm text-success"
        >
          <span>{t("couponApplied", { code: coupon.code, amount: formatMoney(coupon.discount) })}</span>
          <button type="button" onClick={remove} disabled={pending} className="font-medium underline">
            {t("couponRemove")}
          </button>
        </p>
      )}

      {coupon?.status === "INVALID" && (
        <p
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <span>{t("couponStale", { code: coupon.code })}</span>
          <button type="button" onClick={remove} disabled={pending} className="font-medium underline">
            {t("couponRemove")}
          </button>
        </p>
      )}

      {coupon?.status !== "APPLIED" && (
        <form onSubmit={submit} className="flex gap-2" noValidate>
          <label htmlFor="coupon-code" className="sr-only">
            {t("couponTitle")}
          </label>
          <Input
            id="coupon-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={60}
            autoComplete="off"
            autoCapitalize="characters"
            placeholder={t("couponPlaceholder")}
            className="h-11 flex-1 uppercase placeholder:normal-case"
          />
          <Button type="submit" disabled={pending} variant="outline" className="h-11">
            {pending ? t("couponApplying") : t("couponApply")}
          </Button>
        </form>
      )}

      <p role="alert" className="min-h-4 text-xs text-destructive">
        {error}
      </p>
    </div>
  );
}