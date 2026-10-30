import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/store/json-ld";
import { CategoryTiles } from "@/components/store/home/category-tiles";
import { HeroBanner } from "@/components/store/home/hero-banner";
import { NewsletterSection } from "@/components/store/home/newsletter-section";
import { ProductShelf } from "@/components/store/home/product-shelf";
import { PromoBanners } from "@/components/store/home/promo-banners";
import { Testimonials } from "@/components/store/home/testimonials";
import { brand } from "@/config/brand";
import { resolveLocale } from "@/i18n/locale";
import { siteUrl } from "@/lib/site-url";
import { getBanners, getShelf, getTestimonials } from "@/server/catalog/home";
import { buildWebsiteJsonLd } from "@/server/catalog/structured-data";
import { getCategoryTree } from "@/server/queries/categories";

export const instant = false;

export const metadata: Metadata = {
  description: brand.description,
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const locale = resolveLocale(await getLocale());

  const [t, banners, tree, featured, newest, best, sale, testimonials] = await Promise.all([
    getTranslations("Home"),
    getBanners(locale),
    getCategoryTree(locale),
    getShelf("featured", 4, locale),
    getShelf("new", 8, locale),
    getShelf("best", 4, locale),
    getShelf("sale", 4, locale),
    getTestimonials(locale),
  ]);

  const sameAs = Object.values(brand.social).filter((url): url is string => Boolean(url));

  return (
    <div className="pb-4">
      <JsonLd
        data={buildWebsiteJsonLd({
          baseUrl: siteUrl(),
          name: brand.name,
          logoUrl: brand.logo.src ? `${siteUrl()}${brand.logo.src}` : undefined,
          sameAs,
        })}
      />

      <HeroBanner banner={banners.hero[0] ?? null} />
      <CategoryTiles categories={tree} />
      <ProductShelf id="featured" title={t("featuredTitle")} products={featured} viewAllHref="/products" />
      <PromoBanners banners={banners.promo} />
      <ProductShelf id="new" title={t("newTitle")} products={newest} viewAllHref="/products?sort=newest" />
      <ProductShelf id="best" title={t("bestTitle")} products={best} viewAllHref="/products?sort=popular" />
      {/* Offers have no "view all" link yet: the listing has no "on sale" filter */}
      <ProductShelf id="sale" title={t("saleTitle")} products={sale} />
      <Testimonials items={testimonials} />
      <NewsletterSection />
    </div>
  );
}