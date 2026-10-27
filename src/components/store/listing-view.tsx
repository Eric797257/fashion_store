import { useTranslations } from "next-intl";
import Link from "next/link";
import { ListingFilters } from "@/components/store/listing-filters";
import { Pagination } from "@/components/store/pagination";
import { ProductGrid } from "@/components/store/product-grid";
import { SortSelect } from "@/components/store/sort-select";
import { hasActiveFilters, listingHref } from "@/lib/listing-url";
import type { ProductListing } from "@/server/catalog/types";
import type { CategoryTreeNode } from "@/server/queries/categories";
import { SORT_OPTIONS, type ListingParams } from "@/validation/catalog";

const SORT_LABEL_KEY = {
  newest: "sortNewest",
  "price-asc": "sortPriceAsc",
  "price-desc": "sortPriceDesc",
  popular: "sortPopular",
  rating: "sortRating",
} as const;

export interface Crumb {
  label: string;
  href?: string;
}

export function ListingView({
  basePath,
  params,
  listing,
  tree,
  activeSlug,
  title,
  description,
  breadcrumbs,
}: {
  basePath: string;
  params: ListingParams;
  listing: ProductListing;
  tree: CategoryTreeNode[];
  activeSlug: string | null;
  title: string;
  description?: string | null;
  breadcrumbs: Crumb[];
}) {
  const t = useTranslations("Catalog");

  const sortOptions = SORT_OPTIONS.map((value) => ({
    value,
    label: t(SORT_LABEL_KEY[value]),
    href: listingHref(basePath, params, { sort: value, page: 1 }),
  }));

  const filters = (
    <ListingFilters basePath={basePath} params={params} tree={tree} activeSlug={activeSlug} />
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <nav aria-label={t("breadcrumb")} className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          {breadcrumbs.map((crumb, index) => (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 && <span aria-hidden>/</span>}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-primary">
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current="page" className="text-foreground">
                  {crumb.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <header className="mt-4">
        <h1 className="text-4xl font-semibold sm:text-5xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-muted-foreground">{description}</p>}
      </header>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t("resultsCount", { count: listing.total })}
        </p>
        <SortSelect options={sortOptions} value={params.sort} />
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[16rem_1fr]">
        {/* Mobile: filters collapse. Desktop: always visible. */}
        <details className="rounded-lg border border-border bg-card p-4 lg:hidden" open={hasActiveFilters(params)}>
          <summary className="cursor-pointer font-medium">{t("filters")}</summary>
          <div className="mt-4">{filters}</div>
        </details>
        <aside aria-label={t("filters")} className="hidden lg:block">
          {filters}
        </aside>

        <div>
          {listing.items.length > 0 ? (
            <>
              <ProductGrid products={listing.items} />
              <Pagination
                basePath={basePath}
                params={params}
                page={listing.page}
                totalPages={listing.totalPages}
              />
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-border py-16 text-center">
              <h2 className="font-sans text-xl font-semibold">{t("noResultsTitle")}</h2>
              <p className="mt-2 text-muted-foreground">{t("noResultsBody")}</p>
              {hasActiveFilters(params) && (
                <Link
                  href={listingHref(basePath, params, {
                    min: undefined,
                    max: undefined,
                    inStock: false,
                    page: 1,
                  })}
                  className="mt-4 inline-block text-primary hover:underline"
                >
                  {t("clearAll")}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}