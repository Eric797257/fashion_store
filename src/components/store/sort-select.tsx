"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

export function SortSelect({
  options,
  value,
}: {
  options: { value: string; label: string; href: string }[];
  value: string;
}) {
  const t = useTranslations("Catalog");
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{t("sortBy")}</span>
      <select
        value={value}
        onChange={(event) => {
          const chosen = options.find((o) => o.value === event.target.value);
          if (chosen) router.push(chosen.href);
        }}
        className="h-10 rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}