import { ImageOff } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ProductImageData } from "@/server/catalog/types";

export function ProductImage({
  image,
  sizes,
  priority = false,
  className,
}: {
  image: ProductImageData | null;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const t = useTranslations("Catalog");

  if (!image) {
    return (
      <div className="flex size-full items-center justify-center bg-secondary text-muted-foreground">
        <ImageOff className="size-8" aria-hidden />
        <span className="sr-only">{t("noImage")}</span>
      </div>
    );
  }

  // Local sample SVGs can't go through the image optimizer
  const unoptimized = image.url.startsWith("/sample/") || image.url.endsWith(".svg");

  return (
    <Image
      src={image.url}
      alt={image.alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={unoptimized}
      className={cn("object-cover", className)}
    />
  );
}