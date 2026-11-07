"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { reconcileMyCart } from "@/server/cart/actions";

export function FixCartButton() {
  const t = useTranslations("Cart");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await reconcileMyCart();
          router.refresh();
        })
      }
      className="bg-primary text-primary-foreground hover:bg-primary-hover"
    >
      {t("updateCart")}
    </Button>
  );
}