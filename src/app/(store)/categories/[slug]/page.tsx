import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { ListingView, type Crumb } from "@/components/store/listing-view";
import { resolveLocale } from "@/i18n/locale";
import { listingHref } from "@/lib/listing-url";
import { getProductListing } from "@/server/catalog/listing";
import { getCategoryInfo, getCategoryTree } from "@/server/queries/categories";
import { parseListingParams } from "@/validation/catalog";

export const instant = false;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!SLUG.test(slug) || slug.length > 80) return {};

  const locale = resolveLocale(await getLocale());
  const [category, query] = await Promise.all([
    getCategoryInfo(slug, locale),
    searchParams.then(parseListingParams),
  ]);
  if (!category) return {};

  const filtered = query.sort !== "newest" || query.min !== undefined || query.max !== undefined || query.inStock;

  return {
    title: category.name,
    description: category.description ?? undefined,
    alternates: {
      canonical: listingHref(`/categories/${slug}`, query, {
        sort: "newest",
        min: undefined,
        max: undefined,
        inStock: false,
      }),
    },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  if (!SLUG.test(slug) || slug.length > 80) notFound();

  const query = parseListingParams(await searchParams);
  const locale = resolveLocale(await getLocale());
  const t = await getTranslations("Catalog");

  const [category, listing, tree] = await Promise.all([
    getCategoryInfo(slug, locale),
    getProductListing(query, slug, locale),
    getCategoryTree(locale),
  ]);
  if (!category || !listing) notFound();

  const basePath = `/categories/${slug}`;
  if (query.page !== listing.page) {
    redirect(listingHref(basePath, query, { page: listing.page }));
  }

  const breadcrumbs: Crumb[] = [
    { label: t("breadcrumbHome"), href: "/" },
    { label: t("allProducts"), href: "/products" },
    ...(category.parent
      ? [{ label: category.parent.name, href: `/categories/${category.parent.slug}` }]
      : []),
    { label: category.name },
  ];

  return (
    <ListingView
      basePath={basePath}
      params={query}
      listing={listing}
      tree={tree}
      activeSlug={slug}
      title={category.name}
      description={category.description}
      breadcrumbs={breadcrumbs}
    />
  );
}