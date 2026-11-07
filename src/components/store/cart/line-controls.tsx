"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { removeCartItem, setCartQuantity } from "@/server/cart/actions";

export function LineControls({
  itemId,
  name,
  quantity,
  max,
  canChange,
}: {
  itemId: string;
  name: string;
  quantity: number;
  max: number;
  canChange: boolean;
}) {
  const t = useTranslations("Cart");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error === "RATE_LIMITED" ? t("rateLimited") : t("actionFailed"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {canChange && (
          <div
            className="inline-flex items-center rounded-md border border-border"
            role="group"
            aria-label={t("quantityFor", { name })}
          >
            <button
              type="button"
              disabled={pending || quantity <= 1}
              onClick={() => run(() => setCartQuantity(itemId, quantity - 1))}
              aria-label={t("decrease")}
              className="inline-flex size-11 items-center justify-center disabled:opacity-40"
            >
              <Minus className="size-4" aria-hidden />
            </button>
            <span className="min-w-8 text-center text-sm font-medium" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              disabled={pending || quantity >= max}
              onClick={() => run(() => setCartQuantity(itemId, quantity + 1))}
              aria-label={t("increase")}
              className="inline-flex size-11 items-center justify-center disabled:opacity-40"
            >
              <Plus className="size-4" aria-hidden />
            </button>
          </div>
        )}

        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => removeCartItem(itemId))}
          aria-label={t("removeLabel", { name })}
          className="inline-flex h-11 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition hover:text-destructive disabled:opacity-40"
        >
          <Trash2 className="size-4" aria-hidden />
          {t("remove")}
        </button>
      </div>

      {canChange && quantity >= max && <p className="text-xs text-muted-foreground">{t("atMax")}</p>}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}