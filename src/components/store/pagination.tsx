import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { listingHref } from "@/lib/listing-url";
import { cn } from "@/lib/utils";
import type { ListingParams } from "@/validation/catalog";

function pageWindow(current: number, total: number): (number | "gap")[] {
  const wanted = new Set([1, total, current - 1, current, current + 1]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const result: (number | "gap")[] = [];
  pages.forEach((p, i) => {
    const previous = pages[i - 1];
    if (previous !== undefined && p - previous > 1) result.push("gap");
    result.push(p);
  });
  return result;
}

export function Pagination({
  basePath,
  params,
  page,
  totalPages,
}: {
  basePath: string;
  params: ListingParams;
  page: number;
  totalPages: number;
}) {
  const t = useTranslations("Catalog");
  if (totalPages <= 1) return null;

  const box = "inline-flex h-10 min-w-10 items-center justify-center rounded-md border px-3 text-sm";

  return (
    <nav aria-label={t("pagination")} className="mt-14 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link
          href={listingHref(basePath, params, { page: page - 1 })}
          className={cn(box, "border-border bg-card hover:bg-secondary")}
          rel="prev"
        >
          <ChevronLeft className="size-4" aria-hidden />
          <span className="ml-1 hidden sm:inline">{t("previous")}</span>
          <span className="sr-only sm:hidden">{t("previous")}</span>
        </Link>
      ) : null}

      {pageWindow(page, totalPages).map((entry, index) =>
        entry === "gap" ? (
          <span key={`gap-${index}`} aria-hidden className="px-1 text-muted-foreground">
            …
          </span>
        ) : (
          <Link
            key={entry}
            href={listingHref(basePath, params, { page: entry })}
            aria-current={entry === page ? "page" : undefined}
            aria-label={t("pageOf", { page: entry, total: totalPages })}
            className={cn(
              box,
              entry === page
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-secondary",
            )}
          >
            {entry}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link
          href={listingHref(basePath, params, { page: page + 1 })}
          className={cn(box, "border-border bg-card hover:bg-secondary")}
          rel="next"
        >
          <span className="mr-1 hidden sm:inline">{t("next")}</span>
          <span className="sr-only sm:hidden">{t("next")}</span>
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </nav>
  );
}