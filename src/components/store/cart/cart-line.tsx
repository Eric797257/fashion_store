import { useTranslations } from "next-intl";
import Link from "next/link";
import { LineControls } from "@/components/store/cart/line-controls";
import { ProductImage } from "@/components/store/product-image";
import { MAX_QUANTITY_PER_LINE } from "@/config/features";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CartLineView } from "@/server/cart/service";

const PLACEHOLDER = new Set(["Default", "Free Size"]);

export function CartLine({ line, lineTotal }: { line: CartLineView; lineTotal: number }) {
  const t = useTranslations("Cart");

  const options = [line.color, line.size].filter((v) => !PLACEHOLDER.has(v)).join(" / ");
  const unavailable = line.issue === "UNAVAILABLE" || line.issue === "OUT_OF_STOCK";
  const max = Math.min(line.available, MAX_QUANTITY_PER_LINE);
  const unitDiffers = line.onSale;

  return (
    <li
      className={cn(
        "flex gap-4 py-6 first:pt-0",
        unavailable && "opacity-90",
      )}
    >
      <Link
        href={`/products/${line.slug}`}
        className="relative block aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-lg bg-secondary sm:w-28"
      >
        <ProductImage
          image={line.imageUrl ? { url: line.imageUrl, alt: line.imageAlt } : null}
          sizes="112px"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link href={`/products/${line.slug}`} className="line-clamp-2 font-medium hover:text-primary">
              {line.name}
            </Link>
            {options && <p className="mt-1 text-sm text-muted-foreground">{options}</p>}
            <p className="mt-1 text-sm text-muted-foreground">
              <span className={unitDiffers ? "text-destructive" : ""}>
                {t("each", { price: formatMoney(line.unitPrice) })}
              </span>
              {unitDiffers && (
                <span className="ml-2 line-through">{formatMoney(line.regularPrice)}</span>
              )}
            </p>
          </div>
          <p className="shrink-0 font-semibold">{unavailable ? "—" : formatMoney(lineTotal)}</p>
        </div>

        {line.issue && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {line.issue === "UNAVAILABLE" && t("unavailable")}
            {line.issue === "OUT_OF_STOCK" && t("outOfStock")}
            {line.issue === "REDUCED" && t("reduced", { available: line.available })}
          </p>
        )}

        <LineControls
          itemId={line.itemId}
          name={line.name}
          quantity={line.effectiveQuantity}
          max={max}
          canChange={!unavailable}
        />
      </div>
    </li>
  );
}