import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { CategoryTreeNode } from "@/server/queries/categories";

export function CategoryTiles({ categories }: { categories: CategoryTreeNode[] }) {
  const t = useTranslations("Home");
  const tc = useTranslations("Catalog");

  const shown = categories.filter((c) => c.count > 0);
  if (shown.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8" aria-labelledby="categories-title">
      <h2 id="categories-title" className="text-3xl font-semibold sm:text-4xl">
        {t("categoriesTitle")}
      </h2>
      <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((category) => (
          <li key={category.id}>
            <Link
              href={`/categories/${category.slug}`}
              className="group flex h-full min-h-40 flex-col justify-between rounded-xl border border-border bg-card p-5 transition hover:border-primary hover:shadow-soft"
            >
              <span className="font-display text-2xl font-semibold">{category.name}</span>
              <span className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
                {tc("resultsCount", { count: category.count })}
                <ArrowRight
                  className="size-4 transition group-hover:translate-x-1 group-hover:text-primary"
                  aria-hidden
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}