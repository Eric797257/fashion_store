import { Heart } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { ProductGrid } from "@/components/store/product-grid";
import { RemoveFromWishlistButton } from "@/components/store/wishlist/remove-button";
import { buttonVariants } from "@/components/ui/button";
import { resolveLocale } from "@/i18n/locale";
import { cn } from "@/lib/utils";
import { requireAccess } from "@/server/auth/access";
import { queryWishlistItems } from "@/server/wishlist/read";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Wishlist");
  return { title: t("pageTitle"), robots: { index: false } };
}

export default async function WishlistPage() {
  const access = await requireAccess("/account/wishlist");
  const locale = resolveLocale(await getLocale());

  const [t, data] = await Promise.all([
    getTranslations("Wishlist"),
    queryWishlistItems(access.userId, locale),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-semibold">{t("pageTitle")}</h1>

      {data.items.length === 0 && data.unavailable.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border py-20 text-center">
          <Heart className="mx-auto size-10 text-muted-foreground" aria-hidden />
          <h2 className="mt-4 font-sans text-xl font-semibold">{t("emptyTitle")}</h2>
          <p className="mt-2 text-muted-foreground">{t("emptyBody")}</p>
          <Link
            href="/products"
            className={cn(buttonVariants(), "mt-6 bg-primary text-primary-foreground hover:bg-primary-hover")}
          >
            {t("browse")}
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-2 text-muted-foreground">
            {t("pageSubtitle", { count: data.items.length })}
          </p>

          {data.items.length > 0 && (
            <div className="mt-10">
              <ProductGrid products={data.items} />
            </div>
          )}

          {data.unavailable.length > 0 && (
            <section className="mt-14 border-t border-border pt-8" aria-labelledby="unavailable-title">
              <h2 id="unavailable-title" className="font-sans text-xl font-semibold">
                {t("unavailableTitle")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("unavailableBody")}</p>
              <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
                {data.unavailable.map((item) => (
                  <li key={item.productId} className="flex items-center justify-between gap-4 px-4 py-3">
                    <span className="text-sm text-muted-foreground">{item.name}</span>
                    <RemoveFromWishlistButton productId={item.productId} productName={item.name} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}