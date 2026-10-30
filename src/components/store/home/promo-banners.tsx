import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ProductImage } from "@/components/store/product-image";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { cn } from "@/lib/utils";
import type { BannerData } from "@/server/catalog/home-query";

export function PromoBanners({ banners }: { banners: BannerData[] }) {
  const t = useTranslations("Home");
  const shown = banners.slice(0, 3);
  if (shown.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8" aria-label={t("promotions")}>
      <ul
        className={cn(
          "grid gap-4",
          shown.length === 1 ? "grid-cols-1" : shown.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3",
        )}
      >
        {shown.map((banner) => {
          const hasImage = Boolean(banner.imageUrl);
          return (
            <li key={banner.id}>
              <Link
                href={safeRedirectPath(banner.ctaHref, "/products")}
                className="group relative isolate flex aspect-[16/10] items-end overflow-hidden rounded-xl bg-secondary"
              >
                {banner.imageUrl && (
                  <>
                    <div className="absolute inset-0 -z-10 transition duration-500 group-hover:scale-105">
                      <ProductImage
                        image={{ url: banner.imageUrl, alt: banner.imageAlt }}
                        sizes="(min-width: 768px) 33vw, 100vw"
                      />
                    </div>
                    <div aria-hidden className="absolute inset-0 -z-10 bg-foreground/40" />
                  </>
                )}
                <div className={cn("p-6", hasImage ? "text-white" : "text-foreground")}>
                  <h3 className="font-display text-3xl font-semibold">{banner.title}</h3>
                  {banner.subtitle && <p className="mt-1 text-sm opacity-90">{banner.subtitle}</p>}
                  <span className="mt-3 inline-flex items-center gap-2 text-sm font-medium">
                    {banner.ctaLabel ?? t("shopNow")}
                    <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden />
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}