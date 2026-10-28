import { useFormatter, useTranslations } from "next-intl";
import { formatMoney } from "@/lib/money";

export function PriceBlock({
  price,
  compareAtPrice,
  onSale,
  percentOff,
  saleEndsAt,
}: {
  price: number;
  compareAtPrice: number | null;
  onSale: boolean;
  percentOff: number;
  saleEndsAt: string | null;
}) {
  const t = useTranslations("Product");
  const tc = useTranslations("Catalog");
  const format = useFormatter();

  return (
    <div className="space-y-2">
      <p className="flex flex-wrap items-baseline gap-3">
        <span className={`text-3xl font-semibold ${onSale ? "text-destructive" : ""}`}>
          {formatMoney(price)}
        </span>
        {compareAtPrice !== null && (
          <span className="text-lg text-muted-foreground line-through">
            {formatMoney(compareAtPrice)}
          </span>
        )}
        {onSale && (
          <span className="rounded-full bg-destructive px-2.5 py-1 text-xs font-semibold text-white">
            {tc("sale")} −{percentOff}%
          </span>
        )}
      </p>
      {onSale && saleEndsAt && (
        <p className="text-sm text-muted-foreground">
          {t("saleEnds", { date: format.dateTime(new Date(saleEndsAt), { dateStyle: "medium" }) })}
        </p>
      )}
    </div>
  );
}