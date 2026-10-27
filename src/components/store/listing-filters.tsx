import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { hasActiveFilters, listingHref } from "@/lib/listing-url";
import { cn } from "@/lib/utils";
import type { CategoryTreeNode } from "@/server/queries/categories";
import type { ListingParams } from "@/validation/catalog";

export function ListingFilters({
  basePath,
  params,
  tree,
  activeSlug,
}: {
  basePath: string;
  params: ListingParams;
  tree: CategoryTreeNode[];
  activeSlug: string | null;
}) {
  const t = useTranslations("Catalog");

  const headingClass = "mb-3 font-sans text-sm font-semibold uppercase tracking-wide";
  const linkClass = (active: boolean) =>
    cn(
      "flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-secondary",
      active ? "bg-secondary font-medium text-primary" : "text-foreground",
    );

  return (
    <div className="space-y-8">
      <nav aria-label={t("categories")}>
        <h2 className={headingClass}>{t("categories")}</h2>
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

      {/* A plain GET form: works without JavaScript */}
      <form action={basePath} method="get" className="space-y-5">
        {params.sort !== "newest" && <input type="hidden" name="sort" value={params.sort} />}

        <fieldset>
          <legend className={headingClass}>{t("price")}</legend>
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
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
          </div>
        </fieldset>

        <label className="flex items-center gap-2 text-sm">
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
            <Link
              href={listingHref(basePath, params, {
                min: undefined,
                max: undefined,
                inStock: false,
                page: 1,
              })}
              className="text-sm text-primary hover:underline"
            >
              {t("clearAll")}
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}