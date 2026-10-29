"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useWishlist } from "@/components/store/wishlist/wishlist-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function WishlistButton({
  productId,
  productName,
  variant = "card",
  className,
}: {
  productId: string;
  productName: string;
  variant?: "card" | "detail";
  className?: string;
}) {
  const t = useTranslations("Wishlist");
  const { has, toggle } = useWishlist();
  const saved = has(productId);

  if (variant === "detail") {
    return (
      <Button
        type="button"
        variant="outline"
        aria-pressed={saved}
        onClick={() => toggle(productId, productName)}
        className={cn("h-12 w-full gap-2", className)}
      >
        <Heart className={cn("size-5", saved && "fill-current text-destructive")} aria-hidden />
        {saved ? t("saved") : t("save")}
      </Button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={t("toggleLabel", { name: productName })}
      onClick={() => toggle(productId, productName)}
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-full bg-background/90 shadow-soft transition hover:bg-background",
        className,
      )}
    >
      <Heart className={cn("size-5", saved && "fill-current text-destructive")} aria-hidden />
    </button>
  );
}