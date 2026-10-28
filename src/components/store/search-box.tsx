"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ProductImage } from "@/components/store/product-image";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Suggestions } from "@/server/catalog/suggest-query";

interface Option {
  key: string;
  href: string;
}

export function SearchBox({ className }: { className?: string }) {
  const t = useTranslations("Header");
  const ts = useTranslations("Search");
  const router = useRouter();
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Suggestions | null>(null);
  const [active, setActive] = useState(-1);

  const query = value.trim();
  const longEnough = Array.from(query).length >= 2;
  const results = longEnough ? data : null;

  // Ask the server for suggestions shortly after typing stops
  useEffect(() => {
    if (!longEnough) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        setData((await res.json()) as Suggestions);
        setActive(-1);
      } catch {
        // Typing continued or the network failed. The plain form still works.
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, longEnough]);

  // Close when clicking elsewhere
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const options: Option[] = [];
  for (const p of results?.products ?? []) options.push({ key: `p-${p.slug}`, href: `/products/${p.slug}` });
  for (const c of results?.categories ?? []) options.push({ key: `c-${c.slug}`, href: `/categories/${c.slug}` });
  if (longEnough) options.push({ key: "all", href: `/search?q=${encodeURIComponent(query)}` });

  const productCount = results?.products.length ?? 0;
  const categoryCount = results?.categories.length ?? 0;
  const expanded = open && longEnough && options.length > 0;
  const activeIndex = active >= 0 && active < options.length ? active : -1;
  const optionId = (i: number) => `${listId}-option-${i}`;

  function go(href: string) {
    setOpen(false);
    setActive(-1);
    router.push(href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive(activeIndex + 1 >= options.length ? 0 : activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(activeIndex <= 0 ? options.length - 1 : activeIndex - 1);
    } else if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
    } else if (event.key === "Enter" && expanded && activeIndex >= 0) {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) go(option.href);
    }
  }

  const rowClass = (i: number) =>
    cn(
      "flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm",
      i === activeIndex ? "bg-secondary" : "hover:bg-secondary",
    );

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* A plain GET form: without JavaScript it still searches */}
      <form action="/search" method="get" role="search" onSubmit={() => setOpen(false)} className="relative">
        <input
          type="search"
          name="q"
          maxLength={80}
          autoComplete="off"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          className="h-11 w-full rounded-full border border-input bg-card pl-5 pr-12 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="submit"
          aria-label={t("search")}
          className="absolute right-1 top-1 inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Search className="size-4" aria-hidden />
        </button>
      </form>

      <p className="sr-only" aria-live="polite">
        {expanded ? ts("suggestionsCount", { count: options.length - 1 }) : ""}
      </p>

      {expanded && (
        <div
          id={listId}
          role="listbox"
          aria-label={ts("suggestionsLabel")}
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-card shadow-lift"
        >
          {productCount > 0 && (
            <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {ts("productsHeading")}
            </p>
          )}
          {results?.products.map((p, i) => (
            <div
              key={`p-${p.slug}`}
              id={optionId(i)}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                go(`/products/${p.slug}`);
              }}
              className={rowClass(i)}
            >
              <span className="relative size-12 shrink-0 overflow-hidden rounded-md bg-secondary">
                <ProductImage
                  image={p.imageUrl ? { url: p.imageUrl, alt: p.imageAlt } : null}
                  sizes="48px"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="text-muted-foreground">{formatMoney(p.price)}</span>
              </span>
            </div>
          ))}

          {categoryCount > 0 && (
            <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {ts("categoriesHeading")}
            </p>
          )}
          {results?.categories.map((c, j) => {
            const i = productCount + j;
            return (
              <div
                key={`c-${c.slug}`}
                id={optionId(i)}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(`/categories/${c.slug}`);
                }}
                className={rowClass(i)}
              >
                {c.name}
              </div>
            );
          })}

          {productCount === 0 && categoryCount === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">{ts("noQuickMatches")}</p>
          )}

          <div
            id={optionId(options.length - 1)}
            role="option"
            aria-selected={options.length - 1 === activeIndex}
            onMouseDown={(e) => {
              e.preventDefault();
              go(`/search?q=${encodeURIComponent(query)}`);
            }}
            className={cn(rowClass(options.length - 1), "border-t border-border font-medium text-primary")}
          >
            {ts("seeAll", { query })}
          </div>
        </div>
      )}
    </div>
  );
}