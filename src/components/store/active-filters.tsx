import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { AUDIENCE_LABEL_KEY } from "@/lib/audience";
import { clearFilters, hasActiveFilters, listingHref } from "@/lib/listing-url";
import { formatMoney } from "@/lib/money";
import type { Facets } from "@/server/catalog/types";
import type { ListingParams } from "@/validation/catalog";

export function ActiveFilters({
  basePath,
  params,
  facets,
}: {
  basePath: string;
  params: ListingParams;
  facets: Facets;
}) {
  const t = useTranslations("Catalog");
  if (!hasActiveFilters(params)) return null;

  const without = (overrides: Partial<ListingParams>) =>
    listingHref(basePath, params, { ...overrides, page: 1 });

  const chips: { key: string; label: string; href: string }[] = [];

  for (const slug of params.brand) {
    chips.push({
      key: `brand-${slug}`,
      label: facets.brands.find((b) => b.slug === slug)?.name ?? slug,
      href: without({ brand: params.brand.filter((b) => b !== slug) }),
    });
  }
  for (const value of params.audience) {
    chips.push({
      key: `audience-${value}`,
      label: t(AUDIENCE_LABEL_KEY[value]),
      href: without({ audience: params.audience.filter((a) => a !== value) }),
    });
  }
  for (const name of params.color) {
    chips.push({
      key: `color-${name}`,
      label: name,
      href: without({ color: params.color.filter((c) => c !== name) }),
    });
  }
  for (const name of params.size) {
    chips.push({
      key: `size-${name}`,
      label: `${t("size")}: ${name}`,
      href: without({ size: params.size.filter((s) => s !== name) }),
    });
  }
  if (params.min !== undefined || params.max !== undefined) {
    const label =
      params.min !== undefined && params.max !== undefined
        ? t("priceBetween", { min: formatMoney(params.min), max: formatMoney(params.max) })
        : params.min !== undefined
          ? t("priceFrom", { amount: formatMoney(params.min) })
          : t("priceUpTo", { amount: formatMoney(params.max ?? 0) });
    chips.push({ key: "price", label, href: without({ min: undefined, max: undefined }) });
  }
  if (params.inStock) {
    chips.push({ key: "stock", label: t("inStockOnly"), href: without({ inStock: false }) });
  }

  return (
    <div role="group" aria-label={t("activeFilters")} className="mb-6 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.href}
          aria-label={t("removeFilter", { name: chip.label })}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm transition hover:bg-secondary"
        >
          {chip.label}
          <X className="size-3.5" aria-hidden />
        </Link>
      ))}
      <Link href={without(clearFilters())} className="text-sm text-primary hover:underline">
        {t("clearAll")}
      </Link>
    </div>
  );
}