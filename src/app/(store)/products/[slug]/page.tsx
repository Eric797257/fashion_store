import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/store/breadcrumbs";
import { JsonLd } from "@/components/store/json-ld";
import { DeliveryInfo } from "@/components/store/product-detail/delivery-info";
import { ProductGallery } from "@/components/store/product-detail/gallery";
import { PriceBlock } from "@/components/store/product-detail/price-block";
import { PurchasePanel } from "@/components/store/product-detail/purchase-panel";
import { ReviewsSection } from "@/components/store/product-detail/reviews-section";
import { SelectionProvider } from "@/components/store/product-detail/selection-context";
import { SpecsList } from "@/components/store/product-detail/specs-list";
import { ProductGrid } from "@/components/store/product-grid";
import { brand } from "@/config/brand";
import { MAX_QUANTITY_PER_LINE } from "@/config/features";
import { resolveLocale } from "@/i18n/locale";
import type { VariantOption } from "@/lib/variant-selection";
import { getProductDetail, getProductReviews, getRelatedProducts } from "@/server/catalog/detail";
import { queryLiveStock } from "@/server/catalog/detail-query";
import { buildProductJsonLd } from "@/server/catalog/structured-data";
import { getStoreInfo } from "@/server/queries/store-info";
import { WishlistButton } from "@/components/store/wishlist/wishlist-button";

// Language comes from a cookie and stock is read live, so this page is rendered per request.
export const instant = false;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const validSlug = (slug: string) => SLUG.test(slug) && slug.length <= 120;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const cleanOption = (v: string | undefined) => (v && v.length <= 60 ? v : undefined);

function summarize(text: string | null): string | undefined {
  if (!text) return undefined;
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 155 ? `${flat.slice(0, 152)}…` : flat || undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!validSlug(slug)) return {};

  const detail = await getProductDetail(slug, resolveLocale(await getLocale()));
  if (!detail) return {};

  const title = detail.seoTitle ?? detail.name;
  const description =
    detail.seoDescription ?? summarize(detail.description) ?? `${detail.name} – ${brand.name}`;
  const photo = detail.images.find((i) => !i.url.toLowerCase().endsWith(".svg"));

  return {
    title,
    description,
    alternates: { canonical: `/products/${slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      images: photo ? [{ url: photo.url, alt: photo.alt }] : undefined,
    },
  };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  if (!validSlug(slug)) notFound();

  const locale = resolveLocale(await getLocale());
  const detail = await getProductDetail(slug, locale);
  if (!detail) notFound();

  const [t, tc, query, live, reviews, related, store] = await Promise.all([
    getTranslations("Product"),
    getTranslations("Catalog"),
    searchParams,
    queryLiveStock(detail.id), // fresh on every request, never cached
    getProductReviews(detail.id),
    getRelatedProducts(detail.id, detail.category.id, locale),
    getStoreInfo(),
  ]);

  // Cached product facts + live stock
  const liveById = new Map(live.map((l) => [l.variantId, l]));
  const variants: VariantOption[] = detail.variants.map((v) => {
    const stock = liveById.get(v.id);
    return {
      id: v.id,
      sku: v.sku,
      size: v.size,
      color: v.color,
      colorHex: v.colorHex,
      available: Math.min(stock?.available ?? 0, MAX_QUANTITY_PER_LINE),
      low: stock?.low ?? false,
    };
  });

  const jsonLd = buildProductJsonLd({
    baseUrl: (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
    slug: detail.slug,
    name: detail.name,
    description: detail.description,
    brandName: detail.brandName,
    images: detail.images,
    currency: brand.currency.code,
    price: detail.price,
    onSale: detail.onSale,
    saleEndsAt: detail.saleEndsAt,
    variants: variants.map((v) => ({ sku: v.sku, available: v.available, low: v.low })),
    ratingAverage: reviews.average,
    ratingCount: reviews.count,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <JsonLd data={jsonLd} />

      <Breadcrumbs
        items={[
          { label: tc("breadcrumbHome"), href: "/" },
          { label: tc("allProducts"), href: "/products" },
          ...(detail.category.parent
            ? [{ label: detail.category.parent.name, href: `/categories/${detail.category.parent.slug}` }]
            : []),
          { label: detail.category.name, href: `/categories/${detail.category.slug}` },
          { label: detail.name },
        ]}
      />

      <SelectionProvider
        variants={variants}
        images={detail.images}
        requested={{ color: cleanOption(first(query.color)), size: cleanOption(first(query.size)) }}
      >
        <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-14">
          <ProductGallery />

          <div className="space-y-8">
            <div className="space-y-4">
              {detail.brandName && (
                <p className="text-sm uppercase tracking-wide text-muted-foreground">{detail.brandName}</p>
              )}
              <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">{detail.name}</h1>
              <PriceBlock
                price={detail.price}
                compareAtPrice={detail.compareAtPrice}
                onSale={detail.onSale}
                percentOff={detail.percentOff}
                saleEndsAt={detail.saleEndsAt}
              />
            </div>

            <PurchasePanel />
            <WishlistButton variant="detail" productId={detail.id} productName={detail.name} />
            <DeliveryInfo info={store} />
          </div>
        </div>
      </SelectionProvider>

      <div className="mt-16 grid gap-12 lg:grid-cols-2">
        {detail.description && (
          <section aria-labelledby="description-title">
            <h2 id="description-title" className="text-3xl font-semibold">
              {t("description")}
            </h2>
            {/* Plain text: line breaks are kept, nothing is treated as HTML */}
            <p className="mt-4 whitespace-pre-line leading-relaxed text-muted-foreground">
              {detail.description}
            </p>
          </section>
        )}
        {detail.specs.length > 0 && (
          <section aria-labelledby="specs-title">
            <h2 id="specs-title" className="text-3xl font-semibold">
              {t("specifications")}
            </h2>
            <div className="mt-4">
              <SpecsList specs={detail.specs} />
            </div>
          </section>
        )}
      </div>

      <div className="mt-16 border-t border-border pt-12">
        <ReviewsSection summary={reviews} />
      </div>

      {related.length > 0 && (
        <section className="mt-16 border-t border-border pt-12" aria-labelledby="related-title">
          <h2 id="related-title" className="mb-8 text-3xl font-semibold">
            {t("relatedTitle")}
          </h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}