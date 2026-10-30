import { useTranslations } from "next-intl";
import Link from "next/link";
import { ProductCard } from "@/components/store/product-card";
import type { ProductCardData } from "@/server/catalog/types";

export function ProductShelf({
  id,
  title,
  products,
  viewAllHref,
}: {
  id: string;
  title: string;
  products: ProductCardData[];
  viewAllHref?: string;
}) {
  const t = useTranslations("Home");
  if (products.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8" aria-labelledby={`${id}-title`}>
      <div className="flex items-end justify-between gap-4">
        <h2 id={`${id}-title`} className="text-3xl font-semibold sm:text-4xl">
          {title}
        </h2>
        {viewAllHref && (
          <Link href={viewAllHref} className="shrink-0 text-sm font-medium text-primary hover:underline">
            {t("viewAll")}
          </Link>
        )}
      </div>
      <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
        {products.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </section>
  );
}