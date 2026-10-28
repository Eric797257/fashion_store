import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AUDIENCE_LABEL_KEY } from "@/lib/audience";
import { clearFilters, hasActiveFilters, listingHref } from "@/lib/listing-url";
import { cn } from "@/lib/utils";
import type { Facets } from "@/server/catalog/types";
import type { CategoryTreeNode } from "@/server/queries/categories";
import { defaultSort, type ListingParams } from "@/validation/catalog";

/** Keeps a selected option visible even when the current results contain none of it. */
function mergeSelected<T>(
  items: T[],
  selected: string[],
  nameOf: (item: T) => string,
  make: (name: string) => T,
): T[] {
  const have = new Set(items.map((i) => nameOf(i).toLowerCase()));
  return [...items, ...selected.filter((s) => !have.has(s.toLowerCase())).map(make)];
}

const isSelected = (selected: string[], name: string) =>
  selected.some((s) => s.toLowerCase() === name.toLowerCase());

const headingClass = "font-sans text-sm font-semibold uppercase tracking-wide";
const inputClass =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function FacetGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details open className="group border-t border-border pt-4">
      <summary
        className={cn(
          headingClass,
          "flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden",
        )}
      >
        {title}
        <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

export function ListingFilters({
  basePath,
  params,
  tree,
  activeSlug,
  facets,
}: {
  basePath: string;
  params: ListingParams;
  tree: CategoryTreeNode[];
  activeSlug: string | null;
  facets: Facets;
}) {
  const t = useTranslations("Catalog");

  const brands = mergeSelected(facets.brands, params.brand, (b) => b.slug, (slug) => ({ slug, name: slug, count: 0 }));
  const colors = mergeSelected(facets.colors, params.color, (c) => c.name, (name) => ({ name, hex: null, count: 0 }));
  const sizes = mergeSelected(facets.sizes, params.size, (s) => s.name, (name) => ({ name, count: 0 }));
  const audiences = facets.audiences.map((a) => ({ ...a }));
  for (const selected of params.audience) {
    if (!audiences.some((a) => a.value === selected)) audiences.push({ value: selected, count: 0 });
  }

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-secondary",
      active ? "bg-secondary font-medium text-primary" : "text-foreground",
    );

  return (
    <div className="space-y-6">
      <nav aria-label={t("categories")}>
        <h2 className={cn(headingClass, "mb-3")}>{t("categories")}</h2>
        <ul className="space-y-0.5 text-sm">
          <li>
            <Link
              href={listingHref("/products", params, { page: 1 })}
              className={linkClass(activeSlug === null)}
              aria-current={activeSlug === null ? "page" : undefined}
            >
              {t("allProducts")}
            </Link>
          </li>
          {tree.map((parent) => (
            <li key={parent.id}>
              <Link
                href={listingHref(`/categories/${parent.slug}`, params, { page: 1 })}
                className={linkClass(activeSlug === parent.slug)}
                aria-current={activeSlug === parent.slug ? "page" : undefined}
              >
                <span>{parent.name}</span>
                <span className="text-muted-foreground">{parent.count}</span>
              </Link>
              {parent.children.length > 0 && (
                <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-2">
                  {parent.children.map((child) => (
                    <li key={child.id}>
                      <Link
                        href={listingHref(`/categories/${child.slug}`, params, { page: 1 })}
                        className={linkClass(activeSlug === child.slug)}
                        aria-current={activeSlug === child.slug ? "page" : undefined}
                      >
                        <span>{child.name}</span>
                        <span className="text-muted-foreground">{child.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* A plain GET form: every choice becomes a URL parameter and works without JavaScript */}
      <form action={basePath} method="get" className="space-y-4">
        {params.q && <input type="hidden" name="q" value={params.q} />}
        {params.sort !== defaultSort(params.q) && <input type="hidden" name="sort" value={params.sort} />}

        {audiences.length > 0 && (
          <FacetGroup title={t("audience")}>
            <ul className="space-y-1.5">
              {audiences.map((a) => (
                <li key={a.value}>
                  <label className="flex cursor-pointer items-center gap-3 py-0.5 text-sm">
                    <input
                      type="checkbox"
                      name="audience"
                      value={a.value}
                      defaultChecked={params.audience.includes(a.value)}
                      className="size-4 accent-[var(--primary)]"
                    />
                    <span className="flex-1">{t(AUDIENCE_LABEL_KEY[a.value])}</span>
                    <span className="text-muted-foreground">{a.count}</span>
                  </label>
                </li>
              ))}
            </ul>
          </FacetGroup>
        )}

        {brands.length > 0 && (
          <FacetGroup title={t("brand")}>
            <ul className="space-y-1.5">
              {brands.map((b) => (
                <li key={b.slug}>
                  <label className="flex cursor-pointer items-center gap-3 py-0.5 text-sm">
                    <input
                      type="checkbox"
                      name="brand"
                      value={b.slug}
                      defaultChecked={params.brand.includes(b.slug)}
                      className="size-4 accent-[var(--primary)]"
                    />
                    <span className="flex-1">{b.name}</span>
                    <span className="text-muted-foreground">{b.count}</span>
                  </label>
                </li>
              ))}
            </ul>
          </FacetGroup>
        )}

        {colors.length > 0 && (
          <FacetGroup title={t("colour")}>
            <ul className="space-y-1.5">
              {colors.map((c) => (
                <li key={c.name}>
                  <label className="flex cursor-pointer items-center gap-3 py-0.5 text-sm">
                    <input
                      type="checkbox"
                      name="color"
                      value={c.name}
                      defaultChecked={isSelected(params.color, c.name)}
                      className="size-4 accent-[var(--primary)]"
                    />
                    <span
                      aria-hidden
                      className="size-4 rounded-full border border-border"
                      style={{ backgroundColor: c.hex ?? "#E8E6DF" }}
                    />
                    <span className="flex-1">{c.name}</span>
                    <span className="text-muted-foreground">{c.count}</span>
                  </label>
                </li>
              ))}
            </ul>
          </FacetGroup>
        )}

        {sizes.length > 0 && (
          <FacetGroup title={t("size")}>
            <ul className="flex flex-wrap gap-2">
              {sizes.map((s) => (
                <li key={s.name}>
                  <label className="cursor-pointer">
                    <input
                      type="checkbox"
                      name="size"
                      value={s.name}
                      defaultChecked={isSelected(params.size, s.name)}
                      className="peer sr-only"
                    />
                    <span className="inline-flex h-9 min-w-10 items-center justify-center rounded-md border border-border bg-card px-3 text-sm transition hover:border-muted-foreground peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40">
                      {s.name}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </FacetGroup>
        )}

        <FacetGroup title={t("price")}>
          <div className="flex items-center gap-2">
            <label className="flex-1">
              <span className="sr-only">{t("minPrice")}</span>
              <input
                name="min"
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                defaultValue={params.min}
                placeholder={t("minPrice")}
                className={inputClass}
              />
            </label>
            <span aria-hidden className="text-muted-foreground">
              –
            </span>
            <label className="flex-1">
              <span className="sr-only">{t("maxPrice")}</span>
              <input
                name="max"
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                defaultValue={params.max}
                placeholder={t("maxPrice")}
                className={inputClass}
              />
            </label>
          </div>
        </FacetGroup>

        <label className="flex cursor-pointer items-center gap-2 border-t border-border pt-4 text-sm">
          <input
            type="checkbox"
            name="inStock"
            value="1"
            defaultChecked={params.inStock}
            className="size-4 accent-[var(--primary)]"
          />
          {t("inStockOnly")}
        </label>

        <div className="flex items-center gap-3">
          <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary-hover">
            {t("apply")}
          </Button>
          {hasActiveFilters(params) && (
            <Link href={listingHref(basePath, params, clearFilters())} className="text-sm text-primary hover:underline">
              {t("clearAll")}
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}