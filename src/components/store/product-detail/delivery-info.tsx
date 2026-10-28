import { Banknote, RotateCcw, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { StoreInfo } from "@/server/queries/store-info";

export function DeliveryInfo({ info }: { info: StoreInfo }) {
  const t = useTranslations("Product");

  const { deliveryMinDays: min, deliveryMaxDays: max } = info;
  const delivery =
    min === null || max === null
      ? null
      : min === max
        ? t("deliveryExact", { days: min })
        : t("deliveryRange", { min, max });

  return (
    <section aria-labelledby="delivery-title" className="rounded-xl border border-border bg-card p-5">
      <h2 id="delivery-title" className="font-sans text-base font-semibold">
        {t("deliveryTitle")}
      </h2>
      <ul className="mt-4 space-y-3 text-sm">
        {delivery && (
          <li className="flex items-start gap-3">
            <Truck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {delivery}
          </li>
        )}
        {info.codAvailable && (
          <li className="flex items-start gap-3">
            <Banknote className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {t("codAvailable")}
          </li>
        )}
        <li className="flex items-start gap-3">
          <RotateCcw className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          {t("returnWindow", { days: info.returnWindowDays })}
        </li>
      </ul>
      <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href="/shipping-policy" className="text-primary hover:underline">
          {t("shippingPolicy")}
        </Link>
        <Link href="/return-policy" className="text-primary hover:underline">
          {t("returnPolicy")}
        </Link>
      </p>
    </section>
  );
}