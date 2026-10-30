import { useTranslations } from "next-intl";
import Link from "next/link";
import { ProductImage } from "@/components/store/product-image";
import { buttonVariants } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { cn } from "@/lib/utils";
import type { BannerData } from "@/server/catalog/home-query";

/** Uses the first active hero banner, or your brand tagline when there is none. */
export function HeroBanner({ banner }: { banner: BannerData | null }) {
  const t = useTranslations("Home");

  const title = banner?.title ?? brand.tagline;
  const subtitle = banner ? banner.subtitle : brand.description;
  const label = banner?.ctaLabel ?? t("shopNow");
  const href = safeRedirectPath(banner?.ctaHref, "/products"); // never leaves this site
  const hasImage = Boolean(banner?.imageUrl);

  return (
    <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <div className="relative isolate flex min-h-[26rem] items-end overflow-hidden rounded-2xl bg-secondary sm:min-h-[34rem]">
        {banner?.imageUrl && (
          <>
            <div className="absolute inset-0 -z-10">
              <ProductImage
                image={{ url: banner.imageUrl, alt: banner.imageAlt }}
                sizes="(min-width: 1280px) 1216px, 100vw"
                priority
              />
            </div>
            <div aria-hidden className="absolute inset-0 -z-10 bg-foreground/45" />
          </>
        )}

        <div className={cn("max-w-2xl p-6 sm:p-12", hasImage ? "text-white" : "text-foreground")}>
          <h1 className="text-4xl font-semibold leading-tight sm:text-6xl">{title}</h1>
          {subtitle && (
            <p className={cn("mt-4 text-lg", hasImage ? "text-white/90" : "text-muted-foreground")}>
              {subtitle}
            </p>
          )}
          <Link
            href={href}
            className={cn(
              buttonVariants({ size: "lg" }),
              "mt-8 h-12 bg-primary px-8 text-base text-primary-foreground hover:bg-primary-hover",
            )}
          >
            {label}
          </Link>
        </div>
      </div>
    </section>
  );
}