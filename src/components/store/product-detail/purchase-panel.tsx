"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSelection } from "@/components/store/product-detail/selection-context";
import { Button } from "@/components/ui/button";
import { CART_ENABLED, MAX_QUANTITY_PER_LINE } from "@/config/features";
import { colorHasStock, findVariant } from "@/lib/variant-selection";
import { cn } from "@/lib/utils";

// Options named like this mean "this product has no real choice" and are not shown as pickers
const PLACEHOLDER_OPTIONS = new Set(["Default", "Free Size"]);

export function PurchasePanel() {
  const t = useTranslations("Product");
  const { variants, colors, sizes, color, size, selected, selectColor, selectSize } = useSelection();
  const [requestedQty, setRequestedQty] = useState(1);

  const max = selected ? Math.min(selected.available, MAX_QUANTITY_PER_LINE) : 0;
  const quantity = max === 0 ? 1 : Math.min(Math.max(1, requestedQty), max);
  const canBuy = CART_ENABLED && selected !== null && selected.available > 0;

  const showColors = !(colors.length === 1 && PLACEHOLDER_OPTIONS.has(colors[0]?.name ?? ""));
  const showSizes = !(sizes.length === 1 && PLACEHOLDER_OPTIONS.has(sizes[0] ?? ""));

  const stockText = !selected
    ? t("outOfStock")
    : selected.available === 0
      ? t("outOfStock")
      : selected.low
        ? t("onlyLeft", { count: selected.available })
        : t("inStock");
  const stockClass =
    !selected || selected.available === 0 || selected.low ? "text-destructive" : "text-success";

  return (
    <div className="space-y-6">
      {showColors && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t("colorLabel", { value: color })}</legend>
          <div className="flex flex-wrap gap-2.5">
            {colors.map((c) => {
              const inStock = colorHasStock(variants, c.name);
              const active = c.name === color;
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => selectColor(c.name)}
                  aria-pressed={active}
                  aria-label={inStock ? c.name : t("unavailableOption", { name: c.name })}
                  title={c.name}
                  className={cn(
                    "relative size-10 overflow-hidden rounded-full border-2 p-0.5 transition",
                    active ? "border-primary" : "border-border hover:border-muted-foreground",
                  )}
                >
                  <span
                    className="block size-full rounded-full border border-border"
                    style={{ backgroundColor: c.hex ?? "#E8E6DF" }}
                  />
                  {!inStock && (
                    <span
                      aria-hidden
                      className="absolute left-1/2 top-1/2 h-px w-[130%] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-foreground/70"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {showSizes && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{t("sizeLabel", { value: size })}</legend>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const variant = findVariant(variants, color, s);
              const exists = variant !== null;
              const inStock = (variant?.available ?? 0) > 0;
              const active = s === size;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={!exists}
                  onClick={() => selectSize(s)}
                  aria-pressed={active}
                  aria-label={inStock ? s : t("unavailableOption", { name: s })}
                  className={cn(
                    "h-11 min-w-12 rounded-md border px-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-40",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-muted-foreground",
                    exists && !inStock && !active && "text-muted-foreground line-through",
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="space-y-1 text-sm">
        <p className={cn("font-medium", stockClass)} aria-live="polite">
          {stockText}
        </p>
        {selected && <p className="text-muted-foreground">{t("sku", { sku: selected.sku })}</p>}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium" id="quantity-label">
          {t("quantity")}
        </p>
        <div className="inline-flex items-center rounded-md border border-border" role="group" aria-labelledby="quantity-label">
          <button
            type="button"
            onClick={() => setRequestedQty(Math.max(1, quantity - 1))}
            disabled={max === 0 || quantity <= 1}
            aria-label={t("decreaseQty")}
            className="inline-flex size-11 items-center justify-center disabled:opacity-40"
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <span className="min-w-10 text-center font-medium" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setRequestedQty(Math.min(max, quantity + 1))}
            disabled={max === 0 || quantity >= max}
            aria-label={t("increaseQty")}
            className="inline-flex size-11 items-center justify-center disabled:opacity-40"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
        {max > 0 && quantity === max && (
          <p className="mt-2 text-xs text-muted-foreground">{t("maxPerOrder", { count: max })}</p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          {/* Both buttons stay off until the cart exists (Step 4). They never fake an order. */}
          <Button
            type="button"
            disabled={!canBuy}
            className="h-12 flex-1 bg-primary text-primary-foreground hover:bg-primary-hover"
          >
            {t("addToCart")}
          </Button>
          <Button type="button" variant="outline" disabled={!canBuy} className="h-12 flex-1">
            {t("buyNow")}
          </Button>
        </div>
        {!CART_ENABLED && <p className="text-sm text-muted-foreground">{t("orderingSoon")}</p>}
      </div>
    </div>
  );
}