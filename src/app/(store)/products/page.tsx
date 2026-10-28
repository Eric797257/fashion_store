import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { ListingView } from "@/components/store/listing-view";
import { resolveLocale } from "@/i18n/locale";
import { canonicalListingHref, isRefinedView, listingHref } from "@/lib/listing-url";
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
    getTranslations("Catalog"),
    searchParams.then(parseListingParams),
  ]);

  return {
    title: t("allProducts"),
    alternates: { canonical: canonicalListingHref("/products", params) },
    robots: isRefinedView(params) ? { index: false, follow: true } : undefined,
  };
}

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = parseListingParams(await searchParams);

  // Searching always happens on the search page
  if (params.q) redirect(listingHref("/search", params));

  const locale = resolveLocale(await getLocale());
  const t = await getTranslations("Catalog");

  const [listing, tree] = await Promise.all([
    loadListing(params, null, locale),
    getCategoryTree(locale),
  ]);
  if (!listing) notFound();

  if (params.page !== listing.page) {
    redirect(listingHref("/products", params, { page: listing.page }));
  }

  return (
    <ListingView
      basePath="/products"
      params={params}
      listing={listing}
      tree={tree}
      activeSlug={null}
      title={t("allProducts")}
      breadcrumbs={[{ label: t("breadcrumbHome"), href: "/" }, { label: t("allProducts") }]}
    />
  );
}