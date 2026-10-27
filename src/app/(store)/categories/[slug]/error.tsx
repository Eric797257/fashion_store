"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function ListingError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Catalog");

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold">{t("errorTitle")}</h1>
      <p className="mt-3 text-muted-foreground">{t("errorBody")}</p>
      <Button
        type="button"
        onClick={reset}
        className="mt-6 bg-primary text-primary-foreground hover:bg-primary-hover"
      >
        {t("retry")}
      </Button>
    </div>
  );
}