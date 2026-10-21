"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/i18n/actions";
import { LOCALES, LOCALE_LABELS } from "@/i18n/locale";
import { cn } from "@/lib/utils";

export function LanguageSwitch({ className }: { className?: string }) {
  const t = useTranslations("Common");
  const current = useLocale();
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label={t("language")}
      className={cn("inline-flex rounded-full border border-border bg-card p-0.5", className)}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          disabled={pending}
          aria-pressed={l === current}
          onClick={() => 
            startTransition(async () => {
              await setLocale(l);
            })
          }
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition disabled:opacity-60",
            l === current
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}