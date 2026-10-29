import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ProductImage } from "@/components/store/product-image";
import { WishlistButton } from "@/components/store/wishlist/wishlist-button";
import { formatMoney } from "@/lib/money";
import type { ProductCardData } from "@/server/catalog/types";

const IMAGE_SIZES = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw";

export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductCardData;
  priority?: boolean;
}) {
  const t = useTranslations("Catalog");
  const soldOut = product.stockStatus === "OUT_OF_STOCK";

  return (
    <article className="group relative">
      <Link href={`/products/${product.slug}`} className="block rounded-lg">
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-secondary">
          <ProductImage image={product.image} sizes={IMAGE_SIZES} priority={priority} />

          {product.hoverImage && (
            <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <ProductImage image={product.hoverImage} sizes={IMAGE_SIZES} />
            </div>
          )}

          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {product.onSale && (
              <span className="rounded-full bg-destructive px-2.5 py-1 text-xs font-semibold text-white">
                {t("sale")} −{product.percentOff}%
              </span>
            )}
            {product.isNew && !soldOut && (
              <span className="rounded-full bg-foreground px-2.5 py-1 text-xs font-semibold text-background">
                {t("new")}
              </span>
            )}
          </div>

          {soldOut && (
            <div className="absolute inset-x-0 bottom-0 bg-background/90 py-2 text-center text-sm font-medium">
              {t("soldOut")}
            </div>
          )}
        </div>

        <div className="mt-3 space-y-1.5">
          <h2 className="line-clamp-2 font-sans text-sm font-medium leading-snug transition-colors group-hover:text-primary">
            {product.name}
          </h2>

          <p className="flex items-baseline gap-2">
            <span className={`font-semibold ${product.onSale ? "text-destructive" : ""}`}>
              {formatMoney(product.price)}
            </span>
            {product.compareAtPrice !== null && (
              <span className="text-sm text-muted-foreground line-through">
                {formatMoney(product.compareAtPrice)}
              </span>
            )}
          </p>

          {product.stockStatus === "LOW_STOCK" && (
            <p className="text-xs font-medium text-destructive">{t("lowStock")}</p>
          )}

          <div className="flex items-center justify-between gap-2">
            {product.colors.length > 0 && (
              <p
                className="flex items-center gap-1"
                role="img"
                aria-label={t("colors", { count: product.colors.length })}
              >
                {product.colors.map((c) => (
                  <span
                    key={c.name}
                    title={c.name}
                    className="size-3.5 rounded-full border border-border"
                    style={{ backgroundColor: c.hex ?? "#E8E6DF" }}
                  />
                ))}
              </p>
            )}

            {product.ratingCount > 0 && (
              <p
                className="flex items-center gap-1 text-xs text-muted-foreground"
                role="img"
                aria-label={t("ratingLabel", {
                  rating: product.ratingAverage.toFixed(1),
                  count: product.ratingCount,
                })}
              >
                <Star className="size-3.5 fill-current text-primary" aria-hidden />
                {product.ratingAverage.toFixed(1)} ({product.ratingCount})
              </p>
            )}
          </div>
        </div>
      </Link>

      {/* A sibling of the link, not inside it */}
      <WishlistButton
        productId={product.id}
        productName={product.name}
        className="absolute right-2 top-2 z-10"
      />
    </article>
  );
}