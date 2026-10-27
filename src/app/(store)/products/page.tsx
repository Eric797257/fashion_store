import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { ListingView } from "@/components/store/listing-view";
import { resolveLocale } from "@/i18n/locale";
import { listingHref } from "@/lib/listing-url";
import { getProductListing } from "@/server/catalog/listing";
import { getCategoryTree } from "@/server/queries/categories";
import { parseListingParams } from "@/validation/catalog";

// The language comes from a cookie, so this page is rendered per request.
// The expensive part (the database queries) is cached inside getProductListing.
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

  const filtered = params.sort !== "newest" || params.min !== undefined || params.max !== undefined || params.inStock;

  return {
    title: t("allProducts"),
    // Filtered and sorted views are not indexed. They point at the clean page instead.
    alternates: {
      canonical: listingHref("/products", params, {
        sort: "newest",
        min: undefined,
        max: undefined,
        inStock: false,
      }),
    },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = parseListingParams(await searchParams);
  const locale = resolveLocale(await getLocale());
  const t = await getTranslations("Catalog");

  const [listing, tree] = await Promise.all([
    getProductListing(params, null, locale),
    getCategoryTree(locale),
  ]);
  if (!listing) notFound();

  // A page number past the end goes to the last page
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