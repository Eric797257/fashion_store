"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSelection } from "@/components/store/product-detail/selection-context";
import { ProductImage } from "@/components/store/product-image";
import { cn } from "@/lib/utils";

export function ProductGallery() {
  const t = useTranslations("Product");
  const { images, color } = useSelection();

  // The chosen photo resets to the first one whenever the colour changes
  const [state, setState] = useState({ color, index: 0 });
  const index = state.color === color ? Math.min(state.index, images.length - 1) : 0;
  const go = (next: number) =>
    setState({ color, index: (next + images.length) % images.length });

  const current = images[index] ?? null;

  return (
    <div className="space-y-3" role="group" aria-label={t("galleryLabel")}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-secondary">
        <ProductImage
          key={current?.url ?? "none"}
          image={current}
          sizes="(min-width: 1024px) 50vw, 100vw"
          priority
        />

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label={t("previousImage")}
              className="absolute left-3 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-soft transition hover:bg-background"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label={t("nextImage")}
              className="absolute right-3 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-soft transition hover:bg-background"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
            <p
              className="absolute bottom-3 right-3 rounded-full bg-background/90 px-3 py-1 text-xs"
              aria-live="polite"
            >
              {t("imageCounter", { current: index + 1, total: images.length })}
            </p>
          </>
        )}
      </div>

      {images.length > 1 && (
        <ul className="grid grid-cols-5 gap-2 sm:grid-cols-6">
          {images.map((image, i) => (
            <li key={`${image.url}-${i}`}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={t("showImage", { number: i + 1 })}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "relative block aspect-square w-full overflow-hidden rounded-lg border-2 bg-secondary transition",
                  i === index ? "border-primary" : "border-transparent hover:border-border",
                )}
              >
                <ProductImage image={image} sizes="96px" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}