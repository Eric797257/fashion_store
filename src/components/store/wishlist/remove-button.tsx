"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setWishlisted } from "@/server/wishlist/actions";

export function RemoveFromWishlistButton({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const t = useTranslations("Wishlist");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      aria-label={t("removeLabel", { name: productName })}
      onClick={() =>
        startTransition(async () => {
          await setWishlisted(productId, false);
          router.refresh();
        })
      }
    >
      {t("remove")}
    </Button>
  );
}