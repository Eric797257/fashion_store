import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ListingView } from "@/components/store/listing-view";
import { buttonVariants } from "@/components/ui/button";
import { resolveLocale } from "@/i18n/locale";
import { listingHref } from "@/lib/listing-url";
import { cn } from "@/lib/utils";
import { loadListing } from "@/server/catalog/load-listing";
import { getCategoryTree } from "@/server/queries/categories";
import { parseListingParams } from "@/validation/catalog";

export const instant = false;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const [t, params] = await Promise.all([
    getTranslations("Search"),
    searchParams.then(parseListingParams),
  ]);

  return {
    title: params.q ? t("searchTitle", { query: params.q }) : t("searchPage"),
    // Search result pages are never indexed
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = parseListingParams(await searchParams);
  const locale = resolveLocale(await getLocale());
  const [t, tc, tree] = await Promise.all([
    getTranslations("Search"),
    getTranslations("Catalog"),
    getCategoryTree(locale),
  ]);

  if (!params.q) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-4xl font-semibold">{t("searchPromptTitle")}</h1>
        <p className="mt-4 text-muted-foreground">{t("searchPromptBody")}</p>
        <ul className="mt-8 flex flex-wrap justify-center gap-3">
          {tree.map((c) => (
            <li key={c.id}>
              <Link
                href={`/categories/${c.slug}`}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm transition hover:bg-secondary"
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/products"
          className={cn(buttonVariants(), "mt-8 bg-primary text-primary-foreground hover:bg-primary-hover")}
        >
          {t("browseAll")}
        </Link>
      </div>
    );
  }

  const listing = await loadListing(params, null, locale);
  if (!listing) notFound();

  if (params.page !== listing.page) {
    redirect(listingHref("/search", params, { page: listing.page }));
  }

  return (
    <ListingView
      basePath="/search"
      params={params}
      listing={listing}
      tree={tree}
      activeSlug={null}
      title={t("searchTitle", { query: params.q })}
      breadcrumbs={[{ label: tc("breadcrumbHome"), href: "/" }, { label: t("searchPage") }]}
    />
  );
}